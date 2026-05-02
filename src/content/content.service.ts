import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { IUser } from 'src/util/interfaces';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, } from 'rxjs';
import { AxiosError } from 'axios';
import { FileStorageType } from 'src/minio-client/file.model';
import * as cheerio from 'cheerio';
import { QuotaService } from 'src/quota/quota.service';
import { QuotaType } from 'src/util/enums';
import { SystemLogService } from 'src/system-log/system-log.service';
import { Exception } from 'handlebars';

@Injectable()
export class ContentService {
    constructor(
        // Inject any required services here
        private prisma: PrismaService,
        private configService: ConfigService,
        private httpService: HttpService,
        private quotaService: QuotaService,
        private systemLogService: SystemLogService,

    ) { }

    async createContent(body: any, user: IUser) {
        const forceReingest = Boolean(body.forceReingest);
        const findUser = await this.prisma.team.findFirst({
            where: {
                id: user.teamId,
                CustomerBots: {
                    some: {
                        id: body.botId
                    }
                }
            }
        })

        if (!findUser) {
            return {
                message: "User or Bot not found"
            }
        }

        const isUrlBasedType = ['WEBPAGE', 'VIDEO', 'LINK'].includes(body.type);
        let existingUrlContent: any = null;

        if (isUrlBasedType && body.content?.url) {
            const incomingUrl = this.normalizeComparableUrl(body.content.url);
            if (incomingUrl) {
                const existingUrlContents = await this.prisma.content.findMany({
                    where: {
                        teamId: user.teamId,
                        botId: body.botId,
                        type: body.type,
                        isDeleted: false,
                    },
                    select: {
                        id: true,
                        content: true,
                    }
                });

                existingUrlContent = existingUrlContents.find((item) => {
                    const existingUrl = this.normalizeComparableUrl((item.content as any)?.url);
                    return existingUrl && existingUrl === incomingUrl;
                });
            }
        }

        if (existingUrlContent && !forceReingest) {
            return {
                message: 'URL already exists',
                duplicate: true,
                existingContentId: existingUrlContent.id,
            };
        }

        // Quota check for URL-based content types
        if (isUrlBasedType && !existingUrlContent) {
            const quota = await this.getQuota(user.teamId);
            if (quota.remaining < 1) {
                return {
                    message: `Insufficient quota. You have used ${quota.used} of ${quota.limit} pages.`
                };
            }
        }

        if (existingUrlContent && forceReingest) {
            await this.prisma.content.update({
                where: { id: existingUrlContent.id },
                data: {
                    status: 'UPLOADED',
                    taskId: '',
                    ingestionInfo: {},
                    updatedAt: new Date(),
                }
            });

            await this.ingestWebPage(body, user, body.content.url);

            await this.systemLogService.createLog({
                category: 'CONTENT',
                action: 'UPDATE',
                status: 'SUCCESS',
                userId: user.sub,
                userEmail: user.email,
                teamId: user.teamId,
                entityId: existingUrlContent.id,
                entityName: body.type,
                message: `Content re-ingested: ${body.type}`,
            });

            return {
                message: 'Content re-ingested successfully'
            };
        }

        await this.prisma.content.create({
            data: {
                teamId: user.teamId,
                botId: body.botId,
                type: body.type,
                content: body.content,
                status: 'UPLOADED',
                taskId: '',
                ingestionInfo: {},
                createdAt: new Date(),
            }
        })

        console.log("content created", body.type);

        if (isUrlBasedType) {
            console.log(`${body.type} content ingest started`);
            await this.ingestWebPage(body, user, body.content.url);

            // Increment quota for URL-based types
            const currentQuota = await this.prisma.quota.findFirst({
                where: { teamId: user.teamId, quotaType: 'FILE' }
            });
            if (currentQuota) {
                await this.prisma.quota.update({
                    where: { id: currentQuota.id },
                    data: { used: currentQuota.used + 1 }
                });
            }
        } else if (body.type === 'Q&A') {
            console.log("Q&A content ingest started");
            await this.ingestQA(body, user);
        } else if (body.type === 'CONTENT') {
            console.log("CONTENT ingest started");
            await this.ingestContent(body, user);
        }

        await this.systemLogService.createLog({
            category: 'CONTENT',
            action: 'CREATE',
            status: 'SUCCESS',
            userId: user.sub,
            userEmail: user.email,
            teamId: user.teamId,
            entityId: body.botId,
            entityName: body.type,
            message: `Content created: ${body.type}`,
        });

        return {
            message: "Content created successfully"
        }
    }

    async getContent(user: IUser, botId: string, type: string) {

        const content = await this.prisma.content.findMany({
            where: {
                botId: botId,
                teamId: user.teamId,
                type: type,
                isDeleted: false,
            }
        })
        return content;
    }

    async deleteContent(user: IUser, contentId: string, botId: string, sourceId: string) {

        try {
            const findUser = await this.prisma.team.findFirst({
                where: {
                    id: user.teamId,
                    Content: {
                        some: {
                            id: contentId
                        }
                    }
                }
            })

            if (!findUser) {
                return {
                    message: "User or Bot not found"
                }
            }

            // Get content to check type before deletion
            const content = await this.prisma.content.findUnique({
                where: { id: contentId }
            });

            await this.prisma.content.delete({
                where: {
                    id: contentId
                }
            })

            // Decrease quota if content type is WEBPAGE
            if (content && content.type === 'WEBPAGE') {
                const currentQuota = await this.prisma.quota.findFirst({
                    where: {
                        teamId: user.teamId,
                        quotaType: 'FILE'
                    }
                });

                if (currentQuota && currentQuota.used > 0) {
                    await this.prisma.quota.update({
                        where: { id: currentQuota.id },
                        data: { used: currentQuota.used - 1 }
                    });
                }
            }

            // Delete ingested vectors
            const data = await this.deleteIngestedContent(botId, user, sourceId);

            console.log("deleted Vectors response", data);

            await this.systemLogService.createLog({
                category: 'CONTENT',
                action: 'DELETE',
                status: 'SUCCESS',
                userId: user.sub,
                userEmail: user.email,
                teamId: user.teamId,
                entityId: contentId,
                entityName: content?.type,
                message: `Content deleted: ${contentId}`,
            });

            return {
                message: "Content deleted successfully"
            }

        } catch (err: any) {
            console.log("deleteContent error", err);

            await this.systemLogService.createLog({
                category: 'CONTENT',
                action: 'DELETE',
                status: 'ERROR',
                userId: user.sub,
                userEmail: user.email,
                teamId: user.teamId,
                entityId: contentId,
                message: `Content delete failed: ${err?.message || err}`,
            });

            return {
                message: "Error deleting content"
            }

        }
    }

    async deleteAllContent(user: IUser, contentIds: string[], botId: string) {
        try {
            // Verify user owns the bot
            const findUser = await this.prisma.team.findFirst({
                where: {
                    id: user.teamId,
                    CustomerBots: {
                        some: {
                            id: botId
                        }
                    }
                }
            });

            if (!findUser) {
                return { message: "User or Bot not found" };
            }

            // Fetch all content records to get sourceIds and types
            const contents = await this.prisma.content.findMany({
                where: {
                    id: { in: contentIds },
                    teamId: user.teamId,
                    botId: botId,
                }
            });

            if (contents.length === 0) {
                return { message: "No content found to delete" };
            }

            // Mark all as BEING_DELETED
            await this.prisma.content.updateMany({
                where: { id: { in: contents.map(c => c.id) } },
                data: { status: 'BEING_DELETED' }
            });

            // Process deletions asynchronously (don't await — return immediately)
            this.processDeleteAll(user, contents, botId).catch(err => {
                console.log("processDeleteAll background error", err);
            });

            return {
                message: "Deletion started",
                count: contents.length,
            };
        } catch (err) {
            console.log("deleteAllContent error", err);
            return { message: "Error deleting content" };
        }
    }

    private async processDeleteAll(user: IUser, contents: any[], botId: string) {
        let webpageCount = 0;

        for (const content of contents) {
            try {
                // Determine sourceId based on content type
                let sourceId = '';
                const contentData = content.content as any;

                if (content.type === 'WEBPAGE' || content.type === 'VIDEO' || content.type === 'LINK') {
                    sourceId = contentData?.url || '';
                    webpageCount++;
                } else if (content.type === 'Q&A') {
                    sourceId = contentData?.meta?.source || '';
                } else if (content.type === 'CONTENT') {
                    sourceId = contentData?.meta?.source || '';
                }

                // Delete vectors from vector DB
                if (sourceId) {
                    await this.deleteIngestedContent(botId, user, sourceId);
                }

                // Delete the content record
                await this.prisma.content.delete({
                    where: { id: content.id }
                });

                console.log(`Deleted content ${content.id} (${content.type})`);
            } catch (err) {
                console.log(`Error deleting content ${content.id}:`, err);
                // Mark failed items back to their previous status
                try {
                    await this.prisma.content.update({
                        where: { id: content.id },
                        data: { status: 'INDEXED' }
                    });
                } catch (_) { }
            }
        }

        // Decrease quota for WEBPAGE type content
        if (webpageCount > 0) {
            const currentQuota = await this.prisma.quota.findFirst({
                where: {
                    teamId: user.teamId,
                    quotaType: 'FILE'
                }
            });

            if (currentQuota && currentQuota.used > 0) {
                const newUsed = Math.max(0, currentQuota.used - webpageCount);
                await this.prisma.quota.update({
                    where: { id: currentQuota.id },
                    data: { used: newUsed }
                });
            }
        }

        console.log(`Bulk delete completed: ${contents.length} items processed`);
    }

    async editContent(body: any, user: IUser) {

        try {
            const findUser = await this.prisma.team.findFirst({
                where: {
                    id: user.teamId,
                    Content: {
                        some: {
                            id: body.contentId
                        }
                    }
                }
            })

            if (!findUser) {
                return {
                    message: "User or Content not found"
                }
            }

            await this.prisma.content.update({
                where: {
                    id: body.contentId
                },
                data: {
                    content: body.content,
                    status: 'UPLOADED',
                    taskId: '',
                    updatedAt: new Date(),
                }
            })

            console.log("content edited", body.contentId);

            // Fetch current content to determine type
            const existingContent = await this.prisma.content.findUnique({
                where: { id: body.contentId }
            });

            // Delete existing vectors
            const sourceId = body.content?.meta?.source || body.content?.url || '';
            if (sourceId) {
                await this.deleteIngestedContent(body.botId, user, sourceId);
            }

            // Re-ingest based on content type
            if (existingContent?.type === 'Q&A') {
                await this.ingestQA(body, user);
            } else if (existingContent?.type === 'CONTENT') {
                await this.ingestContent(body, user);
            } else if (['WEBPAGE', 'VIDEO', 'LINK'].includes(existingContent?.type)) {
                await this.ingestWebPage(body, user, body.content.url);
            }

            await this.systemLogService.createLog({
                category: 'CONTENT',
                action: 'UPDATE',
                status: 'SUCCESS',
                userId: user.sub,
                userEmail: user.email,
                teamId: user.teamId,
                entityId: body.contentId,
                message: `Content edited: ${body.contentId}`,
            });

            return {
                message: "Content edited successfully"
            }
        } catch (err: any) {
            console.log("editContent error", err);

            await this.systemLogService.createLog({
                category: 'CONTENT',
                action: 'UPDATE',
                status: 'ERROR',
                userId: user.sub,
                userEmail: user.email,
                teamId: user.teamId,
                entityId: body.contentId,
                message: `Content edit failed: ${err?.message || err}`,
            });

            return {
                message: "Error editing content"
            }
        }
    }

    async deleteIngestedContent(botId: string, user: IUser, sourceId: string) {
        //Vector DB den de silinecek
        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        console.log("Deleting vectors for content",);
        console.log("bot_cuid : ", botId);
        console.log("customer_cuid : ", user.teamId);
        console.log("sourceId : ", sourceId);


        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/delete-vectors`, {
                "bot_cuid": botId,
                "customer_cuid": user.teamId,
                "source": sourceId,
            })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));
        if (data?.status?.code === 500) {
            console.log("ingest service not available");
            return {
                message: "Ingest service is not available"
            }
        }

        return data;
    }

    async ingestWebPage(body: any, user: IUser, url: string) {

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/ingest-webpages`, {
                "bot_cuid": body.botId,
                "customer_cuid": user.teamId,
                "page_list": [url],
            })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));
        console.log("ingest gelen", data);
    }

    async ingestWebPages(body: any, user: IUser) {
        try {
            const { botId, urls, forceReingest } = body;

            const normalizedIncomingUrlMap = new Map<string, string>();
            for (const rawUrl of urls) {
                const normalizedUrl = this.normalizeComparableUrl(rawUrl);
                if (normalizedUrl && !normalizedIncomingUrlMap.has(normalizedUrl)) {
                    normalizedIncomingUrlMap.set(normalizedUrl, rawUrl);
                }
            }

            const existingWebpages = await this.prisma.content.findMany({
                where: {
                    teamId: user.teamId,
                    botId,
                    type: 'WEBPAGE',
                    isDeleted: false,
                },
                select: {
                    id: true,
                    content: true,
                }
            });

            const existingByNormalizedUrl = new Map<string, { id: string; url: string }>();
            for (const item of existingWebpages) {
                const contentUrl = this.normalizeComparableUrl((item.content as any)?.url);
                if (contentUrl && !existingByNormalizedUrl.has(contentUrl)) {
                    existingByNormalizedUrl.set(contentUrl, {
                        id: item.id,
                        url: (item.content as any)?.url,
                    });
                }
            }

            const duplicateUrls: string[] = [];
            const newUrls: string[] = [];

            normalizedIncomingUrlMap.forEach((rawUrl, normalizedUrl) => {
                if (existingByNormalizedUrl.has(normalizedUrl)) {
                    duplicateUrls.push(rawUrl);
                } else {
                    newUrls.push(rawUrl);
                }
            });

            if (duplicateUrls.length > 0 && !forceReingest) {
                return {
                    success: false,
                    duplicate: true,
                    duplicates: duplicateUrls,
                    message: `${duplicateUrls.length} URL already exists.`
                };
            }

            const urlsToIngest = [...newUrls, ...duplicateUrls];
            if (urlsToIngest.length === 0) {
                return {
                    success: false,
                    message: 'No valid URLs to ingest.'
                };
            }

            // Check quota
            const quota = await this.getQuota(user.teamId);
            if (quota.remaining < newUrls.length) {
                return {
                    success: false,
                    message: `Insufficient quota. You can add ${quota.remaining} more pages, but you're trying to add ${newUrls.length}.`
                };
            }

            // Send to ingest service first — only persist if successful
            const ingestUrl = this.configService.get('INGEST_ENPOINT');
            const { data } = await firstValueFrom(
                this.httpService.post(`${ingestUrl}/ingest-webpages`, {
                    "bot_cuid": botId,
                    "customer_cuid": user.teamId,
                    "page_list": urlsToIngest,
                })
                    .pipe(
                        catchError((error: AxiosError) => {
                            console.log("ingestWebPages error", error);
                            throw 'An error happened!';
                        }),
                    )
            );

            console.log("ingest response", data);

            // Create content records for new URLs after successful ingest
            for (const url of newUrls) {
                await this.prisma.content.create({
                    data: {
                        teamId: user.teamId,
                        botId: botId,
                        type: 'WEBPAGE',
                        content: { url },
                        status: 'UPLOADED',
                        taskId: '',
                        ingestionInfo: {},
                        createdAt: new Date(),
                    }
                });
            }

            // Re-mark existing duplicate URLs as UPLOADED if user confirmed re-ingest
            if (duplicateUrls.length > 0 && forceReingest) {
                for (const duplicateUrl of duplicateUrls) {
                    const normalizedDuplicateUrl = this.normalizeComparableUrl(duplicateUrl);
                    if (!normalizedDuplicateUrl) continue;
                    const existing = existingByNormalizedUrl.get(normalizedDuplicateUrl);
                    if (!existing) continue;

                    await this.prisma.content.update({
                        where: { id: existing.id },
                        data: {
                            status: 'UPLOADED',
                            taskId: '',
                            ingestionInfo: {},
                            updatedAt: new Date(),
                        },
                    });
                }
            }

            // Update quota after successful ingest + DB writes
            const currentQuota = await this.prisma.quota.findFirst({
                where: { teamId: user.teamId, quotaType: 'FILE' }
            });

            if (currentQuota) {
                await this.prisma.quota.update({
                    where: { id: currentQuota.id },
                    data: { used: currentQuota.used + newUrls.length }
                });
            }

            return {
                success: true,
                message: 'Web pages ingestion started',
                count: urlsToIngest.length,
                duplicatesReingested: duplicateUrls.length,
            };

        } catch (error) {
            console.error('Error ingesting web pages:', error);
            return {
                success: false,
                message: 'Error starting ingestion'
            };
        }
    }

    async ingestQA(body: any, user: IUser) {

        console.log("ingestQA body", body);

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/store-qa-pairs-bulk`, {
                "bot_cuid": body.botId,
                "customer_cuid": user.teamId,
                "qa_pairs": [
                    {
                        "question": body.content.question,
                        "answer": body.content.answer,
                        "metadata": {
                            "category": body.content.meta.category,
                            "source": body.content.meta.source
                        },
                    }
                ],
            })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));

        console.log("ingestQA gelen", data);
    }

    async ingestContent(body: any, user: IUser) {

        console.log("ingestContent body", body);

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/store-qa-pair`, {
                "bot_cuid": body.botId,
                "customer_cuid": user.teamId,
                "question": body.content.meta.source,
                "answer": body.content.data,
                "metadata": {
                    "type": "CONTENT",
                    "category": body.content.meta.category,
                    "source": body.content.meta.source,
                    "title": body.content.meta.title
                },
            })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));

        console.log("ingestQA gelen", data);

    }

    async ingestVideo(body: any, user: IUser, url: string) {
        // TODO: Implement video ingestion
        console.log("ingestVideo: not implemented", url);
        return { message: 'Video ingestion not yet supported' };
    }

    // Helper: URL normalization
    private normalizeComparableUrl(urlString: string): string | null {
        try {
            const parsed = new URL(urlString.trim());
            parsed.hash = '';
            parsed.hostname = parsed.hostname.toLowerCase();
            let normalized = parsed.href;
            if (normalized.endsWith('/') && parsed.pathname !== '/') {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        } catch {
            return null;
        }
    }

    // Helper: URL normalization
    private normalizeUrl(urlString: string, baseUrl: string): string | null {
        try {
            const url = new URL(urlString, baseUrl);
            // Remove fragment and normalize
            url.hash = '';
            // Remove trailing slash for consistency
            let normalized = url.href;
            if (normalized.endsWith('/') && url.pathname !== '/') {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        } catch (err) {
            return null;
        }
    }

    // Helper: Check if URL should be crawled
    private shouldCrawlUrl(url: string, baseDomain: string): boolean {
        try {
            const urlObj = new URL(url);
            const baseObj = new URL(baseDomain);

            // Same domain check
            if (urlObj.hostname !== baseObj.hostname) {
                return false;
            }

            // Skip common non-HTML resources
            const skipExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.css', '.js', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.zip', '.rar'];
            if (skipExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext))) {
                return false;
            }

            return true;
        } catch (err) {
            return false;
        }
    }

    // Fetch and parse robots.txt
    private async fetchRobotsTxt(domain: string): Promise<string[]> {
        try {
            const url = domain.startsWith('http') ? domain : `https://${domain}`;
            const robotsUrl = `${url}/robots.txt`;

            const { data } = await firstValueFrom(
                this.httpService.get(robotsUrl).pipe(
                    catchError((error: AxiosError) => {
                        throw error;
                    }),
                )
            );

            // Parse robots.txt for sitemap URLs
            const sitemapUrls: string[] = [];
            const lines = data.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.toLowerCase().startsWith('sitemap:')) {
                    const sitemapUrl = trimmed.substring(8).trim();
                    if (sitemapUrl) {
                        sitemapUrls.push(sitemapUrl);
                    }
                }
            }

            return sitemapUrls;
        } catch (err) {
            return [];
        }
    }

    // Parse sitemap XML
    private async parseSitemap(sitemapUrl: string, depth: number = 0): Promise<string[]> {
        const MAX_DEPTH = 3;
        if (depth > MAX_DEPTH) {
            console.log(`parseSitemap: max depth ${MAX_DEPTH} reached, skipping ${sitemapUrl}`);
            return [];
        }
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(sitemapUrl).pipe(
                    catchError((error: AxiosError) => {
                        throw error;
                    }),
                )
            );

            const $ = cheerio.load(data, { xmlMode: true });
            const urls: string[] = [];

            // Extract URLs from sitemap
            $('url loc').each((i, elem) => {
                const url = $(elem).text().trim();
                if (url) {
                    urls.push(url);
                }
            });

            // Handle sitemap index (nested sitemaps)
            const subSitemaps: string[] = [];
            $('sitemap loc').each((i, elem) => {
                const subSitemapUrl = $(elem).text().trim();
                if (subSitemapUrl) {
                    subSitemaps.push(subSitemapUrl);
                }
            });

            // Recursively fetch sub-sitemaps (with depth limit)
            for (const subSitemapUrl of subSitemaps) {
                const subUrls = await this.parseSitemap(subSitemapUrl, depth + 1);
                urls.push(...subUrls);
            }

            return urls;
        } catch (err) {
            return [];
        }
    }

    // Manual crawler - discovers URLs by crawling the website
    private async crawlWebsite(seedUrl: string, maxPages: number = 50): Promise<string[]> {
        const visited = new Set<string>();
        const queue: string[] = [seedUrl];
        const discoveredUrls: string[] = [];

        while (queue.length > 0 && visited.size < maxPages) {
            const currentUrl = queue.shift();
            if (!currentUrl || visited.has(currentUrl)) {
                continue;
            }

            visited.add(currentUrl);

            try {
                // Fetch the page
                const { data } = await firstValueFrom(
                    this.httpService.get(currentUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; ChatbuBot/1.0)'
                        },
                        timeout: 10000
                    }).pipe(
                        catchError((error: AxiosError) => {
                            throw error;
                        }),
                    )
                );

                // Only process HTML responses
                if (typeof data === 'string' && data.includes('<html')) {
                    discoveredUrls.push(currentUrl);

                    // Parse links from the page
                    const $ = cheerio.load(data);
                    $('a[href]').each((i, elem) => {
                        const href = $(elem).attr('href');
                        if (href) {
                            const normalizedUrl = this.normalizeUrl(href, currentUrl);
                            if (normalizedUrl &&
                                !visited.has(normalizedUrl) &&
                                this.shouldCrawlUrl(normalizedUrl, seedUrl)) {
                                queue.push(normalizedUrl);
                            }
                        }
                    });
                }
            } catch (err: any) {
                console.log(`Failed to crawl ${currentUrl}:`, err.message);
                // Continue with next URL
            }

            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return discoveredUrls;
    }

    async fetchSitemap(domain: string, maxCrawlPages: number = 50) {
        try {
            const url = domain.startsWith('http') ? domain : `https://${domain}`;
            let urls: string[] = [];
            let method = '';

            // Step 1: Check robots.txt for sitemap
            console.log('Checking robots.txt for sitemap...');
            const robotsSitemaps = await this.fetchRobotsTxt(url);

            if (robotsSitemaps.length > 0) {
                console.log(`Found ${robotsSitemaps.length} sitemap(s) in robots.txt`);
                for (const sitemapUrl of robotsSitemaps) {
                    const sitemapUrls = await this.parseSitemap(sitemapUrl);
                    urls.push(...sitemapUrls);
                }
                if (urls.length > 0) {
                    method = 'robots.txt';
                }
            }

            // Step 2: Try common sitemap locations if robots.txt didn't work
            if (urls.length === 0) {
                console.log('Trying common sitemap locations...');
                const commonSitemapUrls = [
                    `${url}/sitemap.xml`,
                    `${url}/sitemap_index.xml`,
                    `${url}/sitemap1.xml`,
                ];

                for (const sitemapUrl of commonSitemapUrls) {
                    const sitemapUrls = await this.parseSitemap(sitemapUrl);
                    if (sitemapUrls.length > 0) {
                        urls.push(...sitemapUrls);
                        method = 'common location';
                        break;
                    }
                }
            }

            // Step 3: Manual crawling if no sitemap found
            if (urls.length === 0) {
                console.log('No sitemap found, starting manual crawl...');
                urls = await this.crawlWebsite(url, maxCrawlPages);
                method = 'manual crawl';
            }

            // Remove duplicates
            urls = [...new Set(urls)];

            return {
                success: urls.length > 0,
                message: urls.length > 0
                    ? `Found ${urls.length} URLs using ${method}`
                    : 'No URLs found',
                method,
                urls,
                count: urls.length
            };

        } catch (error) {
            console.error('Error fetching sitemap:', error);
            return {
                success: false,
                message: 'Error fetching sitemap',
                method: 'error',
                urls: []
            };
        }
    }

    async getQuota(teamId: string) {
        try {
            const quotas = await this.quotaService.list(teamId);
            const fileQuota = quotas.find(q => q.quotaType === 'FILE');
            const [activeDocuments, activeContents] = await Promise.all([
                this.prisma.storage.count({
                    where: {
                        teamId,
                        isDeleted: false,
                    },
                }),
                this.prisma.content.findMany({
                    where: {
                        teamId,
                        isDeleted: false,
                    },
                    select: {
                        type: true,
                        content: true,
                    },
                }),
            ]);

            // URL-based vault items are counted by distinct URL across WEBPAGE/LINK variants.
            const urlTypeSet = new Set(['webpage', 'link']);
            const distinctUrlSet = new Set<string>();
            let nonUrlContentCount = 0;

            for (const item of activeContents) {
                const contentType = (item.type || '').toLowerCase();
                if (urlTypeSet.has(contentType)) {
                    const normalizedUrl = this.normalizeComparableUrl((item.content as any)?.url);
                    if (normalizedUrl) {
                        distinctUrlSet.add(normalizedUrl);
                        continue;
                    }
                }
                nonUrlContentCount += 1;
            }

            const used = activeDocuments + nonUrlContentCount + distinctUrlSet.size;

            if (!fileQuota) {
                return {
                    limit: 0,
                    used,
                    remaining: 0
                };
            }

            const remaining = Math.max(fileQuota.limit - used, 0);

            return {
                limit: fileQuota.limit,
                used,
                remaining
            };
        } catch (error) {
            console.error('Error fetching quota:', error);
            return {
                limit: 0,
                used: 0,
                remaining: 0
            };
        }
    }
}

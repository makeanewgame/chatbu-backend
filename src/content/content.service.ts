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

@Injectable()
export class ContentService {
    constructor(
        // Inject any required services here
        private prisma: PrismaService,
        private configService: ConfigService,
        private httpService: HttpService,
        private quotaService: QuotaService,

    ) { }

    async createContent(body: any, user: IUser) {
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

        if (user.sub && !findUser) {
            return {
                message: "User or Bot not found"
            }
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

        if (body.type === 'WEBPAGE') {
            console.log("webpage content ingest started", body.type);
            await this.ingestWebPage(body, user, body.content.url);
        }

        if (body.type === 'VIDEO') {
            console.log("webpage content ingest started", body.type);
            await this.ingestWebPage(body, user, body.content.url);
        }

        if (body.type === 'LINK') {
            console.log("link content ingest started", body.type);
            await this.ingestWebPage(body, user, body.content.url);
        }

        if (body.type === 'Q&A') {
            console.log("Q&A content ingest started", body.type);
            await this.ingestQA(body, user);
        }

        if (body.type === 'CONTENT') {
            console.log("Q&A content ingest started", body.type);
            await this.ingestContent(body, user);
        }

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

            if (user.sub && !findUser) {
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
            return {
                message: "Content deleted successfully"
            }

        } catch (err) {
            console.log("deleteContent error", err);
            return {
                message: "Error deleting content"
            }

        }
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

            if (user.sub && !findUser) {
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

            //Delete existing vectors for the content
            await this.deleteIngestedContent(body.botId, user, body.content.meta.source);

            // Re-ingest the updated content
            await this.ingestQA(body, user);

            return {
                message: "Content edited successfully"
            }
        } catch (err) {
            console.log("editContent error", err);
            return {
                message: "Error editing content"
            }
        }
    }

    async deleteIngestedContent(botId: string, user: IUser, sourceId: string) {
        //Vector DB den de silinecek
        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        console.log("Deleting vectors for content sourceId", sourceId);

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
            const { botId, urls } = body;

            // Check quota
            const quota = await this.getQuota(user.teamId);
            if (quota.remaining < urls.length) {
                return {
                    success: false,
                    message: `Insufficient quota. You can add ${quota.remaining} more pages, but you're trying to add ${urls.length}.`
                };
            }

            // Create content records for each URL
            const contentRecords = [];
            for (const url of urls) {
                const content = await this.prisma.content.create({
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
                contentRecords.push(content);
            }

            // Update quota
            const currentQuota = await this.prisma.quota.findFirst({
                where: {
                    teamId: user.teamId,
                    quotaType: 'FILE'
                }
            });

            if (currentQuota) {
                await this.prisma.quota.update({
                    where: { id: currentQuota.id },
                    data: { used: currentQuota.used + urls.length }
                });
            }

            // Send to ingest service
            const ingestUrl = this.configService.get('INGEST_ENPOINT');
            const { data } = await firstValueFrom(
                this.httpService.post(`${ingestUrl}/ingest-webpages`, {
                    "bot_cuid": botId,
                    "customer_cuid": user.teamId,
                    "page_list": urls,
                })
                    .pipe(
                        catchError((error: AxiosError) => {
                            console.log("error", error);
                            throw 'An error happened!';
                        }),
                    )
            );

            console.log("ingest response", data);

            return {
                success: true,
                message: 'Web pages ingestion started',
                count: urls.length
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

        //body.content.data 'yı sadece text olacak şekilde parse etmemiz gerekebilir


        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        // const { data } = await firstValueFrom(
        //     this.httpService.post(`${ingestUrl}/store-qa-pairs-bulk`, {
        //         "bot_cuid": body.botId,
        //         "customer_cuid": user.teamId,
        //         "qa_pairs": [
        //             {
        //                 "data": body.content.data,
        //                 "metadata": {
        //                     "category": body.content.meta.category,
        //                     "source": body.content.meta.source
        //                 },
        //             }
        //         ],
        //     })
        //         .pipe(
        //             catchError((error: AxiosError) => {
        //                 console.log("error", error);
        //                 throw 'An error happened!';
        //             }),
        //         ));

        //console.log("ingestQA gelen", data);

    }

    async ingestVideo(body: any, user: IUser, url: string) {

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        console.log("ingest Video not implemented yet");
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
    private async parseSitemap(sitemapUrl: string): Promise<string[]> {
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

            // Recursively fetch sub-sitemaps
            for (const subSitemapUrl of subSitemaps) {
                const subUrls = await this.parseSitemap(subSitemapUrl);
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
            } catch (err) {
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

            if (!fileQuota) {
                return {
                    limit: 0,
                    used: 0,
                    remaining: 0
                };
            }

            return {
                limit: fileQuota.limit,
                used: fileQuota.used,
                remaining: fileQuota.limit - fileQuota.used
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

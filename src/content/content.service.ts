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
            await this.ingestQA(body, user);
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

            //Vector DB den de silinecek
            const ingestUrl = this.configService.get('INGEST_ENPOINT')

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

    async ingestVideo(body: any, user: IUser, url: string) {

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        console.log("ingest Video not implemented yet");
    }

    async fetchSitemap(domain: string) {
        try {
            // Ensure domain has protocol
            const url = domain.startsWith('http') ? domain : `https://${domain}`;

            // Try common sitemap locations
            const sitemapUrls = [
                `${url}/sitemap.xml`,
                `${url}/sitemap_index.xml`,
                `${url}/sitemap1.xml`,
            ];

            let sitemapData = null;
            let sitemapUrl = null;

            for (const testUrl of sitemapUrls) {
                try {
                    const { data } = await firstValueFrom(
                        this.httpService.get(testUrl).pipe(
                            catchError((error: AxiosError) => {
                                throw error;
                            }),
                        )
                    );
                    sitemapData = data;
                    sitemapUrl = testUrl;
                    break;
                } catch (err) {
                    continue;
                }
            }

            if (!sitemapData) {
                return {
                    success: false,
                    message: 'Sitemap not found',
                    urls: []
                };
            }

            // Parse sitemap XML
            const $ = cheerio.load(sitemapData, { xmlMode: true });
            const urls: string[] = [];

            // Extract URLs from sitemap
            $('url loc').each((i, elem) => {
                const url = $(elem).text().trim();
                if (url) {
                    urls.push(url);
                }
            });

            // If it's a sitemap index, recursively fetch sub-sitemaps
            $('sitemap loc').each((i, elem) => {
                const subSitemapUrl = $(elem).text().trim();
                // TODO: Recursively fetch sub-sitemaps if needed
            });

            return {
                success: true,
                message: 'Sitemap fetched successfully',
                sitemapUrl,
                urls,
                count: urls.length
            };

        } catch (error) {
            console.error('Error fetching sitemap:', error);
            return {
                success: false,
                message: 'Error fetching sitemap',
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
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { IUser } from 'src/util/interfaces';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, } from 'rxjs';
import { AxiosError } from 'axios';
import { FileStorageType } from 'src/minio-client/file.model';

@Injectable()
export class ContentService {
    constructor(
        // Inject any required services here
        private prisma: PrismaService,
        private configService: ConfigService,
        private httpService: HttpService,

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

        if (body.type === 'Q&A') {
            console.log("Q&A content ingest started", body.type);
            await this.ingestQA(body, user);
        }

        if (body.type === 'CONTENT') {
            console.log("CONTENT ingest started", body.type);
            await this.ingestWebPage(body, user, body.content.url);
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

    async deleteContent(user: IUser, contentId: string) {

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

        await this.prisma.content.delete({
            where: {
                id: contentId
            }
        })

        return {
            message: "Content deleted successfully"
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
}

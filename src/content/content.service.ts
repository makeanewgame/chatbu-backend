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
                id: user.sub,
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
                teamId: user.sub,
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
            await this.ingestWebPage(body, user, body.content.url);
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
                teamId: user.sub,
                type: type,
            }
        })
        return content;
    }

    async deleteContent(user: IUser, contentId: string) {

        const findUser = await this.prisma.team.findFirst({
            where: {
                id: user.sub,
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
                "customer_cuid": user.sub,
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
}

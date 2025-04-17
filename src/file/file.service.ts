import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { UploadSingleFileRequest } from './dto/uploadfile.request';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, } from 'rxjs';
import { AxiosError } from 'axios';
import { FileStorageType } from 'src/minio-client/file.model';
import { IngestRequest } from './dto/ingestRequest';
import { IUser } from 'src/util/interfaces';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';


@Injectable()
export class FileService {
    constructor(
        private minioClientService: MinioClientService,
        private configService: ConfigService,
        private prisma: PrismaService,
        private httpService: HttpService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,

    ) { }

    async uploadSingle(files: Array<Express.Multer.File>, user: IUser, body: UploadSingleFileRequest) {

        const lockKey = `quota-lock:${user.sub}`;
        const existingLock = await this.cacheManager.get(lockKey);
        if (existingLock) {
            throw new ConflictException('Quota check is already in progress. Please try again later.');
        }

        await this.cacheManager.set(lockKey, true, 60); // Set a lock for 10 seconds

        try {
            const returnObject = [];

            const existingQuota = await this.prisma.user.findFirst({
                where: {
                    id: user.sub,
                    Quota: {
                        some: {
                            quotaType: 'FILE',
                        }
                    }
                },
                include: {
                    Quota: {
                        where: {
                            quotaType: 'FILE',
                        }
                    }
                },
            })

            if (!existingQuota) {
                return {
                    message: "User not found"
                }
            }

            if (existingQuota.Quota[0].used + files.length > existingQuota.Quota[0].limit) {
                return {
                    message: "Quota exceeded",
                    limit: existingQuota.Quota[0].limit,
                    used: existingQuota.Quota[0].used,
                    remaining: existingQuota.Quota[0].limit - existingQuota.Quota[0].used
                }
            }
            console.log("filesLength", files.length, " used..:", existingQuota.Quota[0].used)
            //async function to upload files
            for (const file of files) {
                const uploaded_file = await this.minioClientService.upload(file, this.configService.get('S3_BUCKET_NAME'), user.sub, body.botId)

                await this.prisma.storage.create({
                    data: {
                        userId: user.sub,
                        botId: body.botId,
                        fileUrl: uploaded_file.url,
                        type: file.mimetype,
                        size: file.size.toString(),
                        status: 'UPLOADED',
                        ingestionInfo: {},
                        taskId: '',
                        fileName: file.originalname,
                        createdAt: new Date(),
                    }
                })

                returnObject.push({
                    fileName: file.originalname,
                    fileUrl: uploaded_file.url,
                    message: "Successfully uploaded"
                })
            }

            await this.prisma.user.update({
                where: {
                    id: user.sub,
                    Quota: {
                        some: {
                            quotaType: 'FILE',
                        }
                    }
                },
                data: {
                    Quota: {
                        update: {
                            where: {
                                userId_quotaType: {
                                    userId: user.sub,
                                    quotaType: 'FILE'
                                }
                            },
                            data: {
                                used: (existingQuota.Quota[0].used + files.length)
                            }
                        }
                    }
                }
            })
            return returnObject;
        }
        finally {
            await this.cacheManager.del(lockKey); // Release the lock
        }

    }

    async delete(fileId: string, user: IUser) {

        const file = await this.prisma.storage.findFirst({
            where: {
                userId: user.sub,
                id: fileId
            }
        });

        if (!file) {
            return {
                message: "File not found"
            }
        }

        interface MinioDeleteResponse {
            deleteMarker?: boolean;
            versionId?: string;
        }


        const minioFileName = file.fileUrl.split('/').pop()

        try {
            await this.minioClientService.delete(file.fileUrl, this.configService.get('S3_BUCKET_NAME'))
                .then(async (res: MinioDeleteResponse) => {
                    // Success handling if needed
                    await this.prisma.storage.delete({
                        where: {
                            id: file.id
                        }
                    })

                    return {
                        message: "File deleted successfully"
                    }
                })
        }
        catch (err) {
            return {
                message: "File not found"
            }
        }
    }

    async getFiles(user: IUser, botId: string) {

        const fileList = await this.prisma.storage.findMany({
            where: {
                userId: user.sub ? user.sub : '',
                botId: botId ? botId : ''
            }
        })
        return fileList
    }

    async ingest(user: IUser, body: IngestRequest) {

        // return {
        //     message: "Ingest service is not available"
        // }

        const findUser = await this.prisma.user.findFirst({
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

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        //ingest servisi dosya tipine göre çağrılacak....

        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/ingest-documents`, {
                "bot_cuid": body.botId,
                "customer_cuid": user.sub,
                "file_extension": FileStorageType[body.type],
            }
            )
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));
        console.log("ingest gelen", data);
        return data;
    }

    async check() {

        const check = await this.minioClientService.check();


        if (check) {
            return {
                message: "File service is working"
            }
        }
        else {
            return {
                message: "File service is not working"
            }
        }
    }

    async getCollection(user: IUser, botId: string) {

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        const { data } = await firstValueFrom(
            this.httpService.get(`${ingestUrl}/collection-count`, {
                params: {
                    bot_cuid: botId,
                    customer_cuid: user.sub
                }
            })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));
        console.log("ingest collection-count gelen", data);
        return data;

    }

}

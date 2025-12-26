import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { UploadSingleFileRequest } from './dto/uploadfile.request';
import { PrismaService } from 'src/prisma/prisma.service';
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

        const lockKey = `quota-lock:${user.teamId}`;
        const existingLock = await this.cacheManager.get(lockKey);
        if (existingLock) {
            throw new ConflictException('Quota check is already in progress. Please try again later.');
        }

        await this.cacheManager.set(lockKey, true, 60); // Set a lock for 10 seconds

        try {
            const returnObject = [];

            const existingQuota = await this.prisma.team.findFirst({
                where: {
                    id: user.teamId,
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
                const uploaded_file = await this.minioClientService.upload(file, this.configService.get('S3_BUCKET_NAME'), user.teamId, body.botId)

                await this.prisma.storage.create({
                    data: {
                        teamId: user.teamId,
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

            await this.prisma.team.update({
                where: {
                    id: user.teamId,
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
                                teamId_quotaType: {
                                    teamId: user.teamId,
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


        const findUser = await this.prisma.team.findFirst({
            where: {
                id: user.teamId,
                Storage: {
                    some: {
                        id: fileId
                    }
                }
            }
        })

        if (user.sub && !findUser) {
            return {
                message: "User or Bot not found"
            }
        }

        const file = await this.prisma.storage.findFirst({
            where: {
                teamId: user.teamId,
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

                    const existingQuota = await this.prisma.team.findFirst({
                        where: {
                            id: user.teamId,
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

                    console.log("existingQuota", existingQuota);

                    const decreaseQuota = await this.prisma.team.update({
                        where: {
                            id: user.teamId,
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
                                        teamId_quotaType: {
                                            teamId: user.teamId,
                                            quotaType: 'FILE'
                                        }
                                    },
                                    data: {
                                        used: existingQuota.Quota[0].used - 1
                                    }
                                }
                            }
                        }
                    })

                    console.log("decreaseQuota", decreaseQuota);


                    //deLete from vector db
                    const ingestUrl = this.configService.get('INGEST_ENPOINT')

                    console.log("deleted Vectors data", {
                        "bot_cuid": file.botId,
                        "customer_cuid": user.teamId,
                        "source": file.fileUrl,
                    })

                    const { data } = await firstValueFrom(
                        this.httpService.post(`${ingestUrl}/delete-vectors`, {
                            "bot_cuid": file.botId,
                            "customer_cuid": user.teamId,
                            "source": file.fileUrl,
                        })
                            .pipe(
                                catchError((error: AxiosError) => {
                                    console.log("error", error);
                                    throw 'An error happened!';
                                }),
                            ));
                    // console.log("ingest collection-count gelen", data);

                    if (data?.status?.code === 500) {
                        console.log("ingest service not available");
                        return {
                            message: "Ingest service is not available"
                        }
                    }

                    console.log("deleted Vectors response", data);
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

        console.log("getFiles user.teamId", user.teamId);
        const fileList = await this.prisma.storage.findMany({
            where: {
                teamId: user.teamId ? user.teamId : '',
                botId: botId ? botId : ''
            }
        })
        return fileList
    }

    async ingest(user: IUser, body: IngestRequest) {

        // return {
        //     message: "Ingest service is not available"
        // }

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

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        //ingest servisi dosya tipine göre çağrılacak....

        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/ingest-documents`, {
                "bot_cuid": body.botId,
                "customer_cuid": user.teamId,
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
                    customer_cuid: user.teamId
                }
            })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.log("error", error);
                        throw 'An error happened!';
                    }),
                ));
        // console.log("ingest collection-count gelen", data);

        if (data?.status?.code === 500) {
            console.log("ingest service not available");
            return {
                message: "Ingest service is not available"
            }
        }


        const userStorage = await this.prisma.storage.count({
            where: {
                teamId: user.teamId,
                type: 'UPLOADED',
            }
        })
        console.log("ingest gelen", data);
        return { ...data, pending_count: userStorage };

    }

}

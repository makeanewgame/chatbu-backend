import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { UploadSingleFileRequest } from './dto/uploadfile.request';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, } from 'rxjs';
import { AxiosError } from 'axios';


@Injectable()
export class FileService {
    constructor(
        private minioClientService: MinioClientService,
        private configService: ConfigService,
        private prisma: PrismaService,
        private jwtService: JwtService,
        private httpService: HttpService
    ) { }

    async uploadSingle(files: Array<Express.Multer.File>, body: UploadSingleFileRequest) {

        const returnObject = [];
        //TODO: Implkement basebucket selection

        //async function to upload files
        for (const file of files) {
            const uploaded_file = await this.minioClientService.upload(file, this.configService.get('S3_BUCKET_NAME'), body.userId)

            await this.prisma.storage.create({
                data: {
                    userId: body.userId,
                    fileUrl: uploaded_file.url,
                    type: file.mimetype,
                    size: file.size.toString(),
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
        return returnObject;
    }

    async delete(fileId: string, accessToken: any) {

        const decodedToken = this.jwtService.decode(accessToken)
        const userId = decodedToken['sub']

        const file = await this.prisma.storage.findFirst({
            where: {
                userId: userId,
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
        console.log("minioFileName", minioFileName)

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

    async getFiles(userId: string) {

        const fileList = await this.prisma.storage.findMany({
            where: {
                userId: userId ? userId : ''
            }
        })
        return fileList
    }

    async ingest(userId: string) {

        const findUser = await this.prisma.user.findFirst({
            where: {
                id: userId
            }
        })

        if (userId && !findUser) {
            return {
                message: "User not found"
            }
        }

        const ingestUrl = this.configService.get('INGEST_ENPOINT')

        console.log("uuid", userId)
        const { data } = await firstValueFrom(
            this.httpService.post(`${ingestUrl}/ingest-documents/`, {
                uuid: userId
            }
            )
                .pipe(
                    catchError((error: AxiosError) => {
                        //this.logger.error(error.response.data);
                        console.log("error", error.response.data)
                        throw 'An error happened!';
                    }),
                ));
        console.log("ingest gelen", data);
        return data;
    }
}

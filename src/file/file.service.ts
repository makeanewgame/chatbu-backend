import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BufferedFile } from 'src/minio-client/file.model';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { UploadSingleFileRequest } from './dto/uploadfile.request';
import { PrismaService } from 'src/prisma/prisma.service';
import { Express } from 'express'
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class FileService {
    constructor(
        private minioClientService: MinioClientService,
        private configService: ConfigService,
        private prisma: PrismaService,
        private jwtService: JwtService
    ) { }

    async uploadSingle(files: Array<Express.Multer.File>, body: UploadSingleFileRequest) {

        const returnObject = [];
        //TODO: Implkement basebucket selection

        //async function to upload files
        for (const file of files) {
            const uploaded_file = await this.minioClientService.upload(file, this.configService.get('MINIO_BUCKET'), body.userId)

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
            await this.minioClientService.delete(file.fileUrl, this.configService.get('MINIO_BUCKET'))
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

}

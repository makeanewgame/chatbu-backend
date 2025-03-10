import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BufferedFile } from 'src/minio-client/file.model';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { UploadSingleFileRequest } from './dto/uploadfile.request';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FileService {
    constructor(
        private minioClientService: MinioClientService,
        private configService: ConfigService,
        private prisma: PrismaService
    ) { }

    async uploadSingle(file: BufferedFile, body: UploadSingleFileRequest) {

        //TODO: Implkement basebucket selection

        const uploaded_file = await this.minioClientService.upload(file, 'test')

        // this.db.insert(schema.storage).values({
        //     user_id: sql`cast(${body.user_id} as uuid)`,
        //     storageName: uploaded_file.filename,
        //     type: file.mimetype,
        //     size: file.size,
        //     fileName: file.name,
        // }).execute()

        console.log(uploaded_file)
        return {
            image_url: uploaded_file.url,
            filename: uploaded_file.filename,
            message: "Successfully uploaded"
        }
    }

    async uploadMultiple(images: BufferedFile[]) {
        let image_urls = []
        for (let image of images) {
            const uploaded_image = await this.minioClientService.upload(image, 'test')
            image_urls.push(uploaded_image.url)
        }
        return {
            image_urls: image_urls,
            message: "Successfully uploaded"
        }
    }

    async getFiles() {
        const data = []
        const files = await this.minioClientService.client.listObjects('test', '', true)
        files.on('data', function (obj) {
            data.push(obj)
        })
        files.on('end', function () {
            console.log(data)
        })
        files.on('error', function (err) {
            console.log(err)
        })
        return data
    }



}

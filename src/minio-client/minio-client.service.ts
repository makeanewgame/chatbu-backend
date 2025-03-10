import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import { BufferedFile, AppMimeType } from './file.model';
import * as crypto from 'crypto'
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioClientService {

    public get client(): any {
        return this.minio.client;
    }

    constructor(private readonly minio: MinioService, private configService: ConfigService) { }

    public async upload(file: BufferedFile, baseBucket: string) {


        // how to check if file.mimetype is instance of AppMimeType

        // Check if file.mimetype is a valid AppMimeType

        const isValidMimeType = file.mimetype.includes(file.mimetype as AppMimeType);

        if (!isValidMimeType) {
            throw new HttpException('Invalid file type', HttpStatus.BAD_REQUEST);
        }

        let temp_filename = Date.now().toString()
        let hashedFileName = crypto.createHash('md5').update(temp_filename).digest("hex");
        let ext = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
        const metaData = {
            'Content-Type': file.mimetype,
            'X-Amz-Meta-Testing': 1234,
        };
        let filename = hashedFileName + ext
        const fileName: string = `${filename}`;
        const fileBuffer = file.buffer;
        this.client.putObject(baseBucket, fileName, fileBuffer, metaData, function (err, res) {
            if (err) throw new HttpException('Error uploading file', HttpStatus.BAD_REQUEST)
        })

        return {
            url: `${this.configService.get('MINIO_ENDPOINT')}:${this.configService.get('MINIO_PORT')}/${this.configService.get('MINIO_BUCKET')}/${filename}`,
            filename: filename

        }
    }

    async delete(objetName: string, baseBucket: string) {
        this.client.removeObject(baseBucket, objetName, function (err, res) {
            if (err) throw new HttpException("Oops Something wrong happend", HttpStatus.BAD_REQUEST)
        })
    }
}

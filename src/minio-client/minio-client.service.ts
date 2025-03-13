import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import { BufferedFile, AppMimeType } from './file.model';
import * as crypto from 'crypto'
import { ConfigService } from '@nestjs/config';
import { Express } from 'express';

@Injectable()
export class MinioClientService {

    public get client(): any {
        return this.minio.client;
    }

    constructor(private readonly minio: MinioService, private configService: ConfigService) { }

    public async upload(file: Express.Multer.File, baseBucket: string, userId: string) {

        let userFolder = false
        //Check user directory created
        this.client.statObject(baseBucket, userId, function (err, stat) {
            if (err) {
                userFolder = false
            }
            else {
                userFolder = true
            }
        })
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
        let filename = userId + '/' + hashedFileName + ext
        const fileName: string = `${filename}`;
        const fileBuffer = file.buffer;
        this.client.putObject(baseBucket, fileName, fileBuffer, metaData, function (err, res) {
            if (err) throw new HttpException('Error uploading file', HttpStatus.BAD_REQUEST)
        })

        return {
            url: `${filename}`,
        }
    }

    async delete(objetName: string, baseBucket: string) {
        return this.client.removeObject(baseBucket, objetName, function (err, res) {
            if (err) throw new HttpException("Oops Something wrong happend", HttpStatus.BAD_REQUEST)
        })
    }
}

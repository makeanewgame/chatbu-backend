import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { MinioService } from 'nestjs-minio-client';
import { BufferedFile, AppMimeType, FileStorageType } from './file.model';
import * as crypto from 'crypto'
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioClientService {

    public get client(): any {
        return this.minio.client;
    }

    constructor(private readonly minio: MinioService, private configService: ConfigService) { }

    public async upload(file: Express.Multer.File, baseBucket: string, userId: string, botId: string): Promise<{ url: string }> {

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
        // uuid / customer-raw-documents / file type / file name
        let ext = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
        const metaData = {
            'Content-Type': file.mimetype,
            'X-Amz-Meta-Testing': 1234,
        };
        let filename = userId + '/' + botId + '/' + FileStorageType[file.mimetype] + '/' + hashedFileName + ext
        const fileName: string = `${filename}`;
        const fileBuffer = file.buffer;
        await new Promise<void>((resolve, reject) => {
            this.client.putObject(baseBucket, fileName, fileBuffer, metaData, function (err) {
                if (err) {
                    console.log(err)
                    reject(new HttpException("Oops Something wrong happend", HttpStatus.BAD_REQUEST))
                } else {
                    resolve()
                }
            })
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

    public async uploadChatAttachment(
        file: Express.Multer.File,
        baseBucket: string,
        botId: string,
    ): Promise<{ objectPath: string; presignedUrl: string }> {
        const temp_filename = Date.now().toString();
        const hashedFileName = crypto.createHash('md5').update(temp_filename).digest('hex');
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
        const metaData = { 'Content-Type': file.mimetype };
        const objectPath = `users_upload/${botId}/${hashedFileName}${ext}`;

        await new Promise<void>((resolve, reject) => {
            this.client.putObject(baseBucket, objectPath, file.buffer, metaData, function (err) {
                if (err) {
                    reject(new HttpException('Upload failed', HttpStatus.BAD_REQUEST));
                } else {
                    resolve();
                }
            });
        });

        const presignedUrl = await this.getPresignedUrl(objectPath, baseBucket);
        return { objectPath, presignedUrl };
    }

    async getPresignedUrl(objectName: string, baseBucket: string, expirySeconds: number = 3600): Promise<string> {
        return new Promise((resolve, reject) => {
            this.client.presignedGetObject(baseBucket, objectName, expirySeconds, (err: Error, url: string) => {
                if (err) {
                    reject(new HttpException('Could not generate presigned URL', HttpStatus.INTERNAL_SERVER_ERROR));
                } else {
                    resolve(url);
                }
            });
        });
    }

    async check() {
        const bucket = this.configService.get('S3_BUCKET_NAME');

        if (!bucket) {
            throw new Error('S3_BUCKET_NAME is not configured');
        }

        try {
            return await this.client.bucketExists(bucket);
        }
        catch (err: any) {
            const message = err?.message || 'Unknown S3 error';
            throw new Error(`S3 health check failed for bucket ${bucket}: ${message}`);
        }
    }

}

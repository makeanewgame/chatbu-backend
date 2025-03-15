import { Controller, UseInterceptors, Post, Body, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, UploadedFiles, Get, UseGuards, Req, Param } from '@nestjs/common';
import { FileService } from './file.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { CustomMaxFileSizeValidator } from './customFileValidator';

@Controller('file')
export class FileController {
    constructor(private fileService: FileService) { }

    @Post('upload')
    @UseGuards(AccessTokenGuard)
    @UseInterceptors(AnyFilesInterceptor({
        fileFilter: (_, file, cb) => {
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
            cb(null, true);
        },
    }))
    async uploadSingle(@Body() body: any, @UploadedFiles(
        new ParseFilePipe({
            validators: [
                new CustomMaxFileSizeValidator({ maxSize: 10000000 }),
                new FileTypeValidator({
                    fileType: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/plain)$/,
                })
            ]
        })
    ) files: Array<Express.Multer.File>) {
        return await this.fileService.uploadSingle(files, body)
    }

    @Post('delete')
    @UseGuards(AccessTokenGuard)
    async delete(@Req() req: Request, @Body() body: { id: string }) {
        const accessToken = req.headers['authorization']?.split(' ')[1];

        return await this.fileService.delete(body.id, accessToken)
    }

    @Get('getFiles')
    @UseGuards(AccessTokenGuard)
    async getFiles(@Req() req: Request) {
        const { user } = req.query;
        return await this.fileService.getFiles(user as string)
    }

    @Post('ingest')
    @UseGuards(AccessTokenGuard)
    async ingest(@Body() body: { user: string }) {
        return await this.fileService.ingest(body.user)
    }

    @Get('check')
    async check() {
        return await this.fileService.check()

    }
}   

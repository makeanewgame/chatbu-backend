import { Controller, UseInterceptors, Post, Body, ParseFilePipe, FileTypeValidator, UploadedFiles, Get, UseGuards, Req } from '@nestjs/common';
import { FileService } from './file.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from 'src/authentication/utils/accesstoken.guard';
import { Request } from 'express';
import { CustomMaxFileSizeValidator } from './customFileValidator';
import { IngestRequest } from './dto/ingestRequest';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UploadSingleFileRequest } from './dto/uploadfile.request';
import { IUser } from 'src/util/interfaces';

@Controller('file')
export class FileController {
    constructor(private fileService: FileService) { }

    //#region upload

    @ApiOperation({ summary: 'Upload files to minio , approved file formats: png, jpeg, jpg, gif, svg, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, csv, txt, md, json ' })
    @ApiResponse({
        status: 200,
        description: 'Files uploaded successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                files: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
            required: ['botId', 'files'],
        },
    })

    @Post('upload')
    @UseGuards(AccessTokenGuard)
    @UseInterceptors(AnyFilesInterceptor({
        fileFilter: (_, file, cb) => {
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
            cb(null, true);
        },
    }))
    async uploadSingle(@Req() req: Request, @Body() body: UploadSingleFileRequest, @UploadedFiles(
        new ParseFilePipe({
            validators: [
                new CustomMaxFileSizeValidator({ maxSize: 10000000 }),
                new FileTypeValidator({
                    fileType: /^(application\/pdf|application\/msword|application\/json|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/plain|text\/markdown)$/,
                })
            ]
        })
    ) files: Array<Express.Multer.File>) {
        const user = req.user as IUser;
        return await this.fileService.uploadSingle(files, user, body)
    }
    //#endregion

    //#region delete
    @ApiOperation({ summary: 'Delete file from minio and db' })
    @ApiResponse({
        status: 200,
        description: 'File deleted successfully',
    })
    @ApiBearerAuth()
    @Post('delete')
    @UseGuards(AccessTokenGuard)
    async delete(@Req() req: Request, @Body() body: { id: string }) {

        const user = req.user as IUser;
        return await this.fileService.delete(body.id, user)
    }
    //#endregion

    //#region getFiles
    @ApiOperation({ summary: 'Get files list for user and selected bot' })
    @ApiResponse({
        status: 200,
        description: 'List of files',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiParam({
        name: 'botId',
        description: 'Bot ID in uuid format',
        required: true,
        type: String,
    })
    @Get('getFiles')
    @UseGuards(AccessTokenGuard)
    async getFiles(@Req() req: Request) {
        const user = req.user as IUser;
        const { botId } = req.query;
        return await this.fileService.getFiles(user, botId as string)
    }
    //#endregion

    //#region ingest
    @ApiOperation({ summary: 'Ingest documents to vector database with file type and botId' })
    @ApiResponse({
        status: 200,
        description: 'Ingested successfully',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
                type: { type: 'string' },
            },
            required: ['botId', 'type'],
        },
    })
    @Post('ingest')
    @UseGuards(AccessTokenGuard)
    async ingest(@Req() req: Request, @Body() body: IngestRequest) {
        const user = req.user as IUser;
        return await this.fileService.ingest(user, body)
    }
    //#endregion

    //#region  check
    @ApiOperation({ summary: 'Check minio service is online' })
    @ApiResponse({
        status: 200,
        description: "File service is working",
    })
    @ApiBadRequestResponse({
        description: "File service is not working"
    })
    @ApiBearerAuth()
    @Get('check')
    @UseGuards(AccessTokenGuard)
    async check() {
        return await this.fileService.check()
    }
    //#endregion

    //#region getCollection
    @ApiOperation({ summary: 'Get user collections from ingest documents. Counts, charcters etc.' })
    @ApiResponse({
        status: 200,
        description: 'List user uploaded documents collections details',
    })
    @ApiBadRequestResponse({
        description: 'Bad request in payload',
    })
    @ApiBearerAuth()
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                botId: { type: 'string' },
            },
            required: ['botId'],
        },
    })
    @Post('getCollection')
    @UseGuards(AccessTokenGuard)
    async getCollection(@Req() req: Request, @Body() body: { botId: string }) {
        const user = req.user as IUser;

        return await this.fileService.getCollection(user, body.botId)
    }
    //#endregion

}   

import { Controller, UseInterceptors, Post, UploadedFile, Get, Body } from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BufferedFile } from 'src/minio-client/file.model';
import { UploadSingleFileRequest } from './dto/uploadfile.request';

@Controller('file-upload')
export class FileController {
    constructor(private fileService: FileService) { }

    @Post('single')
    @UseInterceptors(FileInterceptor('image'))
    async uploadSingle(@Body() body: UploadSingleFileRequest, @UploadedFile() file: BufferedFile) {
        return await this.fileService.uploadSingle(file, body)
    }

    @Post('multiple')
    @UseInterceptors(FileInterceptor('images'))
    async uploadMultiple(@UploadedFile() images: BufferedFile[]) {
        return await this.fileService.uploadMultiple(images)
    }

    @Get('files')
    async getFiles() {
        return await this.fileService.getFiles()
    }


}

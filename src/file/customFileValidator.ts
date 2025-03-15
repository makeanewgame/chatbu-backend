import { MaxFileSizeValidator, FileValidator } from '@nestjs/common';

export class CustomMaxFileSizeValidator extends FileValidator {
    private maxSize: number;

    constructor(options: { maxSize: number }) {
        super({ validationOptions: {} });
        this.maxSize = options.maxSize;
    }

    isValid(file: Express.Multer.File): boolean {
        return file.size <= this.maxSize;
    }

    buildErrorMessage(file: Express.Multer.File): string {
        return `File '${file.originalname}' is too large. Maximum size is ${this.maxSize} bytes, but got ${file.size} bytes`;
    }
}
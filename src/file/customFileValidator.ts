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

export class CustomFileTypeValidator extends FileValidator {
    private allowedMimeTypes: string[];
    private allowedExtensions: string[];

    constructor() {
        super({ validationOptions: {} });
        // Allowed MIME types
        this.allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
        ];
        // Allowed file extensions
        this.allowedExtensions = ['.txt', '.pdf', '.doc', '.docx', '.csv', '.xls', '.xlsx'];
    }

    isValid(file: Express.Multer.File): boolean {
        if (!file) return false;

        // Check file extension
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        const extensionValid = this.allowedExtensions.includes(fileExtension);

        // Check MIME type
        const mimeTypeValid = this.allowedMimeTypes.includes(file.mimetype);

        // Accept if either extension or MIME type is valid
        return extensionValid || mimeTypeValid;
    }

    buildErrorMessage(file: Express.Multer.File): string {
        return `File '${file.originalname}' has invalid type. Only txt, pdf, docx, doc, csv, xls, xlsx files are allowed. Detected type: ${file.mimetype}`;
    }
}
export interface BufferedFile {
    name: string,
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: AppMimeType;
    size: number;
    buffer: Buffer | string;
}

export interface StoredFile extends HasFile, StoredFileMetadata { }

export interface HasFile {
    file: Buffer | string;
}
export interface StoredFileMetadata {
    id: string;
    name: string;
    encoding: string;
    mimetype: AppMimeType;
    size: number;
    updatedAt: Date;
    fileSrc?: string;
}

export enum FileStorageType {
    'image/png' = 'png',
    'image/jpeg' = 'jpeg',
    'application/pdf' = 'pdf',
    'text/csv' = 'csv',
    'text/plain' = 'txt',
    'application/msword' = 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' = 'docx',
    'application/vnd.ms-excel' = 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = 'xlsx',
}

export type AppMimeType =
    | 'image/png'
    | 'image/jpeg'
    | 'application/pdf'
    | 'text/csv'
    | 'text/plain'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.ms-excel'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
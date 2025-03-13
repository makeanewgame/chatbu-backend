import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class UploadSingleFileRequest {

    @IsString()
    @IsNotEmpty()
    userId: string;



}
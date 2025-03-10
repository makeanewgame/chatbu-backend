import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class UploadSingleFileRequest {

    @IsString()
    @IsNotEmpty()
    user_id: string;



}
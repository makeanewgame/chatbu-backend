import { IsNotEmpty, IsString } from "@nestjs/class-validator";
import { NormalizeEmail } from "src/util/normalize-email.util";

export class LoginRequest {

    // Deliberately not @IsEmail: login must keep working for any legacy row
    // whose stored email predates format validation. Still normalized so
    // "User@X.com" matches the stored "user@x.com".
    @IsString()
    @IsNotEmpty()
    @NormalizeEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

}

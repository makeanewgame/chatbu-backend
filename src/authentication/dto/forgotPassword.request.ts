import { IsEmail } from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email: string;
}

import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { RegisterRequest } from './dto/register.request';
import { LostRequest } from './dto/lost.request';
import { ActivateLostPasswordRequest } from './dto/activatelostpassword.request';
import { GoogleGuard } from './utils/google.guard';
import { ConfigService } from '@nestjs/config';
import { AccessTokenGuard } from './utils/accesstoken.guard';
import { ActivateRegistrationRequest } from './dto/activateregister.request';
import { LoginRequest } from './dto/login.request';
import { Language } from 'src/lang';
import { PasswordRequestChange } from './dto/passwordChangeRequest';

@Controller('auth')
export class AuthenticationController {
  constructor(
    private authService: AuthenticationService,
    private configService: ConfigService,
  ) { }

  @Get('google/register')
  @UseGuards(GoogleGuard)
  handleGoogleRegister() {
    return 'Google Register';
  }

  @Get('google/login')
  @UseGuards(GoogleGuard)
  handleLogin() {
    return 'Google Login';
  }

  @Get('google/redirect')
  @UseGuards(GoogleGuard)
  async googleAuthRedirect(@Req() req, @Res() res) {
    const data = await this.authService.googleLogin(
      req.user.emails[0].value,
      req.user,
    );
    res.redirect(
      this.configService.get('FRONTEND_GOOGLE_REDIRECT_URI') +
      `?user=${JSON.stringify(data)}`,
    );
  }

  @Post('login')
  async login(@Body() body: LoginRequest) {
    return await this.authService.login(body.email, body.password);
  }

  @Post('register')
  async register(@Body() body: RegisterRequest, @Req() req, @Res() res) {
    await this.authService
      .register(body, req.header['Language'])
      .then((result) => {
        if (result) {
          return res.json({
            redirect: true,
            url: '/activate-registration?email=' + body.email,
          });
        } else {
          return res.json({
            redirect: true,
            url: '/login?email=' + body.email,
          });
        }
      });
  }
  // @Post('lost-password')
  // async lostPassword(@Body() body: LostRequest, @Req() req, @Res() res) {
  //   await this.authService
  //     .lostPassword(body.email, body.code)
  //     .then((result) => {
  //       if (result) {
  //         return res.json({
  //           redirect: true,
  //           url: '/lost-password?email=' + body.email,
  //         });
  //       } else {
  //         return res.json({
  //           redirect: true,
  //           url: '/login?email=' + body.email,
  //         });
  //       }
  //     });
  // }
  @Post('lost-password')
  async lostPassword(@Body() body: LostRequest, @Req() req, @Res() res) {
    const result = await this.authService.lostPassword(
      body.email,
      req.header['Language'],
    );

    if (result) {
      // Eğer e-posta adresi kayıtlıysa, sıfırlama kodu gönderilecek.
      return res.json({
        success: true,
        message: 'Şifre sıfırlama kodu e-posta adresinize gönderildi.',
      });
    } else {
      // Eğer e-posta adresi kayıtlı değilse
      return res.json({
        success: false,
        message: 'Bu e-posta adresi sistemde kayıtlı değil.',
      });
    }
  }

  @Post('activate-lost-password')
  async activateLostPassword(@Body() body: ActivateLostPasswordRequest) {
    return await this.authService.lostPassword(body.email, body.code);
  }
  @Post('activate-registration')
  async activateRegistration(@Body() body: ActivateRegistrationRequest) {
    return await this.authService.activateRegistration(body.email, body.code);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  async logout() {
    return 'Logout';
  }

  @Post('forgot-password')
  async forgotPassword() {
    return 'Forgot Password';
  }

  @Post('reset-password')
  async resetPassword(@Body() body: PasswordRequestChange) {
    return await this.authService.resetPassword(
      body.newPassword,
      body.confirmPassword,
      body.userId,
      body.token,
    );
  }

  @Post('verify-email')
  async verifyEmail() {
    return 'Verify Email';
  }

  @Get('refresh-token')
  async refreshToken() {
    return 'Refresh Token';
  }

  @UseGuards(AccessTokenGuard)
  @Get('profile')
  async profile(@Req() req) {
    return await this.authService.getUserProfile(req.user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @Put('profile')
  async updateProfile(@Req() req, @Body() body: any) {
    return await this.authService.updateUserProfile(req.user.sub, body);
  }

  @UseGuards(AccessTokenGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req) {
    return await this.authService.resendEmailVerification(req.user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @Get('deletion-eligibility')
  async checkDeletionEligibility(@Req() req) {
    return await this.authService.checkDeletionEligibility(req.user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @Post('request-deletion')
  async requestAccountDeletion(@Req() req) {
    return await this.authService.requestAccountDeletion(req.user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @Post('cancel-deletion')
  async cancelAccountDeletion(@Req() req) {
    return await this.authService.cancelAccountDeletion(req.user.sub);
  }

  @Post('change-password')
  async changePassword() {
    return 'Change Password';
  }
}

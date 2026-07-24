import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
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
import { ResendVerificationRequest } from './dto/resendverification.request';
import { LoginRequest } from './dto/login.request';
import { Language } from 'src/lang';
import { PasswordRequestChange } from './dto/passwordChangeRequest';
import { ChangePasswordRequest } from './dto/change-password.request';

@Controller('auth')
export class AuthenticationController {
  constructor(
    private authService: AuthenticationService,
    private configService: ConfigService,
  ) { }

  private parseGoogleState(state: unknown): Record<string, any> | null {
    if (typeof state !== 'string' || !state.length) {
      return null;
    }

    let decodedState = state;
    for (let i = 0; i < 2; i += 1) {
      try {
        const nextValue = decodeURIComponent(decodedState);
        if (nextValue === decodedState) {
          break;
        }
        decodedState = nextValue;
      } catch {
        break;
      }
    }

    try {
      const jsonString = Buffer.from(decodedState, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonString);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private resolveFrontendGoogleRedirectUri(state: unknown): string {
    const defaultRedirectUri = this.configService.get<string>('FRONTEND_GOOGLE_REDIRECT_URI') || '';
    const parsedState = this.parseGoogleState(state);
    const requestedRedirectUri = parsedState?.redirectUri;

    if (!requestedRedirectUri || typeof requestedRedirectUri !== 'string') {
      return defaultRedirectUri;
    }

    try {
      const requestedUrl = new URL(requestedRedirectUri);
      const defaultUrl = defaultRedirectUri ? new URL(defaultRedirectUri) : null;

      if (!['http:', 'https:'].includes(requestedUrl.protocol)) {
        return defaultRedirectUri;
      }

      if (requestedUrl.pathname !== '/auth/google/redirect') {
        return defaultRedirectUri;
      }

      const isLocalhost = ['localhost', '127.0.0.1'].includes(requestedUrl.hostname);
      const isDefaultOrigin = !!defaultUrl && requestedUrl.origin === defaultUrl.origin;

      if (!isLocalhost && !isDefaultOrigin) {
        return defaultRedirectUri;
      }

      return `${requestedUrl.origin}${requestedUrl.pathname}`;
    } catch {
      return defaultRedirectUri;
    }
  }

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
    const frontendRedirectUri = this.resolveFrontendGoogleRedirectUri(req.query?.state);
    res.redirect(
      frontendRedirectUri +
      `?user=${encodeURIComponent(JSON.stringify(data))}`,
    );
  }

  @Post('login')
  async login(@Body() body: LoginRequest) {
    return await this.authService.login(body.email, body.password);
  }

  @Post('accept-terms')
  @UseGuards(AccessTokenGuard)
  async acceptTerms(@Req() req, @Body() body: { phoneNumber?: string }) {
    const userId = req.user?.sub || req.user?.id;
    await this.authService.acceptTerms(userId, body.phoneNumber);
    return { success: true };
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
      body.lang || 'en',
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

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    const result = await this.authService.refreshTokens(body.refreshToken);
    if (!result.accessToken) {
      throw new UnauthorizedException(result.message || 'Token refresh failed');
    }
    return result;
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

  // No auth guard: a user who just registered (or hit the emailNotVerified
  // login response) has no access token yet, so this has to work by email.
  @Post('resend-verification-by-email')
  async resendVerificationByEmail(@Body() body: ResendVerificationRequest) {
    return await this.authService.resendEmailVerificationByEmail(body.email);
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

  @UseGuards(AccessTokenGuard)
  @Post('change-password')
  async changePassword(@Req() req, @Body() body: ChangePasswordRequest) {
    return await this.authService.changePassword(
      req.user.sub,
      body.oldPassword,
      body.newPassword,
      body.confirmPassword,
      body.lang || 'en',
    );
  }

  @UseGuards(AccessTokenGuard)
  @Get('google/status')
  async getGoogleStatus(@Req() req) {
    return await this.authService.getGoogleAccountStatus(req.user.sub);
  }

  @UseGuards(AccessTokenGuard)
  @Post('google/connect')
  async connectGoogle(@Req() req, @Body() body: { googleId: string; googleEmail: string }) {
    return await this.authService.connectGoogleAccount(
      req.user.sub,
      body.googleId,
      body.googleEmail,
    );
  }

  @UseGuards(AccessTokenGuard)
  @Post('google/disconnect')
  async disconnectGoogle(@Req() req) {
    return await this.authService.disconnectGoogleAccount(req.user.sub);
  }
}

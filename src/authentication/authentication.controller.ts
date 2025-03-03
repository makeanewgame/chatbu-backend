import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { RegisterRequest } from './dto/register.request';
import { GoogleGuard } from './utils/google.guard';
import { ConfigService } from '@nestjs/config';
import { AccessTokenGuard } from './utils/accesstoken.guard';
import { ActivateRegistrationRequest } from './dto/activateregister.request';

@Controller('auth')
export class AuthenticationController {

    constructor(private authService: AuthenticationService, private configService: ConfigService) { }


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
    async googleAuthRedirect(
        @Req() req,
        @Res() res,
    ) {
        //TODO: Implement the logic to handle the user data from google
        res.redirect(this.configService.get<string>('FRONTEND_GOOGLE_REDIRECT_URI'))
    }


    @Post('login')
    async login() {
        return 'Login';
    }

    @Post('register')
    async register(@Body() body: RegisterRequest, @Res() res) {
        await this.authService.register(body).then((result) => {
            if (result) {
                return res.json({
                    redirect: true,
                    url: "/activate-registration?email=" + body.email
                });
            }
            else {
                return res.json({
                    redirect: true,
                    url: "/login?email=" + body.email
                }
                );
            }
        });

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
    async resetPassword() {
        return 'Reset Password';
    }

    @Post('verify-email')
    async verifyEmail() {
        return 'Verify Email';
    }

    @Get('refresh-token')
    async refreshToken() {
        return 'Refresh Token';
    }

    @Get('profile')
    async profile() {
        return 'Profile';
    }

    @Post('change-password')
    async changePassword() {
        return 'Change Password';
    }

}

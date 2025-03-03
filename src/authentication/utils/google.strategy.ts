
import {
    Inject,
    Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthenticationService } from '../authentication.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        private configService: ConfigService,
        @Inject('AUTH_SERVICE') private readonly authService: AuthenticationService

    ) {
        super({
            clientID: configService.get('GOOGLE_CLIENT_ID'),
            clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
            callbackURL: configService.get('GOOGLE_REDIRECT_URI'),
            passReqToCallback: true,
            scope: ['profile', 'email'],
        });
    }
    async authenticate(req: any, options: any) {
        return super.authenticate(req, options);
    }

    async validate(
        req: any,
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ) {
        const email = profile.emails.find((x) => x.verified);
        if (!email) {
            throw new Error('No verified email returned from Google Authorization!');
        }
        const userProfile = {
            email: profile.emails[0].value,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            picture: profile.photos[0].value,
            password: '',
            accessToken: accessToken,
        };

        done(null, profile);
    }
}

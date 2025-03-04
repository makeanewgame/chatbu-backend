import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { DrizzleDB } from 'src/drizzle/types/drizzle';
import * as schema from 'src/drizzle/schema/schema';
import { eq } from 'drizzle-orm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { access } from 'fs';

@Injectable()
export class AuthenticationService {
    constructor(
        private mail: MailService,
        private jwtService: JwtService,
        private configService: ConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @Inject(DRIZZLE) private readonly db: DrizzleDB) { }

    async register(user: typeof schema.users.$inferInsert) {

        console.log("user", user)
        user.refreshtoken = "";
        user.updated_at = new Date().toISOString();


        const findUser = await this.db.query.users.findFirst({
            where: eq(schema.users.email, user.email)
        });

        //Kullanıcı daha önce kayıt olmuş ise onu login sayfasına şifresini girecek bir şekilde yönlendir.

        if (findUser) {
            return false;
        } else {

            const bcrypt = require('bcrypt');
            user.password = await bcrypt.hash(user.password, 10);

            //create temp code 6 digits
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await this.cacheManager.set(user.email, code, 60 * 60 * 24);
            await this.db.insert(schema.users).values(user);

            const activationUrl = process.env.FRONTEND_URL + '/activate-registration?email=' + user.email;

            const company = process.env.COMPANY_NAME;
            const company_address = process.env.COMPANY_ADDRESS;

            console.log("company", company)
            console.log("company_address", company_address)
            console.log("activationUrl", activationUrl)
            console.log("code", code)

            this.mail.sendRegisterMail(user.email, code, 'en', user.name, company, company_address, activationUrl);

            this.logger.info('Registering user', user.email);
        }

        return true;

    }

    async activateRegistration(email: string, code: string) {
        const cachedCode = await this.cacheManager.get(email);

        console.log("cachedCode", cachedCode)
        console.log("code", code)


        if (cachedCode === code) {
            await this.db.update(schema.users).set({
                emailVerified: true
            }).where(eq(schema.users.email, email));


            await this.cacheManager.del(email);

            const user = await this.db.query.users.findFirst({
                where: eq(schema.users.email, email)
            });

            const tokens = this.getTokens(user.id, user.email);

            //TODO: Send welcome email

            // Create JWT and Refresh Token and redirect user to dashboard

            return { success: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userEmail: user.email, userId: user.id, userName: user.name };
        }
        return { success: false };
    }

    async login(email: string, password: string) {
        const bcrypt = require('bcrypt');

        const findUser = await this.db.query.users.findFirst({
            where: eq(schema.users.email, email)
        });

        if (!findUser) return null;

        return await bcrypt.compare(password, findUser.password).then((result) => {

            if (result) {
                const { password, ...data } = findUser;
                const tokens = this.getTokens(
                    data.id,
                    data.email,
                );

                this.db.update(schema.users).set({
                    refreshtoken: tokens.refreshToken,
                }).where(eq(schema.users.id, data.id));

                return {
                    success: true,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    userEmail: data.email,
                    userId: data.id,
                    userName: data.name
                };

            }

            return new UnauthorizedException();
        },
        );
    }


    async logout(email: string) {
        // Check schema to use the correct field name instead of 'refreshToken'
        // For example, if you have a 'token' field:
        await this.db.update(schema.users).set({
            refreshtoken: ''
        }).where(eq(schema.users.email, email));
    }

    getTokens(userId: string, email: string) {
        const accessToken = this.jwtService.sign(
            { sub: userId, email },
            { expiresIn: '1d', secret: this.configService.get('JWT_SECRET') },
        );
        const refreshToken = this.jwtService.sign(
            { sub: userId, email },
            {
                expiresIn: '10d',
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            },
        );
        return { accessToken: accessToken, refreshToken: refreshToken };
    }

    async refreshTokens(accessToken: string) {
        //TODO: Access Token Revocation List
        //Access Token Revocation List

        //check access token is valid and time is expired
        // if this values are valid then get access token from db

        const decodedToken = this.jwtService.decode(accessToken);

        if (
            !decodedToken ||
            !decodedToken.exp ||
            decodedToken.exp > Date.now() / 1000
        ) {
            return {
                message: 'Access token is invalid or expired',
                code: 'INVALID_ACCESS_TOKEN',
            };
        }

        const userId = decodedToken.sub;

        const findUser = await this.db.query.users.findFirst({
            where: eq(schema.users.id, userId)
        });

        if (!findUser) {
            return { message: 'User not found', code: 'USER_NOT_FOUND' };
        }

        if (!findUser.refreshtoken) {
            return {
                message: 'Refresh token not found',
                code: 'REFRESH_TOKEN_NOT_FOUND',
            };
        }

        const savedRefreshToken = findUser.refreshtoken;

        const decodedRefreshToken = this.jwtService.decode(savedRefreshToken);
        if (
            !decodedRefreshToken ||
            !decodedRefreshToken.exp ||
            decodedRefreshToken.exp < Date.now() / 1000
        ) {
            return {
                message: 'Refresh token is invalid or expired',
                code: 'INVALID_REFRESH_ACCESS_TOKEN',
            };
        }

        const refreshTokenUserID = decodedToken.sub;
        const refreshTokenUserEmail = decodedToken.email;

        // Get new access token from the database
        const tokens = await this.getTokens(
            refreshTokenUserID,
            refreshTokenUserEmail,
        );

        await this.db.update(schema.users).set({
            refreshtoken: tokens.refreshToken
        }).where(eq(schema.users.id, userId));

        return { accessToken: tokens.accessToken };
    }

    async validateUserByJwt(email: string, password: string) {
        const bcrypt = require('bcrypt');

        const findUser = await this.db.query.users.findFirst({
            where: eq(schema.users.email, email)
        });

        if (!findUser) return null;

        await bcrypt.compare(password, findUser.password).then((result) => {

            if (result) {
                const { password, ...data } = findUser;
                const tokens = this.getTokens(
                    data.id,
                    data.email,
                );

                this.db.update(schema.users).set({
                    refreshtoken: tokens.refreshToken,
                }).where(eq(schema.users.id, data.id));

                return {
                    accessToken: tokens.accessToken,
                };
            }

            return null;
        },
        );
    }
}

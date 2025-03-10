import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthenticationService {
    constructor(
        private mail: MailService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) { }

    async register(user: any, lang: string) {

        user.refreshtoken = "";
        user.updated_at = new Date().toISOString();


        const findUser = await this.prisma.user.findFirst({
            where: {
                email: user.email
            }
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

            await this.prisma.user.create({
                data: user
            });

            const activationUrl = process.env.FRONTEND_URL + '/activate-registration?email=' + user.email;

            const company = process.env.COMPANY_NAME;
            const company_address = process.env.COMPANY_ADDRESS;

            console.log("company", company)
            console.log("company_address", company_address)
            console.log("activationUrl", activationUrl)
            console.log("code", code)

            this.mail.sendRegisterMail(user.email, code, lang, user.name, company, company_address, activationUrl);

            this.logger.info('Registering user', user.email);
        }

        return true;

    }

    async activateRegistration(email: string, code: string) {
        const cachedCode = await this.cacheManager.get(email);

        console.log("cachedCode", cachedCode)
        console.log("code", code)


        const findUser = await this.prisma.user.findFirst({
            where: {
                email: email
            }
        });

        if (cachedCode === code) {
            await this.prisma.user.update({
                where: {
                    id: findUser.id
                },
                data: {
                    emailVerified: true
                }
            });



            await this.cacheManager.del(email);

            const user = await this.prisma.user.findFirst({
                where: {
                    email: email
                }
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

        const findUser = await this.prisma.user.findFirst({
            where: {
                email: email
            }
        });

        if (!findUser) return null;

        return await bcrypt.compare(password, findUser.password).then((result) => {

            if (result) {
                const { password, ...data } = findUser;
                const tokens = this.getTokens(
                    data.id,
                    data.email,
                );


                this.prisma.user.update({
                    where: {
                        id: data.id
                    },
                    data: {
                        refreshToken: tokens.refreshToken
                    }
                });

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

    async googleLogin(email: string, user: any) {



        let findUser = await this.prisma.user.findFirst({
            where: {
                email: email
            }
        });


        if (!findUser) {
            const tempUser = {
                email: email,
                name: user.displayName,
                password: "",
                phonenumber: "",
                emailVerified: true,
                phoneVerified: false,
                refreshtoken: "",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }

            await this.prisma.user.create({
                data: tempUser
            });

            findUser = await this.prisma.user.findFirst({
                where: {
                    email: email
                }
            });
        }

        const { password, ...data } = findUser;
        const tokens = this.getTokens(
            data.id,
            data.email,
        );

        await this.prisma.user.update({
            where: {
                id: data.id
            },
            data: {
                refreshToken: tokens.refreshToken
            }
        });

        return {
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            userEmail: data.email,
            userId: data.id,
            userName: data.name
        };
    }

    async registerGoogleUser(user: any) { }


    async logout(email: string) {
        // Check schema to use the correct field name instead of 'refreshToken'
        // For example, if you have a 'token' field:


        const findUser = await this.prisma.user.findFirst({
            where: {
                email: email
            }
        });

        await this.prisma.user.update({
            where: {
                id: findUser.id
            },
            data: {
                refreshToken: ""
            }
        });
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

        const findUser = await this.prisma.user.findFirst({
            where: {
                id: userId
            }
        });



        if (!findUser) {
            return { message: 'User not found', code: 'USER_NOT_FOUND' };
        }

        if (!findUser.refreshToken) {
            return {
                message: 'Refresh token not found',
                code: 'REFRESH_TOKEN_NOT_FOUND',
            };
        }

        const savedRefreshToken = findUser.refreshToken;

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

        await this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                refreshToken: tokens.refreshToken
            }
        });

        return { accessToken: tokens.accessToken };
    }

    async validateUserByJwt(email: string, password: string) {
        const bcrypt = require('bcrypt');

        const findUser = await this.prisma.user.findFirst({
            where: {
                email: email
            }
        });

        if (!findUser) return null;

        await bcrypt.compare(password, findUser.password).then(async (result) => {

            if (result) {
                const { password, ...data } = findUser;
                const tokens = this.getTokens(
                    data.id,
                    data.email,
                );

                await this.prisma.user.update({
                    where: {
                        id: findUser.id
                    },
                    data: {
                        refreshToken: tokens.refreshToken
                    }
                });

                return {
                    accessToken: tokens.accessToken,
                };
            }

            return null;
        },
        );
    }
}

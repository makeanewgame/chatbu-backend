import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MailService } from 'src/mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuotaService } from 'src/quota/quota.service';

@Injectable()
export class AuthenticationService {
  constructor(
    private mail: MailService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private quoteService: QuotaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) { }

  async register(user: any, lang: string) {
    user.refreshToken = '';
    user.updatedAt = new Date().toISOString();

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: user.email,
      },
    });

    if (findUser) {
      return false;
    } else {
      const bcrypt = require('bcrypt');
      user.password = await bcrypt.hash(user.password, 10);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.cacheManager.set(user.email, code, 60 * 60 * 24);

      const createdUser = await this.prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          phonenumber: user.phonenumber,
          emailVerified: true,
          phoneVerified: false,
        },
      });

      await this.quoteService.createDefaultQuotas(createdUser.id)

      const activationUrl =
        process.env.FRONTEND_URL + '/activate-registration?email=' + user.email;

      const company = process.env.COMPANY_NAME;
      const company_address = process.env.COMPANY_ADDRESS;

      this.mail.sendRegisterMail(
        user.email,
        code,
        lang,
        user.name,
        company,
        company_address,
        activationUrl,
      );

      this.logger.info('Registering user', user.email);
    }

    return true;
  }

  async activateRegistration(email: string, code: string) {
    const cachedCode = await this.cacheManager.get(email);
    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (cachedCode === code) {
      await this.prisma.user.update({
        where: {
          id: findUser.id,
        },
        data: {
          emailVerified: true,
        },
      });

      await this.cacheManager.del(email);

      const user = await this.prisma.user.findFirst({
        where: {
          email: email,
        },
      });

      const tokens = this.getTokens(user.id, user.email);

      //TODO: Send welcome email

      // Create JWT and Refresh Token and redirect user to dashboard

      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userEmail: user.email,
        userId: user.id,
        userName: user.name,
      };
    }
    return { success: false };
  }

  async login(email: string, password: string) {
    const bcrypt = require('bcrypt');

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (!findUser) return null;

    return await bcrypt.compare(password, findUser.password).then((result) => {
      if (result) {
        const { password, ...data } = findUser;
        const tokens = this.getTokens(data.id, data.email);

        this.prisma.user.update({
          where: {
            id: data.id,
          },
          data: {
            refreshToken: tokens.refreshToken,
          },
        });

        return {
          success: true,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          userEmail: data.email,
          userId: data.id,
          userName: data.name,
        };
      }

      return new UnauthorizedException();
    });
  }

  async googleLogin(email: string, user: any) {
    let findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (!findUser) {
      const tempUser = {
        email: email,
        name: user.displayName,
        password: '',
        phoneNumber: user.phoneNumber,
        emailVerified: true,
        phoneVerified: false,
        refreshToken: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      findUser = await this.prisma.user.create({
        data: tempUser,
      });

      await this.quoteService.createDefaultQuotas(findUser.id);

    }

    const { password, ...data } = findUser;
    const tokens = this.getTokens(data.id, data.email);

    await this.prisma.user.update({
      where: {
        id: data.id,
      },
      data: {
        refreshToken: tokens.refreshToken,
      },
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userEmail: data.email,
      userId: data.id,
      userName: data.name,
    };
  }

  async registerGoogleUser(user: any) { }

  async logout(email: string) {
    // Check schema to use the correct field name instead of 'refreshToken'
    // For example, if you have a 'token' field:

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    await this.prisma.user.update({
      where: {
        id: findUser.id,
      },
      data: {
        refreshToken: '',
      },
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
        id: userId,
      },
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
        id: userId,
      },
      data: {
        refreshToken: tokens.refreshToken,
      },
    });

    return { accessToken: tokens.accessToken };
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
    lang: string,
  ) {
    const findUser = await this.prisma.user.findFirst({
      where: { email: email },
    });

    if (!findUser) {
      throw new Error('Bu e-posta adresine sahip kullanıcı bulunamadı.');
    }

    const storedCode = await this.cacheManager.get<string>(
      `reset_code_${email}`,
    );

    if (!storedCode || storedCode !== code) {
      throw new Error('Geçersiz veya süresi dolmuş kod.');
    }

    // Yeni şifreyi hashle
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Kullanıcının şifresini güncelle
    await this.prisma.user.update({
      where: { email: email },
      data: { password: hashedPassword, updatedAt: new Date().toISOString() },
    });

    // Kullanılmış kodu cache'den sil
    await this.cacheManager.del(`reset_code_${email}`);

    await this.mail.sendPasswordChangedMail(email, code, lang);
    return { success: true, message: 'Şifreniz başarıyla güncellendi.' };
  }

  async validateUserByJwt(email: string, password: string) {
    const bcrypt = require('bcrypt');

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (!findUser) return null;

    await bcrypt.compare(password, findUser.password).then(async (result) => {
      if (result) {
        const { password, ...data } = findUser;
        const tokens = this.getTokens(data.id, data.email);

        await this.prisma.user.update({
          where: {
            id: findUser.id,
          },
          data: {
            refreshToken: tokens.refreshToken,
          },
        });

        return {
          accessToken: tokens.accessToken,
        };
      }
      return null;
    });
  }
}

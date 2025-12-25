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
import { randomUUID } from 'crypto';

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

  /**
   * Get the primary team ID for a user.
   * For team owners, returns their own team.
   * For members, returns the first team they belong to.
   */
  private async getUserPrimaryTeamId(userId: string): Promise<string | null> {
    // First check if user owns a team
    const ownedTeam = await this.prisma.team.findFirst({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
      },
    });

    if (ownedTeam) {
      return ownedTeam.id;
    }

    // If not an owner, get the first team they are a member of
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId: userId,
        status: 'active',
      },
      select: {
        teamId: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return teamMember?.teamId || null;
  }

  async register(user: any, lang: string) {
    user.refreshToken = '';
    user.updatedAt = new Date().toISOString();

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: user.email,
      },
    });

    if (findUser) {
      return new UnauthorizedException('User already exists');
    } else {
      const bcrypt = require('bcrypt');
      user.password = await bcrypt.hash(user.password, 10);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      //disabled for cache bug
      //await this.cacheManager.set(user.email, code, 60 * 60 * 24);

      // Check if this is a team invitation registration
      let pendingTeamMember = null;

      // First, check if invitation token is provided
      if (user.invitationToken && user.teamId) {
        pendingTeamMember = await this.prisma.teamMember.findFirst({
          where: {
            invitationToken: user.invitationToken,
            teamId: user.teamId,
            email: user.email,
            status: 'pending',
          },
        });

        if (!pendingTeamMember) {
          throw new UnauthorizedException('Invalid invitation token');
        }
      } else {
        // If no invitation token, check if there's a pending invitation by email
        pendingTeamMember = await this.prisma.teamMember.findFirst({
          where: {
            email: user.email,
            status: 'pending',
            userId: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
      }

      const createdUser = await this.prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          phonenumber: user.phonenumber,
          emailVerified: false,
          phoneVerified: false,
          activationCode: code,
        },
      });

      // Handle team invitation
      if (pendingTeamMember) {
        // Update the existing TeamMember record
        await this.prisma.teamMember.update({
          where: {
            id: pendingTeamMember.id,
          },
          data: {
            userId: createdUser.id,
            status: 'active',
            invitationToken: null,
          },
        });

        this.logger.info(
          `User ${createdUser.id} accepted team invitation for team ${pendingTeamMember.teamId}`,
        );
      } else {
        // Create a default team for the new user
        const defaultTeam = await this.prisma.team.create({
          data: {
            name: `${user.name}'s Team`,
            ownerId: createdUser.id,
          },
        });

        console.log('Created team:', defaultTeam.id, 'for user:', createdUser.id); // DEBUG

        // Create team member record for the owner
        const teamMember = await this.prisma.teamMember.create({
          data: {
            teamId: defaultTeam.id,
            userId: createdUser.id,
            role: 'TEAM_OWNER',
            status: 'active',
          },
        });

        console.log('Created TeamMember:', teamMember.id); // DEBUG

        await this.quoteService.createDefaultQuotas(defaultTeam.id);
      }

      const activationUrl =
        process.env.FRONTEND_URL + '/activate-registration?email=' + user.email;

      const company = process.env.COMPANY_NAME;
      const company_address = process.env.COMPANY_ADDRESS;

      console.log('Sending registration mail to:', user.email, 'with code:', code); // --- IGNORE ---
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
    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (findUser.activationCode === code) {
      await this.prisma.user.update({
        where: {
          id: findUser.id,
        },
        data: {
          emailVerified: true,
          verifiedAt: new Date(),
          activationCode: null,
        },
      });

      await this.cacheManager.del(email);

      const user = await this.prisma.user.findFirst({
        where: {
          email: email,
        },
        select: { email: true, id: true, name: true, role: true },
      });

      const teamId = await this.getUserPrimaryTeamId(user.id);

      if (!teamId) {
        throw new UnauthorizedException('User has no team assigned');
      }

      const tokens = this.getTokens(user.id, user.email, teamId, user.role);

      //TODO: Send welcome email

      // Create JWT and Refresh Token and redirect user to dashboard

      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userEmail: user.email,
        userId: user.id,
        userName: user.name,
        role: user.role,
        teamId: teamId,
      };
    }
    return { success: false };
  }
  async lostPassword(user: any, lang: string) {
    user.refreshToken = '';
    user.updatedAt = new Date().toISOString();

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: user.email,
      },
    });

    if (!findUser) {
      return false; // Kullanıcı yoksa false dön
    }

    // // Kullanıcı varsa, kod üret ve e-posta gönder
    // const code = Math.floor(100000 + Math.random() * 900000).toString();

    const uuidVerificationCode = randomUUID();

    // await this.cacheManager.set(
    //   findUser.id,
    //   uuidVerificationCode,
    //   60 * 60 * 24,
    // );

    await this.cacheManager.set(
      findUser.id,
      uuidVerificationCode,
      60 * 60 * 24,
    );

    const redirectUrl =
      process.env.FRONTEND_URL +
      '/reset-password?token=' +
      uuidVerificationCode +
      '&uId=' +
      findUser.id;
    this.mail.sendActivateLostPasswordMail(
      user.email,
      uuidVerificationCode,
      lang,
      redirectUrl,
    );
    return true;

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

      // Create a default team for the new user
      const defaultTeam = await this.prisma.team.create({
        data: {
          name: `${user.name}'s Team`,
          ownerId: createdUser.id,
        },
      });

      await this.quoteService.createDefaultQuotas(defaultTeam.id);

      const activationUrl =
        process.env.FRONTEND_URL + '/activate-registration?email=' + user.email;

      this.mail.sendActivateLostPasswordMail(
        user.email,
        code,
        lang,

        activationUrl,
      );

      this.logger.info('Registering user', user.email);
    }

    return true;
  }
  async login(email: string, password: string) {
    const bcrypt = require('bcrypt');

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
      select: { email: true, id: true, name: true, password: true, role: true },
    });

    if (!findUser) return null;

    return await bcrypt.compare(password, findUser.password).then(async (result) => {
      if (result) {
        const { password, ...data } = findUser;

        const teamId = await this.getUserPrimaryTeamId(data.id);

        if (!teamId) {
          throw new UnauthorizedException('User has no team assigned');
        }

        const tokens = this.getTokens(data.id, data.email, teamId, findUser.role);

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
          teamId: teamId,
          role: findUser.role,
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
      select: { email: true, id: true, name: true, password: true, role: true },
    });

    if (!findUser) {
      // Check if this user has a pending team invitation
      const pendingTeamMember = await this.prisma.teamMember.findFirst({
        where: {
          email: email,
          status: 'pending',
        },
      });

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

      const createdUser = await this.prisma.user.create({
        data: tempUser,
        select: { email: true, id: true, name: true, password: true },
      });

      console.log('Created Google user:', createdUser.id); // DEBUG

      // Handle team invitation if exists
      if (pendingTeamMember) {
        // Update the existing TeamMember record
        await this.prisma.teamMember.update({
          where: {
            id: pendingTeamMember.id,
          },
          data: {
            userId: createdUser.id,
            status: 'active',
            invitationToken: null,
          },
        });

        this.logger.info(
          `Google user ${createdUser.id} accepted team invitation for team ${pendingTeamMember.teamId}`,
        );
      } else {
        // Create a default team for the new user
        const defaultTeam = await this.prisma.team.create({
          data: {
            name: `${createdUser.name}'s Team`,
            ownerId: createdUser.id,
          },
        });

        console.log('Created team for Google user:', defaultTeam.id); // DEBUG

        // Create team member record for the owner
        const teamMember = await this.prisma.teamMember.create({
          data: {
            teamId: defaultTeam.id,
            userId: createdUser.id,
            role: 'TEAM_OWNER',
            status: 'active',
          },
        });

        console.log('Created TeamMember for Google user:', teamMember.id); // DEBUG

        await this.quoteService.createDefaultQuotas(defaultTeam.id);
      }

      findUser = await this.prisma.user.findFirst({
        where: {
          email: email,
        },
        select: { email: true, id: true, name: true, password: true, role: true },
      });
    }

    console.log('Google login for user:', findUser); // --- IGNORE ---

    const { password, ...data } = findUser;

    const teamId = await this.getUserPrimaryTeamId(data.id);

    if (!teamId) {
      throw new UnauthorizedException('User has no team assigned');
    }

    const tokens = this.getTokens(data.id, data.email, teamId, findUser.role);

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
      teamId: teamId,
      role: findUser.role,
    };
  }

  async registerGoogleUser(user: any) { }

  async logout(email: string) {
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

  getTokens(userId: string, email: string, teamId: string, role: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email, type: 'auth', teamId, role },
      { expiresIn: '1d', secret: this.configService.get('JWT_SECRET') },
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId, email, type: 'refresh', teamId, role },
      {
        expiresIn: '10d',
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      },
    );
    return { accessToken: accessToken, refreshToken: refreshToken };
  }

  async refreshTokens(accessToken: string) {
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
      select: { id: true, email: true, role: true, refreshToken: true },
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

    const teamId = await this.getUserPrimaryTeamId(findUser.id);

    if (!teamId) {
      return {
        message: 'User has no team assigned',
        code: 'NO_TEAM_ASSIGNED',
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
    const refreshTokenUserRole = decodedToken.role;

    // Get new access token from the database
    const tokens = await this.getTokens(
      refreshTokenUserID,
      refreshTokenUserEmail,
      teamId,
      refreshTokenUserRole
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
    newPassword: string,
    confirmPassword: string,
    userId: string,
    token: string,
  ) {
    const findUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!findUser) {
      throw new Error('Kullanıcı bulunamadı.');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('Şifreler uyuşmuyor.');
    }

    const cachedToken = await this.cacheManager.get(userId);

    if (cachedToken !== token) {
      throw new Error('Geçersiz token.');
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, updatedAt: new Date().toISOString() },
    });

    await this.cacheManager.del(`${userId}`);

    await this.mail.sendPasswordChangedMail(findUser.email, cachedToken, 'en');
    return { success: true, message: 'Şifreniz başarıyla güncellendi.' };
  }

  async validateUserByJwt(email: string, password: string) {
    const bcrypt = require('bcrypt');

    const findUser = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
      select: { email: true, id: true, name: true, password: true, role: true },
    });

    if (!findUser) return null;

    await bcrypt.compare(password, findUser.password).then(async (result) => {
      if (result) {
        const { password, ...data } = findUser;

        const teamId = await this.getUserPrimaryTeamId(data.id);

        if (!teamId) {
          throw new UnauthorizedException('User has no team assigned');
        }

        const tokens = this.getTokens(data.id, data.email, teamId, data.role);

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

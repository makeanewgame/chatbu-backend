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
          phoneNumber: user.phoneNumber,
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

        await this.quoteService.createDefaultQuotas(defaultTeam.id, createdUser.id);
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
          phoneNumber: user.phoneNumber,
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

      await this.quoteService.createDefaultQuotas(defaultTeam.id, createdUser.id);

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
      select: {
        email: true,
        id: true,
        name: true,
        password: true,
        role: true,
        isDeleted: true,
        deletionScheduledFor: true,
      },
    });

    if (!findUser) return null;

    return await bcrypt.compare(password, findUser.password).then(async (result) => {
      if (result) {
        const { password, isDeleted, deletionScheduledFor, ...data } = findUser;

        // Check if account is scheduled for deletion
        if (isDeleted && deletionScheduledFor) {
          const now = new Date();

          // If deletion hasn't been executed yet, allow reactivation
          if (deletionScheduledFor > now) {
            // Restore the account
            await this.prisma.user.update({
              where: { id: data.id },
              data: {
                isDeleted: false,
                deletedAt: null,
                deletionScheduledFor: null,
              },
            });

            this.logger.info(`Account ${data.email} restored after deletion request`);
          } else {
            // Grace period has passed, account should have been deleted
            throw new UnauthorizedException('Account has been deleted');
          }
        } else if (isDeleted) {
          // Permanently deleted or in deletion process
          throw new UnauthorizedException('Account has been deleted');
        }

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

        await this.quoteService.createDefaultQuotas(defaultTeam.id, createdUser.id);
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

  async getUserProfile(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const teamId = await this.getUserPrimaryTeamId(userId);

      return {
        success: true,
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          teamId: teamId,
          isEmailVerified: user.emailVerified,
        },
      };
    } catch (error) {
      this.logger.error('Error getting user profile:', error);
      return {
        success: false,
        message: 'Error retrieving profile',
      };
    }
  }

  async updateUserProfile(userId: string, data: any) {
    try {
      const { name, email, phoneNumber } = data;

      if (!name || !email) {
        return {
          success: false,
          message: 'Name and email are required',
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      let emailChanged = false;

      // Email değişikliği kontrolü
      if (email !== user.email) {
        // Yeni email daha önce kullanılmış mı kontrol et
        const existingUser = await this.prisma.user.findUnique({
          where: { email: email },
        });

        if (existingUser) {
          return {
            success: false,
            message: 'Email already exists',
          };
        }

        emailChanged = true;

        // Email doğrulama kodu oluştur
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Kullanıcıyı güncelle
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            name: name,
            email: email,
            phoneNumber: phoneNumber || null,
            emailVerified: false,
            activationCode: verificationCode,
          },
        });

        // Doğrulama maili gönder
        try {
          await this.mail.sendEmailVerificationMail(email, verificationCode, 'en', name);
        } catch (mailError) {
          this.logger.error('Error sending verification email:', mailError);
        }
      } else {
        // Email değişmemişse sadece diğer alanları güncelle
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            name: name,
            phoneNumber: phoneNumber || null,
          },
        });
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          userId: userId,
          name: name,
          email: email,
          phoneNumber: phoneNumber,
          emailChanged: emailChanged,
        },
      };
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      return {
        success: false,
        message: 'Error updating profile',
      };
    }
  }

  async resendEmailVerification(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          message: 'Email already verified',
        };
      }

      // Yeni doğrulama kodu oluştur
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          activationCode: verificationCode,
        },
      });

      // Doğrulama maili gönder
      try {
        await this.mail.sendEmailVerificationMail(user.email, verificationCode, 'en', user.name);
      } catch (mailError) {
        this.logger.error('Error sending verification email:', mailError);
        return {
          success: false,
          message: 'Error sending verification email',
        };
      }

      return {
        success: true,
        message: 'Verification email sent successfully',
      };
    } catch (error) {
      this.logger.error('Error resending verification email:', error);
      return {
        success: false,
        message: 'Error sending verification email',
      };
    }
  }

  /**
   * Check if user is eligible for account deletion
   * Returns any blockers that prevent deletion
   */
  async checkDeletionEligibility(userId: string) {
    const blockers = [];

    // Check if user owns teams with other members
    const ownedTeams = await this.prisma.team.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        members: {
          where: {
            status: 'active',
          },
        },
      },
    });

    for (const team of ownedTeams) {
      // If team has more than 1 member (owner + others)
      if (team.members.length > 1) {
        blockers.push({
          type: 'TEAM_OWNERSHIP',
          message: `You must transfer ownership or remove members from team "${team.name || 'Unnamed Team'}" before deleting your account`,
          teamId: team.id,
          teamName: team.name,
          memberCount: team.members.length - 1, // excluding owner
        });
      }
    }

    // Check for pending team invitations sent by this user
    const pendingInvitations = await this.prisma.teamMember.count({
      where: {
        team: {
          ownerId: userId,
        },
        status: 'pending',
      },
    });

    if (pendingInvitations > 0) {
      blockers.push({
        type: 'PENDING_INVITATIONS',
        message: `You have ${pendingInvitations} pending team invitation(s). Please cancel them before deleting your account`,
        count: pendingInvitations,
      });
    }

    return {
      eligible: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Request account deletion (soft delete with 30-day grace period)
   * GDPR compliant - allows user to recover within 30 days
   */
  async requestAccountDeletion(userId: string) {
    try {
      // Check eligibility
      const eligibility = await this.checkDeletionEligibility(userId);

      if (!eligibility.eligible) {
        return {
          success: false,
          message: 'Account deletion blocked',
          blockers: eligibility.blockers,
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.isDeleted) {
        return {
          success: false,
          message: 'Account is already scheduled for deletion',
          scheduledFor: user.deletionScheduledFor,
        };
      }

      // Calculate deletion date (30 days from now)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30);

      // Soft delete - mark as deleted but keep data for 30 days
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletionScheduledFor: deletionDate,
          refreshToken: null, // Invalidate all sessions
        },
      });

      // Send deletion confirmation email
      try {
        // TODO: Create a specific email template for account deletion
        this.logger.info(`Account deletion requested for user ${userId}. Scheduled for ${deletionDate.toISOString()}`);

        // In the future, send email with:
        // - Confirmation of deletion request
        // - Date when account will be permanently deleted
        // - Link to cancel deletion if they change their mind
      } catch (mailError) {
        this.logger.error('Error sending deletion confirmation email:', mailError);
        // Don't block the deletion if email fails
      }

      return {
        success: true,
        message: 'Account deletion scheduled successfully',
        deletionScheduledFor: deletionDate,
        daysUntilDeletion: 30,
      };
    } catch (error) {
      this.logger.error('Error requesting account deletion:', error);
      return {
        success: false,
        message: 'Error processing account deletion request',
      };
    }
  }

  /**
   * Cancel account deletion request (restore soft-deleted account)
   */
  async cancelAccountDeletion(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (!user.isDeleted) {
        return {
          success: false,
          message: 'Account is not scheduled for deletion',
        };
      }

      // Restore account
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletionScheduledFor: null,
        },
      });

      this.logger.info(`Account deletion cancelled for user ${userId}`);

      return {
        success: true,
        message: 'Account deletion cancelled successfully',
      };
    } catch (error) {
      this.logger.error('Error cancelling account deletion:', error);
      return {
        success: false,
        message: 'Error cancelling account deletion',
      };
    }
  }

  /**
   * Permanently delete user account and all associated data
   * This should only be called by a cron job after the grace period
   * or manually by an admin
   */
  async permanentlyDeleteAccount(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Safety check: only delete if marked as deleted
      if (!user.isDeleted) {
        return {
          success: false,
          message: 'Account must be soft-deleted first',
        };
      }

      // Get owned teams to clean up
      const ownedTeams = await this.prisma.team.findMany({
        where: {
          ownerId: userId,
        },
        include: {
          members: true,
        },
      });

      // Delete owned teams (cascade will handle related data)
      for (const team of ownedTeams) {
        // Verify team has no other active members
        const otherMembers = team.members.filter(
          m => m.userId !== userId && m.status === 'active'
        );

        if (otherMembers.length > 0) {
          this.logger.error(`Cannot delete team ${team.id} - has active members`);
          continue;
        }

        await this.prisma.team.delete({
          where: { id: team.id },
        });
      }

      // Remove user from team memberships
      await this.prisma.teamMember.deleteMany({
        where: {
          userId: userId,
        },
      });

      // Finally, delete the user
      await this.prisma.user.delete({
        where: { id: userId },
      });

      this.logger.info(`User ${userId} permanently deleted`);

      return {
        success: true,
        message: 'Account permanently deleted',
      };
    } catch (error) {
      this.logger.error('Error permanently deleting account:', error);
      return {
        success: false,
        message: 'Error deleting account',
      };
    }
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Verify old password
      const bcrypt = require('bcrypt');
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);

      if (!isValidPassword) {
        return {
          success: false,
          message: 'Current password is incorrect',
        };
      }

      // Check if new password and confirm password match
      if (newPassword !== confirmPassword) {
        return {
          success: false,
          message: 'New password and confirm password do not match',
        };
      }

      // Check if new password is same as old password
      if (oldPassword === newPassword) {
        return {
          success: false,
          message: 'New password must be different from current password',
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date().toISOString(),
        },
      });

      // Send confirmation email
      await this.mail.sendPasswordChangedMail(user.email, '', 'en');

      this.logger.info(`Password changed successfully for user ${userId}`);

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      this.logger.error('Error changing password:', error);
      return {
        success: false,
        message: 'Error changing password',
      };
    }
  }

  async getGoogleAccountStatus(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleId: true,
          googleEmail: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      return {
        success: true,
        data: {
          isConnected: !!user.googleId,
          googleEmail: user.googleEmail,
        },
      };
    } catch (error) {
      this.logger.error('Error getting Google account status:', error);
      return {
        success: false,
        message: 'Error getting Google account status',
      };
    }
  }

  async connectGoogleAccount(
    userId: string,
    googleId: string,
    googleEmail: string,
  ) {
    try {
      // Check if this Google account is already connected to another user
      const existingUser = await this.prisma.user.findFirst({
        where: {
          googleId: googleId,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return {
          success: false,
          message: 'This Google account is already connected to another user',
        };
      }

      // Update user with Google account info
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleId: googleId,
          googleEmail: googleEmail,
          updatedAt: new Date().toISOString(),
        },
      });

      this.logger.info(`Google account connected for user ${userId}`);

      return {
        success: true,
        message: 'Google account connected successfully',
      };
    } catch (error) {
      this.logger.error('Error connecting Google account:', error);
      return {
        success: false,
        message: 'Error connecting Google account',
      };
    }
  }

  async disconnectGoogleAccount(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleId: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (!user.googleId) {
        return {
          success: false,
          message: 'No Google account connected',
        };
      }

      // Disconnect Google account
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleId: null,
          googleEmail: null,
          updatedAt: new Date().toISOString(),
        },
      });

      this.logger.info(`Google account disconnected for user ${userId}`);

      return {
        success: true,
        message: 'Google account disconnected successfully',
      };
    } catch (error) {
      this.logger.error('Error disconnecting Google account:', error);
      return {
        success: false,
        message: 'Error disconnecting Google account',
      };
    }
  }
}


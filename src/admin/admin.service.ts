import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAllUsersDto } from './dto/getAllUsers.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { CreateAdminUserDto } from './dto/createAdminUser.dto';
import { GetAllTeamsDto } from './dto/getAllTeams.dto';
import { GetAllChatbotsDto } from './dto/getAllChatbots.dto';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private minioClientService: MinioClientService,
        private configService: ConfigService,
    ) { }

    async getAllTeams(dto: GetAllTeamsDto) {
        const { page = 1, limit = 10, search } = dto;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { owner: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [teams, total] = await Promise.all([
            this.prisma.team.findMany({
                where,
                skip,
                take: limit,
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            members: true,
                            Content: true,
                            CustomerBots: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            this.prisma.team.count({ where }),
        ]);

        return {
            data: teams,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getAllUsers(dto: GetAllUsersDto) {
        const {
            page = 1,
            limit = 10,
            search,
            role,
            emailVerified,
            phoneVerified,
            includeDeleted = false
        } = dto;

        const skip = (page - 1) * limit;

        const where: any = {};

        if (!includeDeleted) {
            where.isDeleted = false;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phonenumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (role) {
            where.role = role;
        }

        if (emailVerified !== undefined) {
            where.emailVerified = emailVerified;
        }

        if (phoneVerified !== undefined) {
            where.phoneVerified = phoneVerified;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    emailVerified: true,
                    phoneVerified: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    isDeleted: true,
                    deletedAt: true,
                    verifiedAt: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async createUser(dto: CreateAdminUserDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new BadRequestException('Email already in use');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const createdUser = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
                phoneNumber: dto.phoneNumber || null,
                role: dto.role || 'USER',
                emailVerified: true,
                phoneVerified: false,
                termsAccepted: true,
                termsAcceptedAt: new Date(),
                verifiedAt: new Date(),
            },
        });

        // Create a default team for the new user
        const defaultTeam = await this.prisma.team.create({
            data: {
                name: `${dto.name}'s Team`,
                ownerId: createdUser.id,
            },
        });

        // Create team member record for the owner
        await this.prisma.teamMember.create({
            data: {
                teamId: defaultTeam.id,
                userId: createdUser.id,
                role: 'TEAM_OWNER',
                status: 'active',
            },
        });

        // Determine bot limit from system settings (fallback: 1)
        const freeBotLimitSetting = await this.prisma.systemSettings.findUnique({
            where: { key: 'FREE_BOT_LIMIT' },
        });
        const botLimit = freeBotLimitSetting ? parseInt(freeBotLimitSetting.value) : 1;

        // Create default quotas
        await this.prisma.quota.createMany({
            data: [
                { teamId: defaultTeam.id, quotaType: 'BOT', limit: botLimit, used: 0 },
                { teamId: defaultTeam.id, quotaType: 'FILE', limit: 100, used: 0 },
                { teamId: defaultTeam.id, quotaType: 'TOKEN', limit: 0, used: 0 },
            ],
        });

        return {
            message: 'User created successfully',
            user: {
                id: createdUser.id,
                name: createdUser.name,
                email: createdUser.email,
                role: createdUser.role,
            },
        };
    }

    async getUserById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                emailVerified: true,
                phoneVerified: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                isDeleted: true,
                deletedAt: true,
                verifiedAt: true,
                Team: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async updateUser(id: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check if email is being changed and if it's already in use
        if (dto.email && dto.email !== user.email) {
            const existingUser = await this.prisma.user.findUnique({
                where: { email: dto.email },
            });

            if (existingUser) {
                throw new BadRequestException('Email already in use');
            }
        }

        // Check if phone is being changed and if it's already in use
        if (dto.phoneNumber && dto.phoneNumber !== user.phoneNumber) {
            const existingUser = await this.prisma.user.findUnique({
                where: { phoneNumber: dto.phoneNumber },
            });

            if (existingUser) {
                throw new BadRequestException('Phone number already in use');
            }
        }

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: dto,
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                emailVerified: true,
                phoneVerified: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                isDeleted: true,
                deletedAt: true,
            },
        });

        return updatedUser;
    }

    async updateUserPassword(id: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await this.prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });

        return { message: 'Password updated successfully' };
    }

    async deleteUser(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.isDeleted) {
            throw new BadRequestException('User already deleted');
        }

        await this.prisma.user.update({
            where: { id },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        });

        return { message: 'User deleted successfully' };
    }

    async restoreUser(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.isDeleted) {
            throw new BadRequestException('User is not deleted');
        }

        await this.prisma.user.update({
            where: { id },
            data: {
                isDeleted: false,
                deletedAt: null,
            },
        });

        return { message: 'User restored successfully' };
    }

    async verifyUserEmail(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.emailVerified) {
            throw new BadRequestException('Email already verified');
        }

        await this.prisma.user.update({
            where: { id },
            data: {
                emailVerified: true,
                verifiedAt: new Date(),
            },
        });

        return { message: 'Email verified successfully' };
    }

    async verifyUserPhone(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.phoneVerified) {
            throw new BadRequestException('Phone already verified');
        }

        await this.prisma.user.update({
            where: { id },
            data: {
                phoneVerified: true,
            },
        });

        return { message: 'Phone verified successfully' };
    }

    async getUserTeamQuotas(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const team = await this.prisma.team.findFirst({
            where: { ownerId: userId },
            include: {
                Quota: true,
            },
        });

        if (!team) {
            return { teamId: null, quotas: [] };
        }

        return { teamId: team.id, quotas: team.Quota };
    }

    async updateUserQuota(userId: string, quotaType: 'BOT' | 'TOKEN', limit: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const team = await this.prisma.team.findFirst({
            where: { ownerId: userId },
        });

        if (!team) {
            throw new NotFoundException('User does not have a team');
        }

        const quota = await this.prisma.quota.upsert({
            where: {
                teamId_quotaType: {
                    teamId: team.id,
                    quotaType,
                },
            },
            update: { limit },
            create: {
                teamId: team.id,
                quotaType,
                limit,
                used: 0,
            },
        });

        return { message: 'Quota updated successfully', quota };
    }

    async getAllChatbots(dto: GetAllChatbotsDto) {
        const { page = 1, limit = 20, search, includeDeleted = true } = dto;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (!includeDeleted) {
            where.isDeleted = false;
        }

        if (search) {
            where.botName = { contains: search, mode: 'insensitive' };
        }

        const [bots, total] = await Promise.all([
            this.prisma.customerBots.findMany({
                where,
                skip,
                take: limit,
                include: {
                    team: {
                        include: {
                            owner: {
                                select: { id: true, name: true, email: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.customerBots.count({ where }),
        ]);

        const botIds = bots.map((b) => b.id);

        const [storageCounts, contentCounts] = await Promise.all([
            this.prisma.storage.groupBy({
                by: ['botId'],
                where: { botId: { in: botIds } },
                _count: { id: true },
            }),
            this.prisma.content.groupBy({
                by: ['botId'],
                where: { botId: { in: botIds } },
                _count: { id: true },
            }),
        ]);

        const storageCountMap: Record<string, number> = Object.fromEntries(
            storageCounts.map((s) => [s.botId, s._count.id]),
        );
        const contentCountMap: Record<string, number> = Object.fromEntries(
            contentCounts.map((c) => [c.botId, c._count.id]),
        );

        const enrichedBots = bots.map((bot) => ({
            ...bot,
            fileCount: storageCountMap[bot.id] || 0,
            contentCount: contentCountMap[bot.id] || 0,
        }));

        return {
            data: enrichedBots,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async hardDeleteBot(botId: string) {
        const bot = await this.prisma.customerBots.findUnique({ where: { id: botId } });

        if (!bot) {
            throw new NotFoundException('Bot not found');
        }

        if (!bot.isDeleted) {
            throw new BadRequestException('Bot must be soft-deleted before hard deletion');
        }

        // Clean up MinIO files
        const bucket = this.configService.get('S3_BUCKET_NAME');
        const storageRecords = await this.prisma.storage.findMany({ where: { botId } });

        for (const file of storageRecords) {
            try {
                await this.minioClientService.delete(file.fileUrl, bucket);
            } catch (err) {
                console.error(`MinIO delete failed for ${file.fileUrl}:`, err);
            }
        }

        // Hard delete all related records in dependency order
        await this.prisma.storage.deleteMany({ where: { botId } });
        await this.prisma.content.deleteMany({ where: { botId } });
        await this.prisma.customerChats.deleteMany({ where: { botId } });
        await this.prisma.customerBots.delete({ where: { id: botId } });

        return { message: 'Bot permanently deleted' };
    }
}

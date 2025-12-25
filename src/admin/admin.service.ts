import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAllUsersDto } from './dto/getAllUsers.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { GetAllTeamsDto } from './dto/getAllTeams.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService
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
                    phonenumber: true,
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

    async getUserById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phonenumber: true,
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
        if (dto.phonenumber && dto.phonenumber !== user.phonenumber) {
            const existingUser = await this.prisma.user.findUnique({
                where: { phonenumber: dto.phonenumber },
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
                phonenumber: true,
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
}

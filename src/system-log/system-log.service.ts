import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogCategory, LogAction, LogStatus } from '../../generated/prisma/client';

export interface CreateLogDto {
    category: LogCategory;
    action: LogAction;
    status: LogStatus;
    userId?: string;
    userName?: string;
    userEmail?: string;
    teamId?: string;
    entityId?: string;
    entityName?: string;
    message?: string;
    details?: any;
    ipAddress?: string;
}

export interface LogQueryParams {
    page?: number;
    limit?: number;
    category?: LogCategory;
    action?: LogAction;
    status?: LogStatus;
    userId?: string;
    teamId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
}

@Injectable()
export class SystemLogService {
    constructor(private prisma: PrismaService) { }

    async createLog(data: CreateLogDto) {
        try {
            return await this.prisma.systemLog.create({ data });
        } catch (error) {
            console.error('Failed to create system log:', error);
        }
    }

    async getLogs(query: LogQueryParams) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 20;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (query.category) {
            where.category = query.category;
        }
        if (query.action) {
            where.action = query.action;
        }
        if (query.status) {
            where.status = query.status;
        }
        if (query.userId) {
            where.userId = query.userId;
        }
        if (query.teamId) {
            where.teamId = query.teamId;
        }
        if (query.search) {
            where.OR = [
                { userName: { contains: query.search, mode: 'insensitive' } },
                { userEmail: { contains: query.search, mode: 'insensitive' } },
                { entityName: { contains: query.search, mode: 'insensitive' } },
                { message: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = new Date(query.startDate);
            }
            if (query.endDate) {
                where.createdAt.lte = new Date(query.endDate);
            }
        }

        const [data, total] = await Promise.all([
            this.prisma.systemLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.systemLog.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getLogById(id: string) {
        return this.prisma.systemLog.findUnique({ where: { id } });
    }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { DeleteIntegrationDto } from './dto/delete-integration.dto';

@Injectable()
export class IntegrationService {
    constructor(private prisma: PrismaService) { }

    async listIntegrations(teamId: string) {
        return this.prisma.integrations.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createIntegration(teamId: string, dto: CreateIntegrationDto) {
        const existing = await this.prisma.integrations.findFirst({
            where: { teamId, type: dto.type },
        });

        if (existing) {
            return this.prisma.integrations.update({
                where: { id: existing.id },
                data: { config: dto.config },
            });
        }

        return this.prisma.integrations.create({
            data: {
                teamId,
                type: dto.type,
                config: dto.config,
            },
        });
    }

    async updateIntegration(teamId: string, dto: UpdateIntegrationDto) {
        const existing = await this.prisma.integrations.findFirst({
            where: { id: dto.id, teamId },
        });

        if (!existing) {
            throw new NotFoundException('Integration not found');
        }

        return this.prisma.integrations.update({
            where: { id: dto.id },
            data: { config: dto.config },
        });
    }

    async deleteIntegration(teamId: string, dto: DeleteIntegrationDto) {
        const existing = await this.prisma.integrations.findFirst({
            where: { id: dto.id, teamId },
        });

        if (!existing) {
            throw new NotFoundException('Integration not found');
        }

        await this.prisma.integrations.delete({
            where: { id: dto.id },
        });

        return { success: true };
    }
}

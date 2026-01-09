import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from 'src/authentication/utils/google.guard';
import { RolesGuard } from 'src/authentication/utils/roles.guard';

@Controller('admin/settings')
@UseGuards(JwtGuard, RolesGuard)
//@Roles('ADMIN')
export class SettingsController {
    constructor(private prisma: PrismaService) { }

    @Get()
    async getSettings() {
        const settings = await this.prisma.systemSettings.findMany();
        const settingsMap = {};
        settings.forEach(setting => {
            settingsMap[setting.key] = {
                value: setting.value,
                description: setting.description,
            };
        });
        return settingsMap;
    }

    @Put()
    async updateSettings(@Body() settings: { key: string; value: string; description?: string }[]) {
        for (const setting of settings) {
            await this.prisma.systemSettings.upsert({
                where: { key: setting.key },
                create: setting,
                update: { value: setting.value, description: setting.description },
            });
        }
        return { message: 'Settings updated successfully' };
    }

    @Get('init')
    async initializeDefaultSettings() {
        const defaults = [
            {
                key: 'FREE_TOKEN_LIMIT',
                value: '100000',
                description: 'Total token limit for free tier users',
            },
            {
                key: 'PREMIUM_MONTHLY_TOKEN_LIMIT',
                value: '2000000',
                description: 'Monthly token allocation for premium users',
            },
            {
                key: 'TOKEN_PRICE_PER_1K',
                value: '0.002',
                description: 'Price per 1000 tokens in USD',
            },
            {
                key: 'PREMIUM_MONTHLY_PRICE',
                value: '29.99',
                description: 'Monthly subscription price for premium tier in USD',
            },
            {
                key: 'FREE_BOT_LIMIT',
                value: '1',
                description: 'Maximum number of bots for free tier users',
            },
            {
                key: 'PREMIUM_BOT_LIMIT',
                value: '10',
                description: 'Maximum number of bots for premium tier users',
            },
        ];

        for (const setting of defaults) {
            await this.prisma.systemSettings.upsert({
                where: { key: setting.key },
                create: setting,
                update: {},
            });
        }

        return { message: 'Default settings initialized' };
    }
}

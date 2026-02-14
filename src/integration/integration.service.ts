import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { DeleteIntegrationDto } from './dto/delete-integration.dto';
import { TestIntegrationDto } from './dto/test-integration.dto';

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
            const updated = await this.prisma.integrations.update({
                where: { id: existing.id },
                data: { config: dto.config },
            });

            await this.syncMcpConfig(teamId);
            return updated;
        }

        const created = await this.prisma.integrations.create({
            data: {
                teamId,
                type: dto.type,
                config: dto.config,
            },
        });

        await this.syncMcpConfig(teamId);
        return created;
    }

    async updateIntegration(teamId: string, dto: UpdateIntegrationDto) {
        const existing = await this.prisma.integrations.findFirst({
            where: { id: dto.id, teamId },
        });

        if (!existing) {
            throw new NotFoundException('Integration not found');
        }

        const updated = await this.prisma.integrations.update({
            where: { id: dto.id },
            data: { config: dto.config },
        });

        await this.syncMcpConfig(teamId);
        return updated;
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

        await this.syncMcpConfig(teamId);

        return { success: true };
    }

    async testIntegrationConnection(teamId: string, dto: TestIntegrationDto) {
        const existing = await this.prisma.integrations.findFirst({
            where: { id: dto.id, teamId },
        });

        if (!existing) {
            throw new NotFoundException('Integration not found');
        }

        if (!this.isDatabaseType(existing.type)) {
            throw new BadRequestException('Connection test is supported for database integrations only');
        }

        const config = this.normalizeConfig(existing.config);
        const dbName = dto.dbName || (config?.database ? String(config.database) : existing.type);
        if (!dbName) {
            throw new BadRequestException('Database name is required for connection test');
        }

        const baseUrl = this.getMcpBaseUrl();
        try {
            const response = await axios.post(
                `${baseUrl}/api/v1/customers/${teamId}/test-connection`,
                null,
                {
                    params: { db_name: dbName },
                    timeout: 10000,
                }
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            const message = axiosError.response?.data || 'MCP connection test failed';
            throw new InternalServerErrorException(message as any);
        }
    }

    private getMcpBaseUrl(): string {
        return process.env.MCP_API_GATEWAY_URL || process.env.MCP_GATEWAY_URL || 'http://localhost:8000';
    }

    private buildDatabaseConnectionString(dbType: string, config: Record<string, any>): string | null {
        if (config?.connectionString) {
            return String(config.connectionString);
        }

        const host = config?.host;
        const port = config?.port;
        const database = config?.database;
        const username = config?.username;
        const password = config?.password;

        if (!host || !port || !database || !username || !password) {
            return null;
        }

        const encodedUser = encodeURIComponent(String(username));
        const encodedPassword = encodeURIComponent(String(password));
        const encodedHost = String(host);
        const encodedPort = String(port);
        const encodedDatabase = encodeURIComponent(String(database));

        return `${dbType}://${encodedUser}:${encodedPassword}@${encodedHost}:${encodedPort}/${encodedDatabase}`;
    }

    private normalizeConfig(config?: Prisma.JsonValue): Record<string, any> {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return {};
        }

        return config as Record<string, any>;
    }

    private isDatabaseType(type: string): boolean {
        return ['mysql', 'postgresql', 'oracle', 'mssql', 'mongodb'].includes(type);
    }

    private buildMcpPayload(teamId: string, integrations: Array<{ type: string; config?: Prisma.JsonValue }>) {
        const databases: Record<string, any> = {};
        const apiIntegrations: Record<string, any> = {};

        integrations.forEach((integration) => {
            const type = integration.type;
            const config = this.normalizeConfig(integration.config);

            if (type === 'mysql' || type === 'postgresql' || type === 'oracle' || type === 'mssql') {
                const connectionString = this.buildDatabaseConnectionString(type, config);
                if (!connectionString) {
                    return;
                }

                const defaultKey = type === 'postgresql' ? 'public_db' : `${type}_db`;
                const defaultName = type === 'postgresql' ? 'Public Database' : `${type} Database`;
                const databaseKey = config?.dbKey ? String(config.dbKey) : defaultKey;
                const databaseName = config?.name ? String(config.name) : defaultName;

                databases[databaseKey] = {
                    connection_string: connectionString,
                    db_type: type,
                    name: databaseName,
                    schema: config?.schema ? String(config.schema) : undefined,
                };
                return;
            }

            if (type === 'whatsapp') {
                if (config?.accessToken && config?.phoneNumberId) {
                    apiIntegrations.whatsapp = {
                        api_token: String(config.accessToken),
                        phone_id: String(config.phoneNumberId),
                    };
                }
            }
        });

        return {
            customer_cuid: teamId,
            databases,
            integrations: apiIntegrations,
        };
    }

    private isConflictError(error: AxiosError): boolean {
        const status = error.response?.status;
        return status === 409;
    }

    private async syncMcpConfig(teamId: string) {
        const integrations = await this.prisma.integrations.findMany({
            where: { teamId },
            orderBy: { createdAt: 'asc' },
        });

        const payload = this.buildMcpPayload(teamId, integrations);
        const hasDatabases = Object.keys(payload.databases).length > 0;
        const hasIntegrations = Object.keys(payload.integrations).length > 0;

        const baseUrl = this.getMcpBaseUrl();

        if (!hasDatabases && !hasIntegrations) {
            try {
                await axios.delete(`${baseUrl}/api/v1/customers/${teamId}`, { timeout: 10000 });
            } catch (error) {
                const axiosError = error as AxiosError;
                if (axiosError.response?.status !== 404) {
                    throw new InternalServerErrorException('MCP config delete failed');
                }
            }
            return;
        }

        console.log('Syncing MCP config with payload:', payload);

        try {
            await axios.post(`${baseUrl}/api/v1/customers`, payload, { timeout: 10000 });
        } catch (error) {
            const axiosError = error as AxiosError;
            if (this.isConflictError(axiosError)) {
                try {
                    await axios.put(`${baseUrl}/api/v1/customers/${teamId}`, payload, { timeout: 10000 });
                    return;
                } catch (updateError) {
                    throw new InternalServerErrorException('MCP config update failed');
                }
            }

            throw new InternalServerErrorException('MCP config create failed');
        }
    }
}

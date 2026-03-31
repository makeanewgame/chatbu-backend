import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { ActionPayload, AuthFlowStep, ProductCard } from './types/action-payload.types';

@Injectable()
export class ActionsService {
    constructor(
        private prisma: PrismaService,
        private httpService: HttpService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async listByBot(botId: string, teamId: string) {
        const bot = await this.prisma.customerBots.findFirst({
            where: { id: botId, teamId, isDeleted: false },
        });
        if (!bot) throw new NotFoundException('Bot not found');

        return this.prisma.botAction.findMany({
            where: { botId },
            orderBy: { priority: 'desc' },
        });
    }

    async create(teamId: string, dto: CreateActionDto) {
        const bot = await this.prisma.customerBots.findFirst({
            where: { id: dto.botId, teamId, isDeleted: false },
        });
        if (!bot) throw new NotFoundException('Bot not found');

        return this.prisma.botAction.create({
            data: {
                botId: dto.botId,
                name: dto.name,
                type: dto.type,
                triggerType: dto.triggerType ?? 'KEYWORD',
                keywords: dto.keywords,
                config: dto.config,
                priority: dto.priority ?? 0,
                isActive: dto.isActive ?? true,
                onError: dto.onError ?? 'fallback',
            },
        });
    }

    async update(teamId: string, dto: UpdateActionDto) {
        const action = await this.prisma.botAction.findFirst({
            where: { id: dto.id },
            include: { bot: { select: { teamId: true } } },
        });
        if (!action) throw new NotFoundException('Action not found');
        if (action.bot.teamId !== teamId) throw new ForbiddenException();

        return this.prisma.botAction.update({
            where: { id: dto.id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.keywords !== undefined && { keywords: dto.keywords }),
                ...(dto.config !== undefined && { config: dto.config }),
                ...(dto.priority !== undefined && { priority: dto.priority }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                ...(dto.onError !== undefined && { onError: dto.onError }),
            },
        });
    }

    async remove(id: string, teamId: string) {
        const action = await this.prisma.botAction.findFirst({
            where: { id },
            include: { bot: { select: { teamId: true } } },
        });
        if (!action) throw new NotFoundException('Action not found');
        if (action.bot.teamId !== teamId) throw new ForbiddenException();

        await this.prisma.botAction.delete({ where: { id } });
        return { message: 'Action deleted' };
    }

    /**
     * Returns a compact description of all active LINK actions for a bot,
     * with variables already substituted in the URL template.
     * Used to inform the FastAPI LLM about available UI actions.
     */
    async getResolvedActionDescriptions(botId: string): Promise<Array<{
        actionId: string;
        name: string;
        description: string;
        type: string;
        data: any;
        keywords: string[];
    }>> {
        const actions = await this.prisma.botAction.findMany({
            where: { botId, isActive: true },
            orderBy: { priority: 'desc' },
        });

        const result = [];
        for (const action of actions) {
            const config = action.config as any;
            if (action.type === 'LINK') {
                let url: string = config.urlTemplate ?? '';
                const variables: Record<string, string> = config.variables ?? {};
                for (const [key, val] of Object.entries(variables)) {
                    const value = String(val);
                    url = url.split(`{{${key}}}`).join(value).split(`{${key}}`).join(value);
                }
                result.push({
                    actionId: action.id,
                    name: action.name,
                    description: `Shows a button/link to: ${config.label ?? url}`,
                    type: 'LINK',
                    data: {
                        url,
                        label: config.label ?? 'Tıklayın',
                        target: config.target ?? '_blank',
                        icon: config.icon,
                    },
                    keywords: action.keywords,
                });
            } else if (action.type === 'WEBHOOK') {
                result.push({
                    actionId: action.id,
                    name: action.name,
                    description: `Triggers a webhook action`,
                    type: 'WEBHOOK',
                    data: {},
                    keywords: action.keywords,
                });
            }
            // PRODUCT_CARDS and AUTH_FLOW require runtime data — skip for LLM hints
        }
        return result;
    }

    /**
     * Keyword-based trigger matching — checks each active action in priority order.
     * Returns the first matched action's payload (or empty array if none match).
     * FastAPI-based intent matching will replace/extend this in a later phase.
     */
    async matchAndProcess(
        botId: string,
        userMessage: string,
        chatId: string,
    ): Promise<ActionPayload[]> {
        const actions = await this.prisma.botAction.findMany({
            where: { botId, isActive: true },
            orderBy: { priority: 'desc' },
        });

        const lowerMessage = userMessage.toLowerCase();

        for (const action of actions) {
            const matched = action.keywords.some((kw) =>
                lowerMessage.includes(kw.toLowerCase()),
            );
            if (!matched) continue;

            try {
                const payload = await this.resolveAction(action, userMessage, chatId);
                if (payload) return [payload];
            } catch (err) {
                console.error(`Action ${action.id} failed:`, err);
                if ((action.onError ?? '').toLowerCase() === 'fallback') continue;
                throw err;
            }
        }

        return [];
    }

    private async resolveAction(
        action: any,
        userMessage: string,
        chatId: string,
    ): Promise<ActionPayload | null> {
        const config = action.config as any;

        switch (action.type) {
            case 'LINK': {
                let url: string = config.urlTemplate ?? '';
                const variables: Record<string, string> = config.variables ?? {};
                for (const [key, val] of Object.entries(variables)) {
                    const value = String(val);
                    url = url
                        .split(`{{${key}}}`).join(value)
                        .split(`{${key}}`).join(value);
                }
                return {
                    type: 'LINK',
                    actionId: action.id,
                    data: {
                        url,
                        label: config.label ?? 'Tıklayın',
                        target: config.target ?? '_blank',
                        icon: config.icon,
                    },
                };
            }

            case 'PRODUCT_CARDS': {
                const result = await this.callWebhook(
                    config.webhookUrl,
                    config.method ?? 'POST',
                    config.webhookSecretHeader,
                    config.webhookSecret,
                    { query: userMessage },
                );
                const schema = config.cardSchema ?? {};
                const items: any[] = Array.isArray(result) ? result : result?.items ?? [];
                const cards: ProductCard[] = items
                    .slice(0, config.maxResults ?? 3)
                    .map((item: any) => ({
                        title: item[schema.title ?? 'title'] ?? '',
                        price: item[schema.price ?? 'price'],
                        image: item[schema.image ?? 'image'],
                        url: item[schema.url ?? 'url'],
                    }));
                return {
                    type: 'PRODUCT_CARDS',
                    actionId: action.id,
                    data: { cards },
                };
            }

            case 'AUTH_FLOW': {
                // If a valid auth session already exists, skip — chat proceeds as authenticated
                const existingSession = await this.prisma.chatAuthSession.findFirst({
                    where: {
                        chatId,
                        botId: action.botId,
                        expiresAt: { gt: new Date() },
                    },
                });
                if (existingSession) return null;

                const steps: AuthFlowStep[] = config.steps ?? [];
                const firstStep = steps[0] ?? null;
                return {
                    type: 'AUTH_FLOW',
                    actionId: action.id,
                    data: { step: firstStep, completed: false },
                };
            }

            case 'WEBHOOK': {
                const result = await this.callWebhook(
                    config.webhookUrl,
                    config.method ?? 'POST',
                    config.webhookSecretHeader,
                    config.webhookSecret,
                    { query: userMessage, chatId },
                );
                return {
                    type: 'WEBHOOK',
                    actionId: action.id,
                    data: {
                        content: typeof result === 'string' ? result : JSON.stringify(result),
                        raw: result,
                    },
                };
            }

            default:
                return null;
        }
    }

    /**
     * Processes a single AUTH_FLOW step submitted by the end-user.
     * Called from the public /bot/auth-step endpoint (validated via embed token).
     */
    async processAuthStep(
        actionId: string,
        stepId: string,
        stepData: Record<string, any>,
        chatId: string,
    ) {
        const action = await this.prisma.botAction.findUnique({
            where: { id: actionId },
        });
        if (!action) throw new NotFoundException('Action not found');

        const config = action.config as any;
        const steps: any[] = config.steps ?? [];
        const currentIndex = steps.findIndex((s) => s.id === stepId);
        if (currentIndex === -1) throw new NotFoundException('Step not found');

        const currentStep = steps[currentIndex];
        const nextStep = steps[currentIndex + 1] ?? null;

        // If current step is a webhook call, execute it
        if (currentStep.type === 'webhook') {
            await this.callWebhook(
                currentStep.webhookUrl,
                currentStep.method ?? 'POST',
                currentStep.webhookSecretHeader,
                currentStep.webhookSecret,
                { ...stepData, chatId },
            );
        }

        // If the next step completes auth, call its webhook and verify
        if (nextStep?.completesAuth) {
            const verifyResult = await this.callWebhook(
                nextStep.webhookUrl,
                nextStep.method ?? 'POST',
                nextStep.webhookSecretHeader,
                nextStep.webhookSecret,
                { ...stepData, chatId },
            );

            if (verifyResult?.verified || verifyResult?.success) {
                const token = await this.jwtService.signAsync(
                    { chatId, botId: action.botId, type: 'chat-auth' },
                    { expiresIn: '30m', secret: this.configService.get('JWT_SECRET') },
                );
                const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

                await this.prisma.chatAuthSession.create({
                    data: { chatId, botId: action.botId, token, expiresAt },
                });

                return {
                    completed: true,
                    authToken: token,
                    message: config.successMessage ?? 'Doğrulama başarılı.',
                };
            }
            return {
                completed: false,
                error: true,
                message: 'Doğrulama başarısız. Tekrar deneyin.',
            };
        }

        // Return the next step for the frontend to render
        if (nextStep) {
            return { completed: false, step: nextStep };
        }
        return { completed: true };
    }

    async validateAuthSession(
        chatId: string,
        botId: string,
        token: string,
    ): Promise<boolean> {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            if (
                payload.type !== 'chat-auth' ||
                payload.chatId !== chatId ||
                payload.botId !== botId
            ) {
                return false;
            }
            const session = await this.prisma.chatAuthSession.findFirst({
                where: { token, chatId, botId, expiresAt: { gt: new Date() } },
            });
            return !!session;
        } catch {
            return false;
        }
    }

    private async callWebhook(
        url: string,
        method: string,
        secretHeader: string | undefined,
        secret: string | undefined,
        payload: any,
    ): Promise<any> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (secretHeader && secret) {
            headers[secretHeader] = secret;
        }

        const response = await firstValueFrom(
            this.httpService
                .request({ method, url, data: payload, headers })
                .pipe(
                    catchError((error: AxiosError) => {
                        console.error(`Webhook call to ${url} failed:`, error.message);
                        throw new Error(`Webhook call failed: ${error.message}`);
                    }),
                ),
        );
        return response.data;
    }
}

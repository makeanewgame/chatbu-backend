import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Server-side Mixpanel client. Modelled on SystemLogService: @Global, every
 * method wrapped in try/catch and fire-and-forget so an analytics failure can
 * never break a request path.
 *
 * Talks to the Mixpanel HTTP API directly (EU residency host) instead of
 * pulling in the `mixpanel` npm package — keeps the dependency surface flat
 * and matches the existing outbound-HTTP style in src/integration/*.
 *
 * Identity contract (see the Mixpanel plan): distinct_id === Prisma User.id
 * (cuid), the same value chatbu-frontend passes to mixpanel.identify(). Team
 * analytics use the "team" group key === Prisma Team.id.
 */
@Injectable()
export class MixpanelService {
    private readonly token: string | undefined;
    private readonly apiHost: string;
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        this.token = this.config.get<string>('MIXPANEL_TOKEN');
        // EU residency — same host chatbu-web / chatbu-frontend use.
        this.apiHost =
            this.config.get<string>('MIXPANEL_API_HOST') ||
            'https://api-eu.mixpanel.com';
        this.enabled = !!this.token;
        if (!this.enabled) {
            this.logger.warn(
                'MixpanelService disabled: MIXPANEL_TOKEN not set — analytics events will be no-ops',
            );
        }
    }

    /**
     * Track an event. `insertId` makes the event idempotent: Mixpanel dedupes
     * on ($insert_id, event, distinct_id, day), so client+server double-sends
     * and webhook retries collapse to one.
     */
    track(
        event: string,
        distinctId: string,
        properties: Record<string, any> = {},
        insertId?: string,
    ): void {
        if (!this.enabled || !distinctId) return;
        const props: Record<string, any> = {
            token: this.token,
            distinct_id: distinctId,
            // `time` intentionally omitted — Mixpanel timestamps on arrival
            // (events are sent synchronously in-request), which sidesteps the
            // seconds-vs-ms ambiguity of the /track endpoint.
            $source: 'chatbu-backend',
            ...this.clean(properties),
        };
        if (insertId) props.$insert_id = insertId;
        // Move a team_id property into Mixpanel group analytics automatically.
        if (props.team_id && !props.$groups) {
            props.$groups = { team: props.team_id };
        }
        this.post('/track', [{ event, properties: props }], { verbose: 1 });
    }

    /** Set profile (people) properties. Skips keys with undefined/null values. */
    setPeople(distinctId: string, properties: Record<string, any>): void {
        if (!this.enabled || !distinctId) return;
        this.post('/engage', [
            {
                $token: this.token,
                $distinct_id: distinctId,
                $set: this.clean(properties),
            },
        ]);
    }

    /** Record revenue on a profile (feeds Mixpanel's revenue reports). */
    trackCharge(
        distinctId: string,
        amount: number,
        properties: Record<string, any> = {},
    ): void {
        if (!this.enabled || !distinctId || !Number.isFinite(amount)) return;
        this.post('/engage', [
            {
                $token: this.token,
                $distinct_id: distinctId,
                $append: {
                    $transactions: {
                        $time: new Date().toISOString(),
                        $amount: amount,
                        ...this.clean(properties),
                    },
                },
            },
        ]);
    }

    /** Set group (organization) properties. groupKey is "team" for Chatbu. */
    setGroup(
        groupKey: string,
        groupId: string,
        properties: Record<string, any>,
    ): void {
        if (!this.enabled || !groupId) return;
        this.post('/groups', [
            {
                $token: this.token,
                $group_key: groupKey,
                $group_id: groupId,
                $set: this.clean(properties),
            },
        ]);
    }

    /**
     * Resolve the analytics identity for a userId: the distinct_id (= userId)
     * and the user's primary team id (group key). Never throws.
     */
    async resolveIdentity(
        userId: string,
    ): Promise<{ distinctId: string; teamId: string | null }> {
        let teamId: string | null = null;
        try {
            const ownedTeam = await this.prisma.team.findFirst({
                where: { ownerId: userId },
                select: { id: true },
            });
            if (ownedTeam) {
                teamId = ownedTeam.id;
            } else {
                const member = await this.prisma.teamMember.findFirst({
                    where: { userId, status: 'active' },
                    select: { teamId: true },
                    orderBy: { createdAt: 'asc' },
                });
                teamId = member?.teamId ?? null;
            }
        } catch (err) {
            this.logger.error('MixpanelService.resolveIdentity failed', {
                userId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return { distinctId: userId, teamId };
    }

    /**
     * Resolve the team owner's userId — used to attribute events that are only
     * known at the team level (e.g. an end-customer's first conversation) to a
     * real Mixpanel profile.
     */
    async resolveTeamOwner(
        teamId: string,
    ): Promise<{ ownerId: string | null }> {
        try {
            const team = await this.prisma.team.findUnique({
                where: { id: teamId },
                select: { ownerId: true },
            });
            return { ownerId: team?.ownerId ?? null };
        } catch (err) {
            this.logger.error('MixpanelService.resolveTeamOwner failed', {
                teamId,
                error: err instanceof Error ? err.message : String(err),
            });
            return { ownerId: null };
        }
    }

    // --- internals -------------------------------------------------------

    /** Drop undefined/null props and anything that looks like PII we must not send. */
    private clean(properties: Record<string, any>): Record<string, any> {
        const BLOCKED = new Set([
            'password',
            'accessToken',
            'access_token',
            'refreshToken',
            'refresh_token',
            'token',
            'card',
            'cardNumber',
            'cvc',
        ]);
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(properties || {})) {
            if (v === undefined || v === null) continue;
            if (BLOCKED.has(k)) continue;
            out[k] = v;
        }
        return out;
    }

    private post(path: string, body: unknown, params?: Record<string, any>): void {
        // Fire-and-forget. Never await in a request path.
        void axios
            .post(`${this.apiHost}${path}`, body, {
                params,
                headers: { 'Content-Type': 'application/json' },
                timeout: 4000,
            })
            .catch((err) => {
                this.logger.error(`Mixpanel ${path} failed`, {
                    error: err instanceof Error ? err.message : String(err),
                });
            });
    }
}

import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { MailService } from 'src/mail/mail.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { HandoffNotificationService } from './handoff-notification.service';

/**
 * Team-wide round-robin: consecutive handoffs rotate across the members
 * flagged `canLiveChat`, wrapping around, and fall back cleanly when the
 * pool is empty.
 */
describe('HandoffNotificationService.resolveAssigneeId', () => {
    let service: HandoffNotificationService;
    let prisma: {
        team: { findUnique: jest.Mock; update: jest.Mock };
        teamMember: { findMany: jest.Mock };
    };

    const TEAM_ID = 'team_1';

    beforeEach(async () => {
        prisma = {
            team: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
            teamMember: { findMany: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HandoffNotificationService,
                { provide: PrismaService, useValue: prisma },
                { provide: EventsGateway, useValue: {} },
                { provide: MailService, useValue: {} },
                { provide: PushNotificationService, useValue: {} },
                { provide: WINSTON_MODULE_PROVIDER, useValue: { error: jest.fn() } },
            ],
        }).compile();

        service = module.get(HandoffNotificationService);
    });

    function withTeam(over: Record<string, unknown> = {}) {
        prisma.team.findUnique.mockResolvedValue({
            ownerId: 'owner',
            defaultLiveChatAgentId: null,
            lastLiveChatAgentId: null,
            ...over,
        });
    }
    function withPool(...userIds: string[]) {
        prisma.teamMember.findMany.mockResolvedValue(
            userIds.map((userId) => ({ userId })),
        );
    }

    it('starts at the first member when the cursor is unset', async () => {
        withTeam({ lastLiveChatAgentId: null });
        withPool('a', 'b', 'c');
        expect(await service.resolveAssigneeId(TEAM_ID, null)).toBe('a');
    });

    it('picks the member after the cursor', async () => {
        withTeam({ lastLiveChatAgentId: 'a' });
        withPool('a', 'b', 'c');
        expect(await service.resolveAssigneeId(TEAM_ID, null)).toBe('b');
    });

    it('wraps around from the last member back to the first', async () => {
        withTeam({ lastLiveChatAgentId: 'c' });
        withPool('a', 'b', 'c');
        expect(await service.resolveAssigneeId(TEAM_ID, null)).toBe('a');
    });

    it('starts over when the cursor is no longer in the pool', async () => {
        withTeam({ lastLiveChatAgentId: 'gone' });
        withPool('a', 'b', 'c');
        expect(await service.resolveAssigneeId(TEAM_ID, null)).toBe('a');
    });

    it('falls back to defaultLiveChatAgentId when nobody is flagged', async () => {
        withTeam({ defaultLiveChatAgentId: 'fallback' });
        withPool();
        expect(await service.resolveAssigneeId(TEAM_ID, null)).toBe('fallback');
    });

    it('falls back to the legacy bot setting, then the owner', async () => {
        withTeam();
        withPool();
        expect(
            await service.resolveAssigneeId(TEAM_ID, { defaultAgentId: 'legacy' }),
        ).toBe('legacy');

        withTeam();
        withPool();
        expect(await service.resolveAssigneeId(TEAM_ID, null)).toBe('owner');
    });

    it('rotates A -> B -> C -> A across successive assignments', async () => {
        const seq: string[] = [];
        let cursor: string | null = null;
        for (let i = 0; i < 4; i++) {
            withTeam({ lastLiveChatAgentId: cursor });
            withPool('a', 'b', 'c');
            const picked = await service.resolveAssigneeId(TEAM_ID, null);
            seq.push(picked as string);
            await service.recordLiveChatAssignment(TEAM_ID, picked as string);
            cursor = picked;
        }
        expect(seq).toEqual(['a', 'b', 'c', 'a']);
        expect(prisma.team.update).toHaveBeenCalledWith({
            where: { id: TEAM_ID },
            data: { lastLiveChatAgentId: 'a' },
        });
    });
});

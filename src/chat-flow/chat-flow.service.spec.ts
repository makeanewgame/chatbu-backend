import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FlowKind } from '../../generated/prisma/client';
import { ChatFlowService } from './chat-flow.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ChatFlowService', () => {
  let service: ChatFlowService;
  let prisma: {
    perChatFlowState: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const botId = 'bot-1';
  const chatId = 'chat-1';

  beforeEach(async () => {
    prisma = {
      perChatFlowState: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatFlowService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ChatFlowService);
  });

  describe('transition', () => {
    it('rejects empty botId', async () => {
      await expect(
        service.transition('', chatId, FlowKind.LEAD, { to: 'CONSENT_OK' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty chatId', async () => {
      await expect(
        service.transition(botId, '', FlowKind.LEAD, { to: 'CONSENT_OK' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty target state', async () => {
      // TypeScript's per-FlowKind LeadState literal-union prevents this
      // at compile time; the runtime guard still needs to be verified
      // for callers that bypass TS (e.g. JS callers or `any` casts).
      await expect(
        service.transition(botId, chatId, FlowKind.LEAD, { to: '' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new row when none exists and no `from` is provided', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue(null);
      prisma.perChatFlowState.upsert.mockResolvedValue({});

      await service.transition(botId, chatId, FlowKind.LEAD, { to: 'CONSENT_OK' });

      expect(prisma.perChatFlowState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { botId_chatId_flowKind: { botId, chatId, flowKind: FlowKind.LEAD } },
          create: expect.objectContaining({ state: 'CONSENT_OK', botId, chatId, flowKind: FlowKind.LEAD }),
        }),
      );
    });

    it('rejects when `from` specified but no row exists', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue(null);

      await expect(
        service.transition(botId, chatId, FlowKind.LEAD, { from: 'CONSENT_OK', to: 'OTP_SENT' }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TRANSITION', reason: 'no_existing_row' },
      });
      expect(prisma.perChatFlowState.upsert).not.toHaveBeenCalled();
    });

    it('rejects when `from` mismatches current state (optimistic lock)', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue({ state: 'CONSENT_OK' });

      await expect(
        service.transition(botId, chatId, FlowKind.LEAD, { from: 'OTP_SENT', to: 'OTP_VERIFIED' }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TRANSITION', reason: 'state_mismatch', actual: 'CONSENT_OK' },
      });
      expect(prisma.perChatFlowState.upsert).not.toHaveBeenCalled();
    });

    it('is a no-op when target state equals current and no payload update', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue({ state: 'CONSENT_OK' });

      await service.transition(botId, chatId, FlowKind.LEAD, { from: 'CONSENT_OK', to: 'CONSENT_OK' });

      expect(prisma.perChatFlowState.upsert).not.toHaveBeenCalled();
    });

    it('advances when `from` matches', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue({ state: 'CONSENT_OK' });
      prisma.perChatFlowState.upsert.mockResolvedValue({});

      await service.transition(botId, chatId, FlowKind.LEAD, { from: 'CONSENT_OK', to: 'OTP_SENT' });

      expect(prisma.perChatFlowState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ state: 'OTP_SENT', enteredAt: expect.any(Date) }),
        }),
      );
    });

    it('stores payload when provided (create path)', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue(null);
      prisma.perChatFlowState.upsert.mockResolvedValue({});

      await service.transition(botId, chatId, FlowKind.LEAD, {
        to: 'OTP_SENT',
        payload: { phone: '05321112233' },
      });

      expect(prisma.perChatFlowState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ payload: { phone: '05321112233' } }),
        }),
      );
    });

    it('does NOT reset enteredAt on same-state payload-only update', async () => {
      prisma.perChatFlowState.findUnique.mockResolvedValue({ state: 'OTP_SENT' });
      prisma.perChatFlowState.upsert.mockResolvedValue({});

      await service.transition(botId, chatId, FlowKind.LEAD, {
        from: 'OTP_SENT',
        to: 'OTP_SENT',
        payload: { code_sent_at: '2026-07-30T12:00:00Z' },
      });

      const call = prisma.perChatFlowState.upsert.mock.calls[0][0];
      expect(call.update).toEqual(expect.objectContaining({ state: 'OTP_SENT' }));
      expect(call.update).not.toHaveProperty('enteredAt');
    });
  });

  describe('list', () => {
    it('returns empty array for empty botId', async () => {
      expect(await service.list('', chatId)).toEqual([]);
      expect(prisma.perChatFlowState.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array for empty chatId', async () => {
      expect(await service.list(botId, '')).toEqual([]);
      expect(prisma.perChatFlowState.findMany).not.toHaveBeenCalled();
    });

    it('queries only the required columns (never leaks internal fields like id/updatedAt)', async () => {
      prisma.perChatFlowState.findMany.mockResolvedValue([]);
      await service.list(botId, chatId);
      const call = prisma.perChatFlowState.findMany.mock.calls[0][0];
      expect(call.select).toEqual({
        flowKind: true,
        state: true,
        enteredAt: true,
        payload: true,
      });
      expect(call.orderBy).toEqual({ enteredAt: 'desc' });
    });

    it('passes through rows verbatim', async () => {
      const rows = [
        { flowKind: FlowKind.LEAD, state: 'OTP_SENT', enteredAt: new Date(), payload: null },
      ];
      prisma.perChatFlowState.findMany.mockResolvedValue(rows);
      expect(await service.list(botId, chatId)).toEqual(rows);
    });
  });
});

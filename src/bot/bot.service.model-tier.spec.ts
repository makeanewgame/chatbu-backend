/**
 * BotService.updateModelTier — since 2026-09-11 Sonnet is the default for
 * new bots and no longer Premium-only. Any team may pick either tier; the
 * only remaining checks are "is it a known tier" and "is it your bot".
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { BotService } from './bot.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SystemLogService } from 'src/system-log/system-log.service';
import { DEFAULT_MODEL_TIER } from './model-tier.constants';

describe('BotService.updateModelTier', () => {
  let service: BotService;
  let prisma: {
    customerBots: { findUnique: jest.Mock; update: jest.Mock };
    team: { findUnique: jest.Mock };
    subscription: { findFirst: jest.Mock };
  };
  let createLog: jest.Mock;

  const bot = { id: 'bot-1', teamId: 'team-1', botName: 'Bot', modelTier: 'haiku' };

  beforeEach(async () => {
    prisma = {
      customerBots: {
        findUnique: jest.fn().mockResolvedValue(bot),
        update: jest.fn().mockImplementation(({ data }) => ({ ...bot, ...data })),
      },
      team: { findUnique: jest.fn() },
      subscription: { findFirst: jest.fn() },
    };
    createLog = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: PrismaService, useValue: prisma },
        { provide: SystemLogService, useValue: { createLog } },
        ...['MailService', 'JwtService', 'AwsSecretsService', 'AuthService'].map(
          (token) => ({ provide: token, useValue: {} }),
        ),
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get(BotService);
  });

  it('defaults new bots to sonnet', () => {
    expect(DEFAULT_MODEL_TIER).toBe('sonnet');
  });

  it('lets a team without any subscription switch to sonnet', async () => {
    const out = await service.updateModelTier({ botId: 'bot-1', modelTier: 'sonnet' }, 'team-1');

    expect(out.bot.modelTier).toBe('sonnet');
    expect(prisma.customerBots.update).toHaveBeenCalledWith({
      where: { id: 'bot-1' },
      data: { modelTier: 'sonnet' },
    });
    // No plan lookup at all any more.
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS' }));
  });

  it('still lets a team pick haiku', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({ ...bot, modelTier: 'sonnet' });
    const out = await service.updateModelTier({ botId: 'bot-1', modelTier: 'haiku' }, 'team-1');
    expect(out.bot.modelTier).toBe('haiku');
  });

  it('rejects an unknown tier', async () => {
    await expect(
      service.updateModelTier({ botId: 'bot-1', modelTier: 'opus' as any }, 'team-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.customerBots.update).not.toHaveBeenCalled();
  });

  it("rejects another team's bot", async () => {
    await expect(
      service.updateModelTier({ botId: 'bot-1', modelTier: 'sonnet' }, 'team-2'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.customerBots.update).not.toHaveBeenCalled();
  });
});

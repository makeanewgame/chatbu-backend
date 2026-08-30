/**
 * Tests for BotService.getChannelSettings — Slice 1c of backlog #23
 * (channel-aware chat architecture). The endpoint returns
 * owner-editable fallback contact info stored in
 * CustomerBots.settings.fallbackContact, consumed by the FastAPI
 * gateway's bot_channel_settings probe so the non-widget channel-guard
 * block can redirect Instagram DM / Messenger / WhatsApp visitors to a
 * concrete off-platform channel.
 *
 * Focus: defensive parse of the untrusted `settings` JSON column, empty
 * / null-safe returns, string trimming, and stripping of undefined keys
 * from the response payload.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { BotService } from './bot.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('BotService.getChannelSettings', () => {
  let service: BotService;
  let prisma: { customerBots: { findUnique: jest.Mock } };

  const botId = 'bot-1';

  beforeEach(async () => {
    prisma = { customerBots: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: PrismaService, useValue: prisma },
        ...['MailService', 'JwtService', 'AwsSecretsService', 'AuthService'].map(
          (token) => ({ provide: token, useValue: {} }),
        ),
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get(BotService);
  });

  it('throws NotFoundException when bot is missing', async () => {
    prisma.customerBots.findUnique.mockResolvedValue(null);
    await expect(service.getChannelSettings(botId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns empty fallbackContact when settings is null', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({ settings: null });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({ fallbackContact: {} });
  });

  it('returns empty fallbackContact when settings is empty object', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({ settings: {} });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({ fallbackContact: {} });
  });

  it('returns empty fallbackContact when fallbackContact key absent', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: { queryUrlAllowGlobs: [], smsVerificationRequired: true },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({ fallbackContact: {} });
  });

  it('extracts url + phone + email + hint verbatim', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        fallbackContact: {
          url: 'https://example.com/book',
          phone: '+90 555 111 2233',
          email: 'hello@example.com',
          hint: 'Best reached weekdays 9-5',
        },
      },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({
      fallbackContact: {
        url: 'https://example.com/book',
        phone: '+90 555 111 2233',
        email: 'hello@example.com',
        hint: 'Best reached weekdays 9-5',
      },
    });
  });

  it('trims whitespace and drops empty-string fields', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        fallbackContact: {
          url: '  https://example.com  ',
          phone: '   ',
          email: '',
          hint: 'valid hint',
        },
      },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({
      fallbackContact: {
        url: 'https://example.com',
        hint: 'valid hint',
      },
    });
  });

  it('ignores non-string values defensively', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        fallbackContact: {
          url: 12345,
          phone: null,
          email: { nested: 'oops' },
          hint: ['array', 'here'],
        },
      },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({ fallbackContact: {} });
  });

  it('ignores fallbackContact when set to an array (not object)', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: { fallbackContact: ['not', 'valid'] },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({ fallbackContact: {} });
  });

  it('ignores fallbackContact when set to a plain string', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: { fallbackContact: 'https://example.com' },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({ fallbackContact: {} });
  });

  it('partial config: only url set', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: { fallbackContact: { url: 'https://example.com/book' } },
    });
    const out = await service.getChannelSettings(botId);
    expect(out).toEqual({
      fallbackContact: { url: 'https://example.com/book' },
    });
  });
});

/**
 * Tests for BotService.getRetrievalSettings — Phase D-2 of the
 * retrieval quality overhaul plan. The endpoint returns per-bot
 * query-time URL glob preferences read from CustomerBots.settings,
 * consumed by the FastAPI gateway's RetrievalMiddleware.
 *
 * Focus: parse defensively — the `settings` JSON column is untrusted
 * shape-wise (users, older schema versions, migrations) and one
 * malformed entry must not break the retrieval pipeline downstream.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { BotService } from './bot.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('BotService.getRetrievalSettings', () => {
  let service: BotService;
  let prisma: { customerBots: { findUnique: jest.Mock } };

  const botId = 'bot-1';

  beforeEach(async () => {
    prisma = { customerBots: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: PrismaService, useValue: prisma },
        // BotService's constructor pulls other services — we don't
        // exercise those code paths, so stub as `{}`.
        ...['MailService', 'JwtService', 'AwsSecretsService', 'AuthService'].map(
          (token) => ({ provide: token, useValue: {} }),
        ),
      ],
    })
      // BotService references many optional providers via property
      // injection; overrideProvider chains would be tedious. Instead
      // treat any unknown provider as an empty stub via useValue({}).
      .useMocker(() => ({}))
      .compile();

    service = module.get(BotService);
  });

  it('throws NotFoundException when bot is missing', async () => {
    prisma.customerBots.findUnique.mockResolvedValue(null);
    await expect(service.getRetrievalSettings(botId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns empty arrays when settings is null', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({ settings: null });
    const out = await service.getRetrievalSettings(botId);
    expect(out).toEqual({
      queryUrlAllowGlobs: [],
      queryUrlDenyGlobs: [],
      queryUrlBoostGlobs: [],
    });
  });

  it('returns valid string arrays and boost items unchanged', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        queryUrlAllowGlobs: ['*/products/*', '*/services/*'],
        queryUrlDenyGlobs: ['*/blog/*'],
        queryUrlBoostGlobs: [{ glob: '*/prices/*', boost: 1.5 }],
      },
    });
    const out = await service.getRetrievalSettings(botId);
    expect(out.queryUrlAllowGlobs).toEqual(['*/products/*', '*/services/*']);
    expect(out.queryUrlDenyGlobs).toEqual(['*/blog/*']);
    expect(out.queryUrlBoostGlobs).toEqual([{ glob: '*/prices/*', boost: 1.5 }]);
  });

  it('filters non-string entries and blank/whitespace-only globs', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        queryUrlAllowGlobs: ['*/products/*', '', '   ', null, 42, { glob: 'x' }],
        queryUrlDenyGlobs: ['   ', 'valid'],
      },
    });
    const out = await service.getRetrievalSettings(botId);
    expect(out.queryUrlAllowGlobs).toEqual(['*/products/*']);
    expect(out.queryUrlDenyGlobs).toEqual(['valid']);
  });

  it('defaults boost to 1.15 when missing or non-numeric', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        queryUrlBoostGlobs: [
          { glob: '*/a/*' },                              // boost missing
          { glob: '*/b/*', boost: 'not-a-number' },       // wrong type
          { glob: '*/c/*', boost: NaN },                  // non-finite
          { glob: '*/d/*', boost: 2.0 },                  // valid
        ],
      },
    });
    const out = await service.getRetrievalSettings(botId);
    expect(out.queryUrlBoostGlobs).toEqual([
      { glob: '*/a/*', boost: 1.15 },
      { glob: '*/b/*', boost: 1.15 },
      { glob: '*/c/*', boost: 1.15 },
      { glob: '*/d/*', boost: 2.0 },
    ]);
  });

  it('drops boost entries without a valid glob string', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        queryUrlBoostGlobs: [
          { glob: 'good', boost: 1.5 },
          { glob: '' },                    // blank glob
          { glob: '   ' },                 // whitespace glob
          {},                              // no glob key
          { glob: 42 },                    // wrong type
          null,                            // not an object
          'stringy',                       // not an object
        ],
      },
    });
    const out = await service.getRetrievalSettings(botId);
    expect(out.queryUrlBoostGlobs).toEqual([{ glob: 'good', boost: 1.5 }]);
  });

  it('ignores wrong-typed top-level fields (defensive parse)', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        queryUrlAllowGlobs: 'not-an-array',      // string, not string[]
        queryUrlDenyGlobs: { glob: 'x' },        // object
        queryUrlBoostGlobs: 42,                  // number
      },
    });
    const out = await service.getRetrievalSettings(botId);
    expect(out).toEqual({
      queryUrlAllowGlobs: [],
      queryUrlDenyGlobs: [],
      queryUrlBoostGlobs: [],
    });
  });

  it('coexists with unrelated settings keys — plucks only its own three', async () => {
    prisma.customerBots.findUnique.mockResolvedValue({
      settings: {
        title: 'Some Bot',
        avatarUrl: '5',
        ingestMinChars: 200,
        queryUrlDenyGlobs: ['*/tag/*'],
      },
    });
    const out = await service.getRetrievalSettings(botId);
    expect(out.queryUrlDenyGlobs).toEqual(['*/tag/*']);
    expect(out.queryUrlAllowGlobs).toEqual([]);
    expect(out.queryUrlBoostGlobs).toEqual([]);
    // No leakage of unrelated keys.
    expect(out).not.toHaveProperty('title');
    expect(out).not.toHaveProperty('ingestMinChars');
  });
});

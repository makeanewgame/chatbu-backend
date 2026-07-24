/**
 * Regression guard for the 2026-07-24 prod race condition:
 * `ingestWebPages` was dispatching the ML worker HTTP call BEFORE
 * persisting the Content rows for the new URLs. The ML worker's
 * background task queries `Content WHERE status=UPLOADED` as soon
 * as the HTTP call lands — it snapshots the DB at that instant. If
 * the snapshot ran mid-way through Prisma's per-URL creates, the
 * later rows never entered the ML query result and stayed
 * `UPLOADED` forever (34 of 89 URLs on veribilimiokulu prod).
 *
 * Fix: persist all Content rows first, THEN call ML.
 *
 * These tests lock in the ordering: Prisma writes MUST complete
 * before the ML dispatch fires.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { ContentService } from './content.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ContentService.ingestWebPages — Content-before-ML ordering', () => {
  let service: ContentService;
  let callSequence: string[];

  // Track the exact order Prisma / HTTP / IngestBatch operations happen.
  const record = (label: string) => callSequence.push(label);

  const prisma: any = {
    content: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ingestBatch: {
      create: jest.fn(),
    },
    team: { findFirst: jest.fn() },
  };
  const httpService: any = { post: jest.fn() };
  const configService: any = { get: jest.fn().mockReturnValue('http://ml-worker') };

  const user = { teamId: 't1', sub: 'u1', email: 'e@x' } as any;
  const botId = 'bot-1';

  beforeEach(async () => {
    callSequence = [];
    jest.clearAllMocks();

    // Default "quota is fine" behavior.
    prisma.content.findMany.mockImplementation(async (args: any) => {
      record(`prisma.content.findMany:${args?.where?.type ?? '?'}`);
      // First call — existingWebpages lookup for dedup.
      if (args?.where?.type === 'WEBPAGE') {
        return [];  // no existing → all URLs are new
      }
      return [];
    });
    prisma.content.create.mockImplementation(async (args: any) => {
      record(`prisma.content.create:${(args.data.content as any).url}`);
      return { id: `content-${(args.data.content as any).url}` };
    });
    prisma.content.updateMany.mockImplementation(async (args: any) => {
      record(`prisma.content.updateMany:${(args.data as any).status}`);
      return { count: 1 };
    });
    prisma.ingestBatch.create.mockImplementation(async () => {
      record('prisma.ingestBatch.create');
      return {};
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: PrismaService, useValue: prisma },
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    })
      .useMocker(() => ({
        getQuota: jest.fn().mockResolvedValue({ remainingKb: 999999, remainingMb: 999 }),
        loadPerBotIngestKnobs: jest.fn().mockResolvedValue({}),
        deleteIngestedContent: jest.fn().mockResolvedValue(undefined),
        createLog: jest.fn().mockResolvedValue(undefined),
      }))
      .compile();

    service = module.get(ContentService);

    // Stub the two private helpers that would otherwise hit external services.
    (service as any).getQuota = jest.fn().mockResolvedValue({
      remainingKb: 999999,
      remainingMb: 999,
    });
    (service as any).loadPerBotIngestKnobs = jest.fn().mockResolvedValue({});
  });

  it('creates every Content row BEFORE dispatching the ML worker', async () => {
    httpService.post.mockImplementation(() => {
      record('httpService.post:ML');
      return of({ data: { task_id: 'task-abc' } } as AxiosResponse);
    });

    await service.ingestWebPages(
      { botId, urls: ['https://x.com/a', 'https://x.com/b', 'https://x.com/c'], forceReingest: false },
      user,
    );

    // Every Content create must land BEFORE the ML HTTP call. Without
    // this ordering the ML worker's snapshot query can race the
    // Prisma inserts and miss URLs (2026-07-24 prod bug).
    const idxCreateA = callSequence.indexOf('prisma.content.create:https://x.com/a');
    const idxCreateB = callSequence.indexOf('prisma.content.create:https://x.com/b');
    const idxCreateC = callSequence.indexOf('prisma.content.create:https://x.com/c');
    const idxHttpPost = callSequence.indexOf('httpService.post:ML');

    expect(idxCreateA).toBeGreaterThanOrEqual(0);
    expect(idxCreateB).toBeGreaterThanOrEqual(0);
    expect(idxCreateC).toBeGreaterThanOrEqual(0);
    expect(idxHttpPost).toBeGreaterThan(idxCreateA);
    expect(idxHttpPost).toBeGreaterThan(idxCreateB);
    expect(idxHttpPost).toBeGreaterThan(idxCreateC);
  });

  it('rolls back new Content rows to FAILED when the ML dispatch throws', async () => {
    // ML worker unreachable — pipeline error.
    httpService.post.mockImplementation(() => {
      record('httpService.post:ML(threw)');
      return throwError(() => new Error('ML down'));
    });

    const result = await service.ingestWebPages(
      { botId, urls: ['https://x.com/a', 'https://x.com/b'], forceReingest: false },
      user,
    );

    // The outer method catches and returns a message; look at the
    // side-effect chain.
    expect(result).toEqual(expect.objectContaining({ success: false }));

    // Content rows for the new URLs got flipped to FAILED (not left
    // as UPLOADED "ghosts" that would confuse the owner).
    const rollbackCalls = callSequence.filter((c) => c === 'prisma.content.updateMany:FAILED');
    expect(rollbackCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('creates IngestBatch snapshot AFTER Content rows exist', async () => {
    httpService.post.mockImplementation(() => {
      record('httpService.post:ML');
      return of({ data: { task_id: 'task-abc' } } as AxiosResponse);
    });

    await service.ingestWebPages(
      { botId, urls: ['https://x.com/a'], forceReingest: false },
      user,
    );

    const idxCreate = callSequence.indexOf('prisma.content.create:https://x.com/a');
    const idxBatch = callSequence.indexOf('prisma.ingestBatch.create');

    expect(idxCreate).toBeGreaterThanOrEqual(0);
    expect(idxBatch).toBeGreaterThan(idxCreate);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LegalDocumentService } from './legal-document.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('LegalDocumentService', () => {
  let service: LegalDocumentService;
  let prisma: {
    legalDocument: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; delete: jest.Mock };
    legalDocumentVersion: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    legalDocumentContent: { upsert: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    legalDocumentAcceptance: { create: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const documentId = 'doc-1';
  const document = { id: documentId, slug: 'kvkk', name: 'KVKK Aydınlatma Metni', sourceLocale: 'tr' };

  beforeEach(async () => {
    prisma = {
      legalDocument: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
      legalDocumentVersion: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      legalDocumentContent: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      legalDocumentAcceptance: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LegalDocumentService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(LegalDocumentService);
  });

  describe('createDraftVersion', () => {
    it('creates version 1 with a Turkish SOURCE content row when no prior version exists', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue(null);
      prisma.legalDocumentVersion.create.mockResolvedValue({ id: 'v1', versionNumber: 1 });

      await service.createDraftVersion('kvkk', { title: 'KVKK', bodyMarkdown: '# metin' }, 'admin-1');

      expect(prisma.legalDocumentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId,
            versionNumber: 1,
            status: 'DRAFT',
            createdByAdminId: 'admin-1',
            contents: {
              create: expect.objectContaining({ locale: 'tr', translationStatus: 'SOURCE' }),
            },
          }),
        }),
      );
    });

    it('increments off the latest existing version number', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({ versionNumber: 3 });
      prisma.legalDocumentVersion.create.mockResolvedValue({ id: 'v4', versionNumber: 4 });

      await service.createDraftVersion('kvkk', { title: 'KVKK', bodyMarkdown: '# v4' }, 'admin-1');

      expect(prisma.legalDocumentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 4 }) }),
      );
    });

    it('throws NotFoundException for an unknown document slug', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.createDraftVersion('unknown', { title: 'x', bodyMarkdown: 'y' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContent', () => {
    it('marks a non-Turkish translation as TRANSLATED (not auto-approved)', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'DRAFT' });
      prisma.legalDocumentContent.upsert.mockResolvedValue({});

      await service.updateContent('kvkk', 'v1', 'en', { title: 'KVKK Notice', bodyMarkdown: '# text' });

      expect(prisma.legalDocumentContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ locale: 'en', translationStatus: 'TRANSLATED' }),
          update: expect.objectContaining({ translationStatus: 'TRANSLATED' }),
        }),
      );
    });

    it('rejects editing the Turkish source once the version is published', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'PUBLISHED' });

      await expect(
        service.updateContent('kvkk', 'v1', 'tr', { title: 'x', bodyMarkdown: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('still allows adding/editing a translation on an already-published version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'PUBLISHED' });
      prisma.legalDocumentContent.upsert.mockResolvedValue({});

      await service.updateContent('kvkk', 'v1', 'en', { title: 'Privacy Policy', bodyMarkdown: '# text' });

      expect(prisma.legalDocumentContent.upsert).toHaveBeenCalled();
    });

    it('rejects any edit once the version is archived', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'ARCHIVED' });

      await expect(
        service.updateContent('kvkk', 'v1', 'en', { title: 'x', bodyMarkdown: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unsupported locale', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);

      await expect(
        service.updateContent('kvkk', 'v1', 'zz', { title: 'x', bodyMarkdown: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveTranslation', () => {
    it("refuses to approve the document's source locale", async () => {
      // Source-locale check compares against the DOCUMENT's own
      // sourceLocale since Slice 6, so the version lookup now precedes it.
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'DRAFT' });

      await expect(service.approveTranslation('kvkk', 'v1', 'tr', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('marks an existing translation APPROVED', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'DRAFT' });
      prisma.legalDocumentContent.findUnique.mockResolvedValue({ id: 'content-en', locale: 'en' });
      prisma.legalDocumentContent.update.mockResolvedValue({});

      await service.approveTranslation('kvkk', 'v1', 'en', 'admin-1');

      expect(prisma.legalDocumentContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'content-en' },
          data: expect.objectContaining({ translationStatus: 'APPROVED', approvedByAdminId: 'admin-1' }),
        }),
      );
    });

    it('allows approving a translation on an already-published version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'PUBLISHED' });
      prisma.legalDocumentContent.findUnique.mockResolvedValue({ id: 'content-en', locale: 'en' });
      prisma.legalDocumentContent.update.mockResolvedValue({});

      await service.approveTranslation('kvkk', 'v1', 'en', 'admin-1');

      expect(prisma.legalDocumentContent.update).toHaveBeenCalled();
    });

    it('rejects approving a translation once the version is archived', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId, status: 'ARCHIVED' });

      await expect(service.approveTranslation('kvkk', 'v1', 'en', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('publishVersion', () => {
    it('archives the previously published version and publishes the draft', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({
        id: 'v2',
        documentId,
        status: 'DRAFT',
        contents: [{ locale: 'tr' }],
      });
      prisma.legalDocumentVersion.updateMany.mockResolvedValue({ count: 1 });
      prisma.legalDocumentVersion.update.mockResolvedValue({ id: 'v2', status: 'PUBLISHED' });

      await service.publishVersion('kvkk', 'v2');

      expect(prisma.legalDocumentVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId, status: 'PUBLISHED' },
          data: expect.objectContaining({ status: 'ARCHIVED' }),
        }),
      );
      expect(prisma.legalDocumentVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'v2' },
          data: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });

    it('refuses to publish a version with no Turkish source content', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({
        id: 'v2',
        documentId,
        status: 'DRAFT',
        contents: [],
      });

      await expect(service.publishVersion('kvkk', 'v2')).rejects.toThrow(BadRequestException);
    });

    it('refuses to re-publish a non-draft version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({
        id: 'v2',
        documentId,
        status: 'PUBLISHED',
        contents: [{ locale: 'tr' }],
      });

      await expect(service.publishVersion('kvkk', 'v2')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPublished', () => {
    it('falls back to Turkish when the requested locale has no approved translation', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({
        id: 'v2',
        versionNumber: 2,
        publishedAt: new Date('2026-07-01'),
        contents: [
          { locale: 'tr', title: 'KVKK', bodyMarkdown: '# tr', translationStatus: 'SOURCE' },
          { locale: 'en', title: 'KVKK', bodyMarkdown: '# en draft', translationStatus: 'TRANSLATED' },
        ],
      });

      const result = await service.getPublished('kvkk', 'en');

      expect(result.locale).toBe('tr');
      expect(result.requestedLocale).toBe('en');
    });

    it('serves the approved translation when available', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({
        id: 'v2',
        versionNumber: 2,
        publishedAt: new Date('2026-07-01'),
        contents: [
          { locale: 'tr', title: 'KVKK', bodyMarkdown: '# tr', translationStatus: 'SOURCE' },
          { locale: 'en', title: 'KVKK Notice', bodyMarkdown: '# en', translationStatus: 'APPROVED' },
        ],
      });

      const result = await service.getPublished('kvkk', 'en');

      expect(result.locale).toBe('en');
      expect(result.title).toBe('KVKK Notice');
    });

    it('throws NotFoundException when the document has no published version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue(null);

      await expect(service.getPublished('kvkk')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDocument', () => {
    it('deletes a document that has never been published', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.count.mockResolvedValue(0);
      prisma.legalDocument.delete.mockResolvedValue(document);

      const result = await service.deleteDocument('kvkk');

      expect(prisma.legalDocumentVersion.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId, status: { in: ['PUBLISHED', 'ARCHIVED'] } },
        }),
      );
      expect(prisma.legalDocument.delete).toHaveBeenCalledWith({ where: { id: documentId } });
      expect(result).toEqual({ deleted: true, slug: 'kvkk' });
    });

    it('refuses to delete a document that has a published or archived version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.count.mockResolvedValue(1);

      await expect(service.deleteDocument('kvkk')).rejects.toThrow(BadRequestException);
      expect(prisma.legalDocument.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown document slug', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null);

      await expect(service.deleteDocument('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('per-slug source locale (Slice 6)', () => {
    const enSourceDoc = { id: 'doc-en', slug: 'privacy-gdpr', name: 'GDPR Privacy', sourceLocale: 'en' };

    it('creates the draft source content in the document sourceLocale, not Turkish', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(enSourceDoc);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue(null);
      prisma.legalDocumentVersion.create.mockResolvedValue({ id: 'v1', versionNumber: 1 });

      await service.createDraftVersion('privacy-gdpr', { title: 'Privacy', bodyMarkdown: '# text' }, 'admin-1');

      expect(prisma.legalDocumentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contents: {
              create: expect.objectContaining({ locale: 'en', translationStatus: 'SOURCE' }),
            },
          }),
        }),
      );
    });

    it('getPublished falls back to the en source (and refuses to approve it as a translation)', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(enSourceDoc);
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({
        id: 'v1',
        versionNumber: 1,
        publishedAt: new Date(),
        contents: [
          { locale: 'en', title: 'Privacy', bodyMarkdown: '# en', translationStatus: 'SOURCE' },
          { locale: 'de', title: 'Datenschutz', bodyMarkdown: '# de', translationStatus: 'TRANSLATED' },
        ],
      });

      // de exists but is not APPROVED → falls back to the en SOURCE.
      const result = await service.getPublished('privacy-gdpr', 'de');
      expect(result.locale).toBe('en');
      expect(result.sourceLocale).toBe('en');

      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v1', documentId: 'doc-en', status: 'DRAFT' });
      await expect(service.approveTranslation('privacy-gdpr', 'v1', 'en', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('re-acceptance (Slice 8)', () => {
    it('publish stores the re-acceptance flags; a bare publish stays pre-Slice-8', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({
        id: 'v3',
        documentId,
        status: 'DRAFT',
        contents: [{ locale: 'tr' }],
      });
      prisma.legalDocumentVersion.updateMany.mockResolvedValue({ count: 1 });
      prisma.legalDocumentVersion.update.mockResolvedValue({ id: 'v3', status: 'PUBLISHED' });

      await service.publishVersion('kvkk', 'v3', {
        requiresReacceptance: true,
        effectiveAt: '2026-10-01T00:00:00.000Z',
        changelog: 'Updated data retention section.',
      });
      expect(prisma.legalDocumentVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requiresReacceptance: true,
            effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
            changelog: 'Updated data retention section.',
          }),
        }),
      );

      await service.publishVersion('kvkk', 'v3');
      expect(prisma.legalDocumentVersion.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requiresReacceptance: false,
            effectiveAt: null,
            changelog: null,
          }),
        }),
      );
    });

    describe('getPendingReacceptances', () => {
      const publishedVersion = (over: Record<string, unknown> = {}) => ({
        id: 'v2',
        versionNumber: 2,
        changelog: 'New governing law.',
        effectiveAt: null,
        document: { slug: 'terms-of-service', sourceLocale: 'tr' },
        contents: [{ locale: 'tr', title: 'Hizmet Şartları', bodyMarkdown: '#', translationStatus: 'SOURCE' }],
        ...over,
      });

      it('returns a doc the user has not accepted, filtered to effective flagged versions', async () => {
        prisma.legalDocumentVersion.findMany.mockResolvedValue([publishedVersion()]);
        (prisma.legalDocumentAcceptance as any).findFirst = jest.fn().mockResolvedValue(null);

        const result = await service.getPendingReacceptances('user-1');

        expect(prisma.legalDocumentVersion.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'PUBLISHED',
              requiresReacceptance: true,
              OR: [{ effectiveAt: null }, { effectiveAt: { lte: expect.any(Date) } }],
            }),
          }),
        );
        expect(result.items).toEqual([
          expect.objectContaining({ slug: 'terms-of-service', versionId: 'v2', title: 'Hizmet Şartları' }),
        ]);
      });

      it('skips versions the user already accepted in ANY context (e.g. SIGNUP)', async () => {
        prisma.legalDocumentVersion.findMany.mockResolvedValue([publishedVersion()]);
        (prisma.legalDocumentAcceptance as any).findFirst = jest.fn().mockResolvedValue({ id: 'acc-1' });

        const result = await service.getPendingReacceptances('user-1');

        expect(result.items).toEqual([]);
      });

      it('never surfaces team-level documents (dpa re-arms via Slice 7 status)', async () => {
        prisma.legalDocumentVersion.findMany.mockResolvedValue([
          publishedVersion({ document: { slug: 'dpa', sourceLocale: 'en' } }),
        ]);
        (prisma.legalDocumentAcceptance as any).findFirst = jest.fn().mockResolvedValue(null);

        const result = await service.getPendingReacceptances('user-1');

        expect(result.items).toEqual([]);
        expect((prisma.legalDocumentAcceptance as any).findFirst).not.toHaveBeenCalled();
      });
    });
  });

  describe('consent notices (Slice 6b)', () => {
    const noticeDoc = {
      id: 'notice-1',
      slug: 'privacy-notice-gdpr',
      name: 'Privacy Notice — GDPR',
      sourceLocale: 'en',
    };
    const validBody = [
      '## Intro',
      '',
      'We process your phone number to send a verification code.',
      '',
      '## Controller',
      '',
      'DATALONGA SOLUTIONS LTD is the processor. {teamBusinessName} is the controller.',
      '',
      '## Consent',
      '',
      'I have read and accept the Privacy Notice.',
    ].join('\n');

    describe('publish validation', () => {
      it('refuses a consent-notice version whose source body breaks the section contract', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findUnique.mockResolvedValue({
          id: 'v1',
          documentId: noticeDoc.id,
          status: 'DRAFT',
          contents: [
            { locale: 'en', translationStatus: 'SOURCE', bodyMarkdown: 'Free-form text, no sections.' },
          ],
        });

        await expect(
          service.publishVersion('privacy-notice-gdpr', 'v1'),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.legalDocumentVersion.update).not.toHaveBeenCalled();
      });

      it('refuses when an APPROVED translation breaks the contract, even if the source is fine', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findUnique.mockResolvedValue({
          id: 'v1',
          documentId: noticeDoc.id,
          status: 'DRAFT',
          contents: [
            { locale: 'en', translationStatus: 'SOURCE', bodyMarkdown: validBody },
            { locale: 'de', translationStatus: 'APPROVED', bodyMarkdown: '## Intro\nNur ein Abschnitt.' },
          ],
        });

        await expect(
          service.publishVersion('privacy-notice-gdpr', 'v1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('ignores unapproved translations — they are never served', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findUnique.mockResolvedValue({
          id: 'v1',
          documentId: noticeDoc.id,
          status: 'DRAFT',
          contents: [
            { locale: 'en', translationStatus: 'SOURCE', bodyMarkdown: validBody },
            { locale: 'fr', translationStatus: 'NEEDS_TRANSLATION', bodyMarkdown: 'todo' },
          ],
        });
        prisma.legalDocumentVersion.updateMany.mockResolvedValue({ count: 0 });
        prisma.legalDocumentVersion.update.mockResolvedValue({ id: 'v1', status: 'PUBLISHED' });

        await expect(service.publishVersion('privacy-notice-gdpr', 'v1')).resolves.toBeDefined();
      });

      it('leaves ordinary legal documents unvalidated', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(document);
        prisma.legalDocumentVersion.findUnique.mockResolvedValue({
          id: 'v2',
          documentId,
          status: 'DRAFT',
          contents: [{ locale: 'tr', translationStatus: 'SOURCE', bodyMarkdown: 'Any prose at all.' }],
        });
        prisma.legalDocumentVersion.updateMany.mockResolvedValue({ count: 0 });
        prisma.legalDocumentVersion.update.mockResolvedValue({ id: 'v2', status: 'PUBLISHED' });

        await expect(service.publishVersion('kvkk', 'v2')).resolves.toBeDefined();
      });
    });

    describe('getConsentNotice', () => {
      it('returns the parsed fields and the version number for the audit string', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue({
          id: 'v4',
          versionNumber: 4,
          status: 'PUBLISHED',
          contents: [
            {
              locale: 'en',
              title: 'Privacy Notice and Terms of Use',
              bodyMarkdown: validBody,
              translationStatus: 'SOURCE',
            },
          ],
        });

        const notice = await service.getConsentNotice('gdpr', 'en');

        expect(notice).toMatchObject({
          slug: 'privacy-notice-gdpr',
          versionNumber: 4,
          locale: 'en',
          title: 'Privacy Notice and Terms of Use',
          checkboxLabel: 'I have read and accept the Privacy Notice.',
        });
        expect(notice?.controllerNotice).toContain('{teamBusinessName}');
      });

      it('returns null (not a throw) when the document has never been seeded', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(null);

        await expect(service.getConsentNotice('pdpl', 'en')).resolves.toBeNull();
      });

      it('returns null when the document exists but nothing is published', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue(null);

        await expect(service.getConsentNotice('gdpr', 'en')).resolves.toBeNull();
      });

      it('returns null when the published body no longer satisfies the contract', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue({
          id: 'v5',
          versionNumber: 5,
          status: 'PUBLISHED',
          contents: [
            {
              locale: 'en',
              title: 'Privacy Notice',
              bodyMarkdown: 'Someone rewrote this as plain prose.',
              translationStatus: 'SOURCE',
            },
          ],
        });

        await expect(service.getConsentNotice('gdpr', 'en')).resolves.toBeNull();
      });

      it('falls back to the source locale when the requested translation is not approved', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(noticeDoc);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue({
          id: 'v6',
          versionNumber: 6,
          status: 'PUBLISHED',
          contents: [
            { locale: 'en', title: 'EN', bodyMarkdown: validBody, translationStatus: 'SOURCE' },
            {
              locale: 'de',
              title: 'DE',
              bodyMarkdown: validBody,
              translationStatus: 'NEEDS_TRANSLATION',
            },
          ],
        });

        const notice = await service.getConsentNotice('gdpr', 'de');

        expect(notice?.locale).toBe('en');
      });
    });
  });

  describe('recordAcceptance', () => {
    const userActor = { subjectType: 'user', subjectId: 'user-1', teamId: 'team-1' };

    it('rejects logging acceptance against a draft version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v3', documentId, status: 'DRAFT' });

      await expect(
        service.recordAcceptance(
          'kvkk',
          { versionId: 'v3', locale: 'tr', context: 'PURCHASE' },
          userActor,
          '127.0.0.1',
          'jest',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('logs acceptance with the server-derived actor, never body-supplied identity', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v2', documentId, status: 'PUBLISHED' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-1' });

      // A forged body-level subjectId/teamId no longer reaches the service:
      // the DTO dropped those fields, and this actor param is built from the
      // verified JWT in the controller.
      await service.recordAcceptance(
        'kvkk',
        { versionId: 'v2', locale: 'tr', context: 'PURCHASE' },
        userActor,
        '127.0.0.1',
        'jest',
      );

      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId,
            versionId: 'v2',
            context: 'PURCHASE',
            subjectType: 'user',
            subjectId: 'user-1',
            teamId: 'team-1',
            ipAddress: '127.0.0.1',
          }),
        }),
      );
    });

    it('pins the visitor actor shape for the public route', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v2', documentId, status: 'PUBLISHED' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-2' });

      await service.recordAcceptance(
        'kvkk',
        { versionId: 'v2', locale: 'en', context: 'OTHER' },
        { subjectType: 'visitor', subjectId: null, teamId: null },
        '10.0.0.1',
        'jest',
      );

      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subjectType: 'visitor',
            subjectId: null,
            teamId: null,
            context: 'OTHER',
          }),
        }),
      );
    });
  });

  describe('DPA (Slice 7)', () => {
    beforeEach(() => {
      (prisma as any).teamMember = { findFirst: jest.fn() };
    });

    it('records a DPA acceptance when the acting user is an active TEAM_OWNER', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v2', documentId, status: 'PUBLISHED' });
      (prisma as any).teamMember.findFirst.mockResolvedValue({ id: 'tm-1', role: 'TEAM_OWNER' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-dpa' });

      await service.recordAcceptance(
        'kvkk',
        { versionId: 'v2', locale: 'en', context: 'DPA' },
        { subjectType: 'user', subjectId: 'user-1', teamId: 'team-1' },
        '1.1.1.1',
        'jest',
      );

      expect((prisma as any).teamMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1', userId: 'user-1', role: 'TEAM_OWNER', status: 'active' },
        }),
      );
      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ context: 'DPA', teamId: 'team-1', subjectId: 'user-1' }),
        }),
      );
    });

    it('refuses DPA acceptance from a non-owner member', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v2', documentId, status: 'PUBLISHED' });
      (prisma as any).teamMember.findFirst.mockResolvedValue(null);

      await expect(
        service.recordAcceptance(
          'kvkk',
          { versionId: 'v2', locale: 'en', context: 'DPA' },
          { subjectType: 'user', subjectId: 'user-2', teamId: 'team-1' },
          '1.1.1.1',
          'jest',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.legalDocumentAcceptance.create).not.toHaveBeenCalled();
    });

    it('refuses DPA acceptance without team context (visitor shape)', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v2', documentId, status: 'PUBLISHED' });

      await expect(
        service.recordAcceptance(
          'kvkk',
          { versionId: 'v2', locale: 'en', context: 'DPA' },
          { subjectType: 'visitor', subjectId: null, teamId: null },
          '1.1.1.1',
          'jest',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    describe('getTeamAcceptanceStatus', () => {
      it('reports published=false when the document or a published version is missing (inert surface)', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(null);
        expect(await service.getTeamAcceptanceStatus('dpa', 'team-1')).toEqual({
          slug: 'dpa',
          published: false,
          accepted: false,
          canAccept: false,
        });

        prisma.legalDocument.findUnique.mockResolvedValue(document);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue(null);
        expect((await service.getTeamAcceptanceStatus('dpa', 'team-1')).published).toBe(false);
      });

      it('reports accepted=true only when the team accepted the CURRENT published version', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(document);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue({
          id: 'v2',
          versionNumber: 2,
          publishedAt: new Date(),
        });
        prisma.legalDocumentAcceptance.findMany = prisma.legalDocumentAcceptance.findMany ?? jest.fn();
        (prisma.legalDocumentAcceptance as any).findFirst = jest
          .fn()
          .mockResolvedValueOnce({ id: 'acc-1', acceptedAt: new Date() })
          .mockResolvedValueOnce(null);

        const yes = await service.getTeamAcceptanceStatus('dpa', 'team-1');
        expect(yes).toMatchObject({ published: true, versionId: 'v2', accepted: true });

        const no = await service.getTeamAcceptanceStatus('dpa', 'team-1');
        expect(no).toMatchObject({ published: true, accepted: false });
      });

      it('canAccept comes from the server-side TEAM_OWNER check, mirroring the accept gate', async () => {
        prisma.legalDocument.findUnique.mockResolvedValue(document);
        prisma.legalDocumentVersion.findFirst.mockResolvedValue({ id: 'v2', versionNumber: 2, publishedAt: new Date() });
        (prisma.legalDocumentAcceptance as any).findFirst = jest.fn().mockResolvedValue(null);

        (prisma as any).teamMember.findFirst.mockResolvedValueOnce({ id: 'tm-1', role: 'TEAM_OWNER' });
        const owner = await service.getTeamAcceptanceStatus('dpa', 'team-1', 'user-1');
        expect(owner.canAccept).toBe(true);

        (prisma as any).teamMember.findFirst.mockResolvedValueOnce(null);
        const member = await service.getTeamAcceptanceStatus('dpa', 'team-1', 'user-2');
        expect(member.canAccept).toBe(false);

        // No userId (or no team) → never accepting from this session.
        const anonymous = await service.getTeamAcceptanceStatus('dpa', 'team-1');
        expect(anonymous.canAccept).toBe(false);
      });
    });
  });

  describe('recordSignupAcceptances', () => {
    it('writes a SIGNUP row per slug that has a published version and skips unseeded slugs', async () => {
      // terms-of-service: seeded + published; privacy-policy: no document row.
      prisma.legalDocument.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.slug === 'terms-of-service' ? { id: 'doc-tos', slug: 'terms-of-service' } : null,
        ),
      );
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({ id: 'v-tos', documentId: 'doc-tos' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-3' });

      const result = await service.recordSignupAcceptances('user-1', 'team-1', {
        locale: 'tr-TR,tr;q=0.9',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(result.recordedSlugs).toEqual(['terms-of-service']);
      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledTimes(1);
      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: 'doc-tos',
            versionId: 'v-tos',
            context: 'SIGNUP',
            subjectType: 'user',
            subjectId: 'user-1',
            teamId: 'team-1',
            locale: 'tr',
            ipAddress: '1.2.3.4',
          }),
        }),
      );
    });

    it('skips a slug whose document exists but has no published version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue({ id: 'doc-x' });
      prisma.legalDocumentVersion.findFirst.mockResolvedValue(null);

      const result = await service.recordSignupAcceptances('user-1', null, {});

      expect(result.recordedSlugs).toEqual([]);
      expect(prisma.legalDocumentAcceptance.create).not.toHaveBeenCalled();
    });

    it('never throws — a failing slug is swallowed and the next slug still runs', async () => {
      prisma.legalDocument.findUnique
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce({ id: 'doc-pp', slug: 'privacy-policy' });
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({ id: 'v-pp', documentId: 'doc-pp' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-4' });

      const result = await service.recordSignupAcceptances('user-1', null, {});

      expect(result.recordedSlugs).toEqual(['privacy-policy']);
    });

    it('falls back to en when Accept-Language is unsupported or missing', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue({ id: 'doc-tos' });
      prisma.legalDocumentVersion.findFirst.mockResolvedValue({ id: 'v-tos' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-5' });

      await service.recordSignupAcceptances('user-1', null, { locale: 'ja-JP' });

      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ locale: 'en' }) }),
      );
    });
  });

  describe('listAcceptances', () => {
    beforeEach(() => {
      prisma.legalDocumentAcceptance.count = jest.fn().mockResolvedValue(1);
      prisma.legalDocumentAcceptance.findMany = jest.fn().mockResolvedValue([{ id: 'acc-1' }]);
    });

    it('filters by slug (resolved to documentId) and context, newest first', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);

      const result = await service.listAcceptances({ slug: 'kvkk', context: 'SIGNUP' });

      expect(result).toEqual({ total: 1, take: 50, skip: 0, items: [{ id: 'acc-1' }] });
      expect(prisma.legalDocumentAcceptance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId, context: 'SIGNUP' },
          orderBy: { acceptedAt: 'desc' },
        }),
      );
    });

    it('clamps take to 200 and floors negative skip to 0', async () => {
      await service.listAcceptances({ take: '9999', skip: '-5' });

      expect(prisma.legalDocumentAcceptance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200, skip: 0 }),
      );
    });

    it('throws NotFoundException for an unknown slug filter', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null);

      await expect(service.listAcceptances({ slug: 'nope' })).rejects.toThrow(NotFoundException);
    });
  });
});

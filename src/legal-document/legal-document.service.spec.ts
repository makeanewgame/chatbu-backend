import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    legalDocumentAcceptance: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const documentId = 'doc-1';
  const document = { id: documentId, slug: 'kvkk', name: 'KVKK Aydınlatma Metni' };

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
      legalDocumentAcceptance: { create: jest.fn() },
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
    it('refuses to approve the Turkish source locale', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);

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

  describe('recordAcceptance', () => {
    it('rejects logging acceptance against a draft version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v3', documentId, status: 'DRAFT' });

      await expect(
        service.recordAcceptance(
          'kvkk',
          { versionId: 'v3', locale: 'tr', context: 'PURCHASE', subjectType: 'customer' },
          '127.0.0.1',
          'jest',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('logs acceptance against a published version', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(document);
      prisma.legalDocumentVersion.findUnique.mockResolvedValue({ id: 'v2', documentId, status: 'PUBLISHED' });
      prisma.legalDocumentAcceptance.create.mockResolvedValue({ id: 'acc-1' });

      await service.recordAcceptance(
        'kvkk',
        { versionId: 'v2', locale: 'tr', context: 'PURCHASE', subjectType: 'customer', subjectId: 'cust-1' },
        '127.0.0.1',
        'jest',
      );

      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId,
            versionId: 'v2',
            context: 'PURCHASE',
            subjectId: 'cust-1',
            ipAddress: '127.0.0.1',
          }),
        }),
      );
    });
  });
});

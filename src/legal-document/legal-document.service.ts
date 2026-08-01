import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateLegalDocumentDto,
  CreateLegalDocumentVersionDto,
  RecordLegalAcceptanceDto,
  SOURCE_LOCALE,
  SUPPORTED_LOCALES,
  SupportedLocale,
  UpdateLegalDocumentContentDto,
} from './dto/legal-document.dto';

@Injectable()
export class LegalDocumentService {
  constructor(private prisma: PrismaService) {}

  private normalizeLocale(locale?: string): SupportedLocale {
    if (!locale) return SOURCE_LOCALE;
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_LOCALE', locale });
    }
    return locale as SupportedLocale;
  }

  private async getDocumentOrThrow(slug: string) {
    const document = await this.prisma.legalDocument.findUnique({ where: { slug } });
    if (!document) {
      throw new NotFoundException({ code: 'LEGAL_DOCUMENT_NOT_FOUND', slug });
    }
    return document;
  }

  // ─── Admin: document types ─────────────────────────────────────────────

  async createDocument(dto: CreateLegalDocumentDto) {
    return this.prisma.legalDocument.create({ data: { slug: dto.slug, name: dto.name } });
  }

  async listDocuments() {
    return this.prisma.legalDocument.findMany({
      orderBy: { name: 'asc' },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          include: { contents: { where: { locale: SOURCE_LOCALE } } },
        },
      },
    });
  }

  // A document can only be deleted while it has never been published — once a
  // PUBLISHED (or, by extension, ARCHIVED) version exists, acceptances may
  // reference it and the audit trail must not be destructible. DRAFT versions
  // and their contents cascade-delete with the document (schema.prisma).
  async deleteDocument(slug: string) {
    const document = await this.getDocumentOrThrow(slug);
    const everPublishedCount = await this.prisma.legalDocumentVersion.count({
      where: { documentId: document.id, status: { in: ['PUBLISHED', 'ARCHIVED'] } },
    });
    if (everPublishedCount > 0) {
      throw new BadRequestException({ code: 'DOCUMENT_HAS_PUBLISHED_VERSIONS' });
    }

    await this.prisma.legalDocument.delete({ where: { id: document.id } });
    return { deleted: true, slug };
  }

  // ─── Admin: versions ────────────────────────────────────────────────────

  async listVersions(slug: string) {
    const document = await this.getDocumentOrThrow(slug);
    return this.prisma.legalDocumentVersion.findMany({
      where: { documentId: document.id },
      orderBy: { versionNumber: 'desc' },
      include: { contents: true },
    });
  }

  async createDraftVersion(slug: string, dto: CreateLegalDocumentVersionDto, adminId: string | undefined) {
    const document = await this.getDocumentOrThrow(slug);

    const latest = await this.prisma.legalDocumentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    return this.prisma.legalDocumentVersion.create({
      data: {
        documentId: document.id,
        versionNumber,
        status: 'DRAFT',
        createdByAdminId: adminId ?? null,
        contents: {
          create: {
            locale: SOURCE_LOCALE,
            title: dto.title,
            bodyMarkdown: dto.bodyMarkdown,
            translationStatus: 'SOURCE',
          },
        },
      },
      include: { contents: true },
    });
  }

  // DRAFT and PUBLISHED versions both accept translation edits — translation
  // work routinely lags behind publishing the Turkish source, and the whole
  // point of per-locale approval is to let that happen without blocking on
  // a new version. Only ARCHIVED (superseded) versions are fully locked.
  // The Turkish source itself stays DRAFT-only below (see updateContent).
  private async getEditableVersionOrThrow(slug: string, versionId: string) {
    const document = await this.getDocumentOrThrow(slug);
    const version = await this.prisma.legalDocumentVersion.findUnique({ where: { id: versionId } });
    if (!version || version.documentId !== document.id) {
      throw new NotFoundException({ code: 'LEGAL_DOCUMENT_VERSION_NOT_FOUND' });
    }
    if (version.status === 'ARCHIVED') {
      throw new BadRequestException({ code: 'VERSION_ARCHIVED' });
    }
    return version;
  }

  async updateContent(
    slug: string,
    versionId: string,
    locale: string,
    dto: UpdateLegalDocumentContentDto,
  ) {
    const normalizedLocale = this.normalizeLocale(locale);
    const version = await this.getEditableVersionOrThrow(slug, versionId);
    if (normalizedLocale === SOURCE_LOCALE && version.status !== 'DRAFT') {
      // The published Turkish text is the legally-reviewed source of truth;
      // changing it must go through a new version, not an in-place edit.
      throw new BadRequestException({ code: 'SOURCE_LOCKED_AFTER_PUBLISH' });
    }

    return this.prisma.legalDocumentContent.upsert({
      where: { versionId_locale: { versionId, locale: normalizedLocale } },
      create: {
        versionId,
        locale: normalizedLocale,
        title: dto.title,
        bodyMarkdown: dto.bodyMarkdown,
        translationStatus: normalizedLocale === SOURCE_LOCALE ? 'SOURCE' : 'TRANSLATED',
        translatedAt: normalizedLocale === SOURCE_LOCALE ? null : new Date(),
      },
      update: {
        title: dto.title,
        bodyMarkdown: dto.bodyMarkdown,
        // Re-editing an already-approved translation demotes it back to
        // TRANSLATED so a human has to re-approve the new wording.
        translationStatus: normalizedLocale === SOURCE_LOCALE ? 'SOURCE' : 'TRANSLATED',
        translatedAt: normalizedLocale === SOURCE_LOCALE ? null : new Date(),
        approvedAt: normalizedLocale === SOURCE_LOCALE ? null : undefined,
      },
    });
  }

  async approveTranslation(slug: string, versionId: string, locale: string, adminId: string | undefined) {
    const normalizedLocale = this.normalizeLocale(locale);
    if (normalizedLocale === SOURCE_LOCALE) {
      throw new BadRequestException({ code: 'SOURCE_LOCALE_NOT_TRANSLATABLE' });
    }
    await this.getEditableVersionOrThrow(slug, versionId);

    const content = await this.prisma.legalDocumentContent.findUnique({
      where: { versionId_locale: { versionId, locale: normalizedLocale } },
    });
    if (!content) {
      throw new NotFoundException({ code: 'TRANSLATION_NOT_FOUND' });
    }

    return this.prisma.legalDocumentContent.update({
      where: { id: content.id },
      data: { translationStatus: 'APPROVED', approvedAt: new Date(), approvedByAdminId: adminId ?? null },
    });
  }

  async publishVersion(slug: string, versionId: string) {
    const document = await this.getDocumentOrThrow(slug);
    const version = await this.prisma.legalDocumentVersion.findUnique({
      where: { id: versionId },
      include: { contents: true },
    });
    if (!version || version.documentId !== document.id) {
      throw new NotFoundException({ code: 'LEGAL_DOCUMENT_VERSION_NOT_FOUND' });
    }
    if (version.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VERSION_NOT_DRAFT', status: version.status });
    }
    if (!version.contents.some((c) => c.locale === SOURCE_LOCALE)) {
      throw new BadRequestException({ code: 'SOURCE_CONTENT_REQUIRED' });
    }

    const now = new Date();
    const [, published] = await this.prisma.$transaction([
      this.prisma.legalDocumentVersion.updateMany({
        where: { documentId: document.id, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED', archivedAt: now },
      }),
      this.prisma.legalDocumentVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: now },
        include: { contents: true },
      }),
    ]);

    return published;
  }

  // ─── Public: read ───────────────────────────────────────────────────────

  async getPublished(slug: string, locale?: string) {
    const normalizedLocale = this.normalizeLocale(locale);
    const document = await this.getDocumentOrThrow(slug);
    const version = await this.prisma.legalDocumentVersion.findFirst({
      where: { documentId: document.id, status: 'PUBLISHED' },
      include: { contents: true },
    });
    if (!version) {
      throw new NotFoundException({ code: 'NO_PUBLISHED_VERSION', slug });
    }

    const content = this.resolveContent(version.contents, normalizedLocale);

    return {
      slug: document.slug,
      versionId: version.id,
      versionNumber: version.versionNumber,
      publishedAt: version.publishedAt,
      requestedLocale: normalizedLocale,
      locale: content.locale,
      title: content.title,
      bodyMarkdown: content.bodyMarkdown,
    };
  }

  async getVersionByNumber(slug: string, versionNumber: number, locale?: string) {
    const normalizedLocale = this.normalizeLocale(locale);
    const document = await this.getDocumentOrThrow(slug);
    const version = await this.prisma.legalDocumentVersion.findUnique({
      where: { documentId_versionNumber: { documentId: document.id, versionNumber } },
      include: { contents: true },
    });
    if (!version || version.status === 'DRAFT') {
      throw new NotFoundException({ code: 'LEGAL_DOCUMENT_VERSION_NOT_FOUND' });
    }

    const content = this.resolveContent(version.contents, normalizedLocale);

    return {
      slug: document.slug,
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      requestedLocale: normalizedLocale,
      locale: content.locale,
      title: content.title,
      bodyMarkdown: content.bodyMarkdown,
    };
  }

  // Falls back to the Turkish source when the requested locale has no
  // approved translation yet, rather than mixing in a stale locale from a
  // different version — see LeadPrivacyConsent / LegalDocumentAcceptance
  // split note in schema.prisma for why version identity must stay exact.
  private resolveContent(
    contents: { locale: string; title: string; bodyMarkdown: string; translationStatus: string }[],
    locale: SupportedLocale,
  ) {
    const approved = contents.find((c) => c.locale === locale && c.translationStatus === 'APPROVED');
    if (approved) return approved;

    const source = contents.find((c) => c.locale === SOURCE_LOCALE);
    if (!source) {
      throw new NotFoundException({ code: 'SOURCE_CONTENT_MISSING' });
    }
    return source;
  }

  // ─── Public: acceptance logging (purchase / signup / other) ────────────
  // Append-only audit log. Distinct from LeadPrivacyConsent, which is the
  // mutable OTP-gating session object used by the chatbot lead-capture flow.

  async recordAcceptance(
    slug: string,
    dto: RecordLegalAcceptanceDto,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const document = await this.getDocumentOrThrow(slug);
    const version = await this.prisma.legalDocumentVersion.findUnique({ where: { id: dto.versionId } });
    if (!version || version.documentId !== document.id || version.status === 'DRAFT') {
      throw new BadRequestException({ code: 'INVALID_VERSION_FOR_ACCEPTANCE' });
    }

    return this.prisma.legalDocumentAcceptance.create({
      data: {
        documentId: document.id,
        versionId: version.id,
        locale: dto.locale,
        context: dto.context,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId ?? null,
        teamId: dto.teamId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateLegalDocumentDto,
  CreateLegalDocumentVersionDto,
  ListLegalAcceptancesQueryDto,
  RecordLegalAcceptanceDto,
  SOURCE_LOCALE,
  SUPPORTED_LOCALES,
  SupportedLocale,
  UpdateLegalDocumentContentDto,
} from './dto/legal-document.dto';

// Documents every new account accepts at registration. Rows are written
// best-effort: a slug with no published version is skipped (the CMS may
// not be seeded yet in an environment), never blocks the signup.
// Cutover 2026-09-06 (legal Slice 5) — accounts created before this date
// have only the User.termsAccepted boolean, no backfill (documented in
// docs/legal-contracts-map.md).
export const SIGNUP_ACCEPTANCE_SLUGS = ['terms-of-service', 'privacy-policy'] as const;

// The subject of an acceptance row, derived SERVER-SIDE (JWT for the
// authenticated route, fixed visitor shape for the public route) — never
// from the request body. See Slice 5 note in legal-document.dto.ts.
export interface AcceptanceActor {
  subjectType: string;
  subjectId: string | null;
  teamId: string | null;
}

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
    dto: Pick<RecordLegalAcceptanceDto, 'versionId' | 'locale' | 'context'>,
    actor: AcceptanceActor,
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
        subjectType: actor.subjectType,
        subjectId: actor.subjectId,
        teamId: actor.teamId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  }

  // ─── Signup acceptance (called from AuthenticationService) ─────────────
  // Writes one SIGNUP acceptance row per SIGNUP_ACCEPTANCE_SLUGS entry
  // that has a PUBLISHED version. Throw-free by design: registration must
  // never fail (or even slow down observably) because the legal CMS is
  // unseeded or unreachable — the User.termsAccepted boolean remains the
  // load-bearing gate, this is the audit trail on top.
  async recordSignupAcceptances(
    userId: string,
    teamId: string | null,
    opts: { locale?: string | null; ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ recordedSlugs: string[] }> {
    const locale = this.normalizeAcceptanceLocale(opts.locale);
    const recordedSlugs: string[] = [];

    for (const slug of SIGNUP_ACCEPTANCE_SLUGS) {
      try {
        const document = await this.prisma.legalDocument.findUnique({ where: { slug } });
        if (!document) continue;
        const version = await this.prisma.legalDocumentVersion.findFirst({
          where: { documentId: document.id, status: 'PUBLISHED' },
        });
        if (!version) continue;

        await this.prisma.legalDocumentAcceptance.create({
          data: {
            documentId: document.id,
            versionId: version.id,
            locale,
            context: 'SIGNUP',
            subjectType: 'user',
            subjectId: userId,
            teamId,
            ipAddress: opts.ipAddress ?? null,
            userAgent: opts.userAgent ?? null,
          },
        });
        recordedSlugs.push(slug);
      } catch {
        // Per-slug swallow: one failed row must not stop the next slug,
        // and the caller logs the aggregate outcome.
      }
    }

    return { recordedSlugs };
  }

  // Accept-Language style input ("tr-TR,tr;q=0.9") → supported locale,
  // falling back to 'en' instead of throwing (unlike normalizeLocale,
  // which guards explicit user input on read routes).
  private normalizeAcceptanceLocale(raw?: string | null): SupportedLocale {
    const two = (raw ?? '').trim().toLowerCase().slice(0, 2);
    return (SUPPORTED_LOCALES as readonly string[]).includes(two)
      ? (two as SupportedLocale)
      : 'en';
  }

  // ─── Admin: acceptance audit read ──────────────────────────────────────

  async listAcceptances(query: ListLegalAcceptancesQueryDto) {
    const take = Math.min(Math.max(parseInt(query.take ?? '50', 10) || 50, 1), 200);
    const skip = Math.max(parseInt(query.skip ?? '0', 10) || 0, 0);

    const where: Record<string, unknown> = {};
    if (query.slug) {
      const document = await this.getDocumentOrThrow(query.slug);
      where.documentId = document.id;
    }
    if (query.context) where.context = query.context;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.teamId) where.teamId = query.teamId;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.legalDocumentAcceptance.count({ where }),
      this.prisma.legalDocumentAcceptance.findMany({
        where,
        orderBy: { acceptedAt: 'desc' },
        take,
        skip,
        include: {
          version: {
            select: {
              versionNumber: true,
              document: { select: { slug: true, name: true } },
            },
          },
        },
      }),
    ]);

    return { total, take, skip, items };
  }
}

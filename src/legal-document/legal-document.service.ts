import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

// Slugs whose acceptance binds a TEAM (Slice 7 banner/gate mechanics),
// not individual users — excluded from the Slice 8 user-level
// re-acceptance interstitial even if an admin flags their publish.
export const TEAM_LEVEL_SLUGS = ['dpa'];

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

  // Validates an explicit locale string (URL param / query) BEFORE any
  // DB access — a bad locale is a cheap 400, not a query.
  private assertSupportedLocale(locale: string): SupportedLocale {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_LOCALE', locale });
    }
    return locale as SupportedLocale;
  }

  // Slice 6: the "no locale given" fallback is the DOCUMENT's own source
  // locale (per-slug since 2026-09-06), so the fallback argument is
  // resolved by the caller after the document row is loaded.
  private normalizeLocale(locale: string | undefined, fallback: string): SupportedLocale {
    if (!locale) return fallback as SupportedLocale;
    return this.assertSupportedLocale(locale);
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
    return this.prisma.legalDocument.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        // Per-slug source locale (Slice 6). Omitted → Turkish, matching
        // every document created before the column existed.
        sourceLocale: dto.sourceLocale ?? SOURCE_LOCALE,
      },
    });
  }

  async listDocuments() {
    // Contents can no longer be filtered to the source locale inside the
    // query (source locale is per-row since Slice 6); return the published
    // version's contents for all locales — the admin list only reads
    // titles, and per-locale bodies exist once per published version.
    return this.prisma.legalDocument.findMany({
      orderBy: { name: 'asc' },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          include: { contents: true },
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
    const versions = await this.prisma.legalDocumentVersion.findMany({
      where: { documentId: document.id },
      orderBy: { versionNumber: 'desc' },
      include: { contents: true },
    });
    // Wrapped shape since Slice 6 so the admin detail page knows the
    // document's source locale without a second request. The frontend
    // tolerates both the old bare-array and this wrapped shape.
    return {
      document: { slug: document.slug, name: document.name, sourceLocale: document.sourceLocale },
      versions,
    };
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
            locale: document.sourceLocale,
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
    return { document, version };
  }

  async updateContent(
    slug: string,
    versionId: string,
    locale: string,
    dto: UpdateLegalDocumentContentDto,
  ) {
    const normalizedLocale = this.assertSupportedLocale(locale);
    const { document, version } = await this.getEditableVersionOrThrow(slug, versionId);
    const isSource = normalizedLocale === document.sourceLocale;
    if (isSource && version.status !== 'DRAFT') {
      // The published source text is the legally-reviewed source of truth;
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
        translationStatus: isSource ? 'SOURCE' : 'TRANSLATED',
        translatedAt: isSource ? null : new Date(),
      },
      update: {
        title: dto.title,
        bodyMarkdown: dto.bodyMarkdown,
        // Re-editing an already-approved translation demotes it back to
        // TRANSLATED so a human has to re-approve the new wording.
        translationStatus: isSource ? 'SOURCE' : 'TRANSLATED',
        translatedAt: isSource ? null : new Date(),
        approvedAt: isSource ? null : undefined,
      },
    });
  }

  async approveTranslation(slug: string, versionId: string, locale: string, adminId: string | undefined) {
    const normalizedLocale = this.assertSupportedLocale(locale);
    const { document } = await this.getEditableVersionOrThrow(slug, versionId);
    if (normalizedLocale === document.sourceLocale) {
      throw new BadRequestException({ code: 'SOURCE_LOCALE_NOT_TRANSLATABLE' });
    }

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

  async publishVersion(
    slug: string,
    versionId: string,
    opts?: { requiresReacceptance?: boolean; effectiveAt?: string; changelog?: string },
  ) {
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
    if (!version.contents.some((c) => c.locale === document.sourceLocale)) {
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
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          // Slice 8 publish-time options (default: behave exactly as a
          // pre-Slice-8 publish).
          requiresReacceptance: opts?.requiresReacceptance ?? false,
          effectiveAt: opts?.effectiveAt ? new Date(opts.effectiveAt) : null,
          changelog: opts?.changelog?.trim() || null,
        },
        include: { contents: true },
      }),
    ]);

    return published;
  }

  // ─── Public: read ───────────────────────────────────────────────────────

  async getPublished(slug: string, locale?: string) {
    const document = await this.getDocumentOrThrow(slug);
    const normalizedLocale = this.normalizeLocale(locale, document.sourceLocale);
    const version = await this.prisma.legalDocumentVersion.findFirst({
      where: { documentId: document.id, status: 'PUBLISHED' },
      include: { contents: true },
    });
    if (!version) {
      throw new NotFoundException({ code: 'NO_PUBLISHED_VERSION', slug });
    }

    const content = this.resolveContent(version.contents, normalizedLocale, document.sourceLocale);

    return {
      slug: document.slug,
      sourceLocale: document.sourceLocale,
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
    const document = await this.getDocumentOrThrow(slug);
    const normalizedLocale = this.normalizeLocale(locale, document.sourceLocale);
    const version = await this.prisma.legalDocumentVersion.findUnique({
      where: { documentId_versionNumber: { documentId: document.id, versionNumber } },
      include: { contents: true },
    });
    if (!version || version.status === 'DRAFT') {
      throw new NotFoundException({ code: 'LEGAL_DOCUMENT_VERSION_NOT_FOUND' });
    }

    const content = this.resolveContent(version.contents, normalizedLocale, document.sourceLocale);

    return {
      slug: document.slug,
      sourceLocale: document.sourceLocale,
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      requestedLocale: normalizedLocale,
      locale: content.locale,
      title: content.title,
      bodyMarkdown: content.bodyMarkdown,
    };
  }

  // Falls back to the document's source-locale content when the requested
  // locale has no approved translation yet, rather than mixing in a stale
  // locale from a different version — see LeadPrivacyConsent /
  // LegalDocumentAcceptance split note in schema.prisma for why version
  // identity must stay exact.
  private resolveContent(
    contents: { locale: string; title: string; bodyMarkdown: string; translationStatus: string }[],
    locale: SupportedLocale,
    sourceLocale: string,
  ) {
    const approved = contents.find((c) => c.locale === locale && c.translationStatus === 'APPROVED');
    if (approved) return approved;

    const source = contents.find((c) => c.locale === sourceLocale);
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

    // DPA acceptance binds the whole TEAM, so it takes more than being
    // logged in: the acting user must be an active TEAM_OWNER of the
    // JWT's team (Slice 7).
    if (dto.context === 'DPA') {
      if (!actor.teamId || !actor.subjectId) {
        throw new ForbiddenException({ code: 'DPA_TEAM_CONTEXT_REQUIRED' });
      }
      const owner = await this.prisma.teamMember.findFirst({
        where: {
          teamId: actor.teamId,
          userId: actor.subjectId,
          role: 'TEAM_OWNER',
          status: 'active',
        },
      });
      if (!owner) {
        throw new ForbiddenException({ code: 'DPA_OWNER_REQUIRED' });
      }
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

  // ─── Pending re-acceptances (Slice 8) ──────────────────────────────────
  // Documents whose CURRENT published version was published with
  // requiresReacceptance=true, is effective (effectiveAt passed or unset),
  // and has no acceptance row from THIS user for THAT version — in ANY
  // context, so someone who signed up after the version published (SIGNUP
  // row) or accepted at checkout is never re-prompted. Drives the blocking
  // interstitial; empty array = nothing to do (the overwhelmingly common
  // case, so the query is one indexed findMany over published versions).
  async getPendingReacceptances(userId: string, locale?: string) {
    const now = new Date();
    const versions = await this.prisma.legalDocumentVersion.findMany({
      where: {
        status: 'PUBLISHED',
        requiresReacceptance: true,
        OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }],
      },
      include: { document: true, contents: true },
    });

    const pending = [] as {
      slug: string;
      versionId: string;
      versionNumber: number;
      title: string;
      locale: string;
      changelog: string | null;
      effectiveAt: Date | null;
    }[];

    for (const version of versions) {
      // Team-level documents re-arm through getTeamAcceptanceStatus
      // (Slice 7 banner/gate) — the USER interstitial must not block
      // every member of a team over them.
      if (TEAM_LEVEL_SLUGS.includes(version.document.slug)) continue;

      const accepted = await this.prisma.legalDocumentAcceptance.findFirst({
        where: { versionId: version.id, subjectId: userId },
        select: { id: true },
      });
      if (accepted) continue;

      const content = this.resolveContent(
        version.contents,
        this.normalizeLocale(
          locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale) ? locale : undefined,
          version.document.sourceLocale,
        ),
        version.document.sourceLocale,
      );

      pending.push({
        slug: version.document.slug,
        versionId: version.id,
        versionNumber: version.versionNumber,
        title: content.title,
        locale: content.locale,
        changelog: version.changelog,
        effectiveAt: version.effectiveAt,
      });
    }

    return { items: pending };
  }

  // ─── Team acceptance status (Slice 7) ──────────────────────────────────
  // Answers "has this team accepted the CURRENT published version of this
  // document?". Drives the dashboard DPA banner and the new-bot gate.
  // A document with no published version (or no document at all) reports
  // published=false — every consumer treats that as "nothing to accept",
  // which keeps the whole surface inert until counsel-approved text ships.
  async getTeamAcceptanceStatus(slug: string, teamId: string | null, userId?: string | null) {
    const document = await this.prisma.legalDocument.findUnique({ where: { slug } });
    if (!document) return { slug, published: false as const, accepted: false, canAccept: false };

    const version = await this.prisma.legalDocumentVersion.findFirst({
      where: { documentId: document.id, status: 'PUBLISHED' },
    });
    if (!version) return { slug, published: false as const, accepted: false, canAccept: false };

    const acceptance = teamId
      ? await this.prisma.legalDocumentAcceptance.findFirst({
          where: { versionId: version.id, teamId },
          orderBy: { acceptedAt: 'desc' },
        })
      : null;

    // canAccept mirrors the recordAcceptance DPA owner-gate exactly, so
    // the frontend never has to derive "am I the team owner" from the
    // auth slice's role field — that field conflates platform role
    // (ADMIN) with team role and reports the raw User.role on the
    // email/password login path (found 2026-09-06 during Slice 7 canary).
    const canAccept =
      teamId && userId
        ? Boolean(
            await this.prisma.teamMember.findFirst({
              where: { teamId, userId, role: 'TEAM_OWNER', status: 'active' },
            }),
          )
        : false;

    return {
      slug,
      published: true as const,
      versionId: version.id,
      versionNumber: version.versionNumber,
      publishedAt: version.publishedAt,
      accepted: Boolean(acceptance),
      acceptedAt: acceptance?.acceptedAt ?? null,
      canAccept,
    };
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

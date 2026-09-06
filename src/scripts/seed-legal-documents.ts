/**
 * Legal CMS seeder (Slice 6, 2026-09-06).
 *
 * Seeds `terms-of-service` and `privacy-policy` from the verbatim
 * markdown snapshots in prisma/seed-data/ (extracted from the hardcoded
 * TermsOfService.tsx / PrivacyPolicy.tsx pages — the text that has been
 * live in production). Turkish is the source locale; the English content
 * is seeded as an APPROVED translation because it is today's live
 * production copy.
 *
 * Behaviour (idempotent by design):
 *   - Document missing            → create it (sourceLocale=tr).
 *   - Document has NO versions    → create v1 DRAFT with tr+en contents.
 *   - Document already versioned  → SKIP, unless --new-draft is passed,
 *     which stacks a fresh DRAFT (next version number) with the seed
 *     text — used where an older draft/published text predates this
 *     snapshot (e.g. dev's pre-Slice-6 v1).
 *
 * Publishing is deliberately NOT done here — releasing legal text is a
 * human admin act (admin UI "Yeni Versiyon Olarak Yayınla").
 *
 * Run inside the backend pod (image ships this compiled + the seed-data
 * files):   node dist/scripts/seed-legal-documents.js [--new-draft]
 * Locally:  npx ts-node src/scripts/seed-legal-documents.ts [--new-draft]
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const SEED_DIR = join(process.cwd(), 'prisma', 'seed-data');

interface SeedDoc {
  slug: string;
  name: string;
  sourceLocale: string;
  // First entry MUST be the source locale. An EMPTY array seeds the
  // document row only (a "slot": visible in the admin UI, no draft) —
  // used for documents whose text is counsel-blocked.
  locales: { locale: string; file: string; title: string }[];
}

const SEED_DOCS: SeedDoc[] = [
  {
    slug: 'terms-of-service',
    name: 'Hizmet Şartları',
    sourceLocale: 'tr',
    locales: [
      { locale: 'tr', file: 'terms-of-service.tr.md', title: 'Chatbu Kullanıcı Sözleşmesi ve Hizmet Şartları' },
      { locale: 'en', file: 'terms-of-service.en.md', title: 'Chatbu User Agreement and Terms of Service' },
    ],
  },
  {
    slug: 'privacy-policy',
    name: 'Gizlilik Politikası',
    sourceLocale: 'tr',
    locales: [
      { locale: 'tr', file: 'privacy-policy.tr.md', title: 'Gizlilik Politikası' },
      { locale: 'en', file: 'privacy-policy.en.md', title: 'Privacy Policy' },
    ],
  },
  // ── Slice 7 (2026-09-06) ──
  {
    // Internal template (no lawyer needed to start, per legal-contracts-map
    // §1.4): factual list of live providers. English-first document.
    slug: 'sub-processors',
    name: 'Sub-processors',
    sourceLocale: 'en',
    locales: [{ locale: 'en', file: 'sub-processors.en.md', title: 'Chatbu Sub-processors' }],
  },
  {
    // Slot only — DPA body text is counsel-blocked. The whole DPA surface
    // (dashboard banner, new-bot gate, /dpa page) stays inert until a
    // version is authored and published here.
    slug: 'dpa',
    name: 'Data Processing Agreement',
    sourceLocale: 'en',
    locales: [],
  },
];

async function main() {
  const newDraft = process.argv.includes('--new-draft');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const doc of SEED_DOCS) {
      const document = await prisma.legalDocument.upsert({
        where: { slug: doc.slug },
        create: { slug: doc.slug, name: doc.name, sourceLocale: doc.sourceLocale },
        // Existing documents keep their name; sourceLocale is aligned to
        // the seed's (all pre-Slice-6 documents were tr-source anyway).
        update: { sourceLocale: doc.sourceLocale },
      });

      if (doc.locales.length === 0) {
        console.log(`[seed-legal] ${doc.slug}: document slot ensured (no content to seed — text pending)`);
        continue;
      }

      const versionCount = await prisma.legalDocumentVersion.count({
        where: { documentId: document.id },
      });

      if (versionCount > 0 && !newDraft) {
        console.log(`[seed-legal] ${doc.slug}: ${versionCount} version(s) exist — skipping (use --new-draft to stack a fresh draft)`);
        continue;
      }

      const latest = await prisma.legalDocumentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNumber: 'desc' },
      });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const now = new Date();

      const version = await prisma.legalDocumentVersion.create({
        data: {
          documentId: document.id,
          versionNumber,
          status: 'DRAFT',
          contents: {
            create: doc.locales.map(({ locale, file, title }) => {
              const bodyMarkdown = readFileSync(join(SEED_DIR, file), 'utf8');
              const isSource = locale === doc.sourceLocale;
              return {
                locale,
                title,
                bodyMarkdown,
                translationStatus: isSource ? ('SOURCE' as const) : ('APPROVED' as const),
                translatedAt: isSource ? null : now,
                approvedAt: isSource ? null : now,
              };
            }),
          },
        },
      });

      console.log(`[seed-legal] ${doc.slug}: created DRAFT v${version.versionNumber} (${doc.locales.map((l) => l.locale).join(', ')}) — publish it from the admin UI`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed-legal] FAILED:', err);
  process.exitCode = 1;
});

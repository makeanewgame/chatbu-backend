/**
 * One-shot backfill for PerChatFlowState (P2 Faz 1a-iii, plan file
 * `.claude/plans/this-is-a-example-ticklish-dove.md`). Reads recent
 * lead-flow artifacts and inserts inferred initial LEAD flow states.
 *
 * When to run: ONCE per env, after PRs #124 + #125 merge and
 * chatbu-{main-services,backend}-{,dev} ArgoCD apps have synced +
 * migrations applied. Without it, only chats that experience a NEW
 * transition after deploy get a PerChatFlowState row — active but
 * mid-flow chats stay invisible to the gateway probe until their
 * next event. Backfill closes that gap for chats from the last 7d.
 *
 * Idempotent — safe to re-run. Uses the unique index
 * (botId, chatId, flowKind) via `skipDuplicates: true`.
 *
 * State inference rules (LEAD flow only; email + booking wired in
 * later phases). Ordering matters — pass 1 runs FIRST so terminal
 * states win the unique-index slot; subsequent passes skip via
 * `skipDuplicates`:
 *   Pass 1: BotLeads row with chatId → SUBMITTED (channelsSucceeded > 0)
 *           or FAILED. Terminal — wins over intermediate rows.
 *   Pass 2: LeadPrivacyConsent with otpVerified=true → OTP_VERIFIED.
 *   Pass 3: LeadPrivacyConsent with otpVerified=false → CONSENT_OK.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/backfill-chat-flow-state.ts
 *   npx tsx scripts/backfill-chat-flow-state.ts   # writes
 *   LOOKBACK_DAYS=30 npx tsx scripts/backfill-chat-flow-state.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS ?? '7', 10);

async function main() {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[backfill-chat-flow] dry_run=${DRY_RUN} lookback_days=${LOOKBACK_DAYS} cutoff=${cutoff.toISOString()}`);

  // ─── Pass 1 — terminal SUBMITTED/FAILED from BotLeads ──────────────
  const leads = await prisma.botLeads.findMany({
    where: { chatId: { not: null }, updatedAt: { gte: cutoff } },
    select: {
      id: true,
      botId: true,
      chatId: true,
      channelsSucceeded: true,
      updatedAt: true,
    },
  });
  const terminalRows = leads.map((l) => {
    const succeeded = Array.isArray(l.channelsSucceeded) ? l.channelsSucceeded.length : 0;
    return {
      botId: l.botId,
      chatId: l.chatId as string,
      flowKind: 'LEAD' as const,
      state: succeeded > 0 ? 'SUBMITTED' : 'FAILED',
      enteredAt: l.updatedAt,
      payload: { lead_id: l.id, backfilled: true, backfilled_at: new Date().toISOString() },
    };
  });
  console.log(`[backfill-chat-flow] pass 1 (terminal from BotLeads): ${terminalRows.length} candidate rows`);
  if (!DRY_RUN && terminalRows.length > 0) {
    const res = await prisma.perChatFlowState.createMany({ data: terminalRows, skipDuplicates: true });
    console.log(`[backfill-chat-flow] pass 1: inserted ${res.count} rows`);
  }

  // ─── Pass 2 — OTP_VERIFIED from LeadPrivacyConsent(otpVerified=true) ─
  const verifiedConsents = await prisma.leadPrivacyConsent.findMany({
    where: { otpVerified: true, updatedAt: { gte: cutoff } },
    select: { botId: true, chatId: true, phone: true, otpVerifiedAt: true, updatedAt: true },
  });
  const verifiedRows = verifiedConsents.map((c) => ({
    botId: c.botId,
    chatId: c.chatId,
    flowKind: 'LEAD' as const,
    state: 'OTP_VERIFIED',
    enteredAt: c.otpVerifiedAt ?? c.updatedAt,
    payload: { phone: c.phone, backfilled: true, backfilled_at: new Date().toISOString() },
  }));
  console.log(`[backfill-chat-flow] pass 2 (OTP_VERIFIED from consents): ${verifiedRows.length} candidate rows`);
  if (!DRY_RUN && verifiedRows.length > 0) {
    const res = await prisma.perChatFlowState.createMany({ data: verifiedRows, skipDuplicates: true });
    console.log(`[backfill-chat-flow] pass 2: inserted ${res.count} rows`);
  }

  // ─── Pass 3 — CONSENT_OK from LeadPrivacyConsent(otpVerified=false) ─
  const pendingConsents = await prisma.leadPrivacyConsent.findMany({
    where: { otpVerified: false, updatedAt: { gte: cutoff } },
    select: { id: true, botId: true, chatId: true, updatedAt: true },
  });
  const pendingRows = pendingConsents.map((c) => ({
    botId: c.botId,
    chatId: c.chatId,
    flowKind: 'LEAD' as const,
    state: 'CONSENT_OK',
    enteredAt: c.updatedAt,
    payload: { consent_id: c.id, backfilled: true, backfilled_at: new Date().toISOString() },
  }));
  console.log(`[backfill-chat-flow] pass 3 (CONSENT_OK from consents): ${pendingRows.length} candidate rows`);
  if (!DRY_RUN && pendingRows.length > 0) {
    const res = await prisma.perChatFlowState.createMany({ data: pendingRows, skipDuplicates: true });
    console.log(`[backfill-chat-flow] pass 3: inserted ${res.count} rows`);
  }

  // ─── Summary ────────────────────────────────────────────────────────
  const totals = await prisma.perChatFlowState.groupBy({
    by: ['state'],
    _count: true,
    where: { flowKind: 'LEAD' },
  });
  console.log('[backfill-chat-flow] final LEAD state distribution:');
  for (const t of totals) console.log(`  ${t.state}: ${t._count}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[backfill-chat-flow] FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

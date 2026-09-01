/**
 * One-shot backfill for the team-wide live-chat roster (plan file
 * `.claude/plans/cozy-soaring-bentley.md`).
 *
 * Before this change, live-chat handoffs went to a single agent:
 * `CustomerBots.settings.defaultAgentId` when set, else the team owner.
 * This script preserves that behaviour per team once the round-robin
 * roster lands:
 *
 *   1. Owner's active TeamMember row  -> canLiveChat = true
 *   2. Team.defaultLiveChatAgentId    -> the single value all of the
 *      team's bots' settings.defaultAgentId agree on (if any, non-empty),
 *      otherwise the owner. That agent also gets canLiveChat = true.
 *
 * Run ONCE per env, after the migration `20260901130000_add_live_chat_round_robin`
 * applies.
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/backfill-live-chat-roster.ts
 *   npx tsx scripts/backfill-live-chat-roster.ts   # writes
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

async function main() {
  console.log(`[backfill-live-chat-roster] dry_run=${DRY_RUN}`);

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      ownerId: true,
      defaultLiveChatAgentId: true,
      CustomerBots: { select: { settings: true } },
      members: {
        where: { status: 'active', userId: { not: null } },
        select: { id: true, userId: true, canLiveChat: true },
      },
    },
  });

  let teamsTouched = 0;
  let membersEnabled = 0;
  let defaultsSet = 0;

  for (const team of teams) {
    const activeUserIds = new Set(
      team.members.map((m) => m.userId as string),
    );

    // ── pick the fallback agent ──────────────────────────────────────
    const botDefaults = new Set<string>();
    for (const bot of team.CustomerBots) {
      const id = (bot.settings as { defaultAgentId?: string } | null)
        ?.defaultAgentId;
      if (id) botDefaults.add(id);
    }
    let fallbackId = team.ownerId;
    if (botDefaults.size === 1) {
      const only = [...botDefaults][0];
      if (activeUserIds.has(only)) fallbackId = only;
    }

    // ── the members that must end up canLiveChat = true ──────────────
    const enableIds = new Set<string>([team.ownerId, fallbackId]);
    const membersToEnable = team.members.filter(
      (m) => enableIds.has(m.userId as string) && !m.canLiveChat,
    );
    const needDefault =
      team.defaultLiveChatAgentId == null &&
      fallbackId != null &&
      activeUserIds.has(fallbackId);

    if (membersToEnable.length === 0 && !needDefault) continue;
    teamsTouched++;
    membersEnabled += membersToEnable.length;
    if (needDefault) defaultsSet++;

    console.log(
      `[backfill-live-chat-roster] team ${team.id}: enable=[${membersToEnable
        .map((m) => m.userId)
        .join(',')}]${needDefault ? ` default=${fallbackId}` : ''}`,
    );

    if (DRY_RUN) continue;

    await prisma.$transaction([
      ...membersToEnable.map((m) =>
        prisma.teamMember.update({
          where: { id: m.id },
          data: { canLiveChat: true },
        }),
      ),
      ...(needDefault
        ? [
            prisma.team.update({
              where: { id: team.id },
              data: { defaultLiveChatAgentId: fallbackId },
            }),
          ]
        : []),
    ]);
  }

  console.log(
    `[backfill-live-chat-roster] done: teams_touched=${teamsTouched} members_enabled=${membersEnabled} defaults_set=${defaultsSet}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[backfill-live-chat-roster] FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

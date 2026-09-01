import { PrismaService } from 'src/prisma/prisma.service';

/**
 * A single logical conversation can still land in more than one
 * CustomerChats row:
 *
 *   - Widget: a race between two near-simultaneous turns can fork a
 *     second row under the SAME chatId. (The old rapid-fire-burst
 *     fragmentation is gone — the client now pins a stable chatId on the
 *     first outgoing message, see ChatFormPublic.newConversationId.)
 *   - Meta channels: the gateway rotates the chatId after
 *     META_IDLE_ROTATION_HOURS of silence (Slice 8), so one person's
 *     thread splits into a fresh row every time they come back cold.
 *
 * The chat-detail endpoints are keyed to one row's PK, so without help
 * they show only a fragment. `collectConversationRowIds` gathers the
 * sibling rows that belong to the same session — and nothing more.
 *
 * Rules (deliberately narrow — every separate chat session must stay
 * separate; see the design decision below):
 *
 *   - exact same chatId (same gateway thread)                     → always.
 *     This is the ONLY rule for WIDGET rows.
 *   - channel rows only: same (botId, channel, externalContactId),
 *     time-chained within CHANNEL_SESSION_IDLE_MS (30 min). After 30 min
 *     with no activity a Meta session is considered ended, so the next
 *     inbound message is a new session and gets its own detail view —
 *     matching how the product treats a widget "clear chat".
 *     externalContactId is a real per-person id (PSID / wa_id), so this
 *     never crosses visitors.
 *
 * "Time-chained" = walk the identity-key rows in createdAt order starting
 * from the target and keep only the contiguous run where each row starts
 * within CHANNEL_SESSION_IDLE_MS of the previous row's last activity
 * (updatedAt).
 *
 * ── Design decision, 2026-09-01 ─────────────────────────────────────────
 * Treat every chat session independently. The earlier version also merged
 * WIDGET rows that merely shared a first-seen GeoLocation.ip inside a
 * 30-min window — which interleaved genuinely separate visits (different
 * people behind one office / CGNAT address, or one tester opening a fresh
 * chat in a second browser) into a single detail view. IP is not an
 * identity. That branch is removed: widget sessions are bounded by their
 * client chatId (a "clear chat" mints a new one), and Meta sessions by a
 * 30-min idle gap.
 */

// A Meta session ends after this much silence; a later inbound message
// starts a new session with its own detail view.
export const CHANNEL_SESSION_IDLE_MS = 30 * 60 * 1000;
// Fuzzy (contact) sibling lookup is bounded to this window around the
// target; exact same-chatId siblings are matched with no time bound.
const FUZZY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface ConversationTargetRow {
  id: string;
  teamId: string;
  botId: string;
  chatId: string;
  channel: string;
  externalContactId: string | null;
  createdAt: Date;
}

export async function collectConversationRowIds(
  prisma: PrismaService,
  target: ConversationTargetRow,
): Promise<string[]> {
  // 1. Same gateway thread — precise, no time bound.
  const sameChatId = await prisma.customerChats.findMany({
    where: {
      teamId: target.teamId,
      botId: target.botId,
      chatId: target.chatId,
      isDeleted: false,
    },
    select: { id: true },
  });
  const rowIds = new Set<string>([target.id, ...sameChatId.map((r) => r.id)]);

  // WIDGET conversations are reunited on exact chatId only. The client pins
  // a stable chatId from turn 1 and mints a new one on "clear chat", so
  // anything sharing it is the same session and anything that doesn't is a
  // different one. No fuzzy merge — see the design decision above.
  if (target.channel === 'WIDGET') {
    return [...rowIds];
  }

  // 2. Meta channel: reunite chatId rotations that belong to the same
  //    still-live session (same person, <30 min idle between rows).
  const candidates = await prisma.customerChats.findMany({
    where: {
      teamId: target.teamId,
      botId: target.botId,
      channel: target.channel as any,
      isDeleted: false,
      createdAt: {
        gte: new Date(target.createdAt.getTime() - FUZZY_WINDOW_MS),
        lte: new Date(target.createdAt.getTime() + FUZZY_WINDOW_MS),
      },
    },
    select: {
      id: true,
      externalContactId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const keyed = candidates.filter(
    (c) =>
      !!target.externalContactId &&
      c.externalContactId === target.externalContactId,
  );

  const sorted = [...keyed].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const targetIdx = sorted.findIndex((c) => c.id === target.id);
  if (targetIdx !== -1) {
    for (let i = targetIdx + 1; i < sorted.length; i++) {
      if (
        sorted[i].createdAt.getTime() - sorted[i - 1].updatedAt.getTime() >
        CHANNEL_SESSION_IDLE_MS
      ) {
        break;
      }
      rowIds.add(sorted[i].id);
    }
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (
        sorted[i + 1].createdAt.getTime() - sorted[i].updatedAt.getTime() >
        CHANNEL_SESSION_IDLE_MS
      ) {
        break;
      }
      rowIds.add(sorted[i].id);
    }
  }

  return [...rowIds];
}

import { PrismaService } from 'src/prisma/prisma.service';

/**
 * One visitor conversation can be scattered across several CustomerChats
 * rows:
 *
 *   - Pre-fix widget bursts: rapid-fire quick-reply taps each left with
 *     chatId=null before the first response's session_id reached the
 *     client, so the gateway minted a fresh session per turn and every
 *     turn opened its own row (prod, 2026-08-26 — 9 rows in 73 minutes
 *     for one visitor).
 *   - A race between two near-simultaneous turns can still fork a second
 *     row under the same chatId.
 *
 * The chat-detail endpoints are keyed to a single row's PK, so they used
 * to show only a fragment. `collectConversationRowIds` gathers the
 * sibling rows that belong to the same logical conversation — conservatively,
 * so unrelated visits never get stitched together:
 *
 *   - exact same chatId (same gateway thread)                    → always
 *   - channel rows: same (botId, channel, externalContactId),
 *     time-chained within CHANNEL_GAP_MS (mirrors the 6h Meta idle
 *     rotation window — anything past that is a deliberate new thread)
 *   - widget rows: same botId + same first-seen GeoLocation.ip,
 *     time-chained within WIDGET_GAP_MS (30 min — keeps unrelated
 *     visits behind one CGNAT IP apart)
 *
 * "Time-chained" = walk the identity-key rows in createdAt order starting
 * from the target and keep only the contiguous run where each row starts
 * within the gap of the previous row's last activity (updatedAt).
 */

export const WIDGET_GAP_MS = 30 * 60 * 1000;
export const CHANNEL_GAP_MS = 6 * 60 * 60 * 1000;
// Fuzzy (ip / contact) sibling lookup is bounded to this window around the
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
  const isWidget = target.channel === 'WIDGET';
  const gap = isWidget ? WIDGET_GAP_MS : CHANNEL_GAP_MS;

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

  // 2. Fuzzy identity-key siblings within a bounded window.
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
      GeoLocation: {
        select: { ip: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const targetCandidate = candidates.find((c) => c.id === target.id);
  const targetIp = targetCandidate?.GeoLocation[0]?.ip ?? null;

  const keyed = candidates.filter((c) => {
    if (isWidget) {
      return !!targetIp && (c.GeoLocation[0]?.ip ?? null) === targetIp;
    }
    return (
      !!target.externalContactId &&
      c.externalContactId === target.externalContactId
    );
  });

  const sorted = [...keyed].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const targetIdx = sorted.findIndex((c) => c.id === target.id);
  if (targetIdx !== -1) {
    for (let i = targetIdx + 1; i < sorted.length; i++) {
      if (
        sorted[i].createdAt.getTime() - sorted[i - 1].updatedAt.getTime() >
        gap
      ) {
        break;
      }
      rowIds.add(sorted[i].id);
    }
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (
        sorted[i + 1].createdAt.getTime() - sorted[i].updatedAt.getTime() >
        gap
      ) {
        break;
      }
      rowIds.add(sorted[i].id);
    }
  }

  return [...rowIds];
}

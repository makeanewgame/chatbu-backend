import { ChatStatus } from '../../generated/prisma/client';
import { formatAgentPublicName } from 'src/util/agent-name.util';

// A conversation is "live" (must sort to the very top of the unified inbox and
// is the only state where an unread counter is meaningful) whenever a human is
// in the loop — requested, assigned, or actively replying.
export const LIVE_STATUSES: ChatStatus[] = [
  'HUMAN_REQUESTED',
  'HUMAN_ASSIGNED',
  'HUMAN_ACTIVE',
];

export function isLiveStatus(status: ChatStatus | string | null | undefined): boolean {
  return !!status && LIVE_STATUSES.includes(status as ChatStatus);
}

export type ConversationCardSender = 'user' | 'bot' | 'agent';

// Denormalized conversation row the agent panels render as a list card. Kept
// deliberately small — it rides along on every `conversation:message` /
// `conversation:updated` socket payload and patches the RTK-Query cache without
// a refetch.
export interface ConversationCard {
  id: string; // CustomerChats.id
  chatId: string; // gateway session id
  teamId: string;
  botId: string;
  channel: string;
  chatStatus: ChatStatus;
  isLive: boolean;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSender: ConversationCardSender | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  contactName: string | null;
  contactId: string | null;
}

// Shape of the row `select` that buildConversationCard consumes. Any query that
// wants to produce a card should select at least these fields.
export interface ChatRowForCard {
  id: string;
  chatId: string;
  teamId: string;
  botId: string;
  channel: string;
  chatStatus: ChatStatus;
  agentUserId: string | null;
  agentUnreadCount: number;
  externalContactName: string | null;
  externalContactId: string | null;
  agent?: { name: string | null } | null;
  CustomerChatDetails?: Array<{
    sender: string;
    message: string;
    createdAt: Date;
  }>;
}

const SELF_CLOSED = new Set<ChatStatus>(['CLOSED']);

export function buildConversationCard(row: ChatRowForCard): ConversationCard {
  const last = row.CustomerChatDetails?.[0] ?? null;
  const live = isLiveStatus(row.chatStatus);
  return {
    id: row.id,
    chatId: row.chatId,
    teamId: row.teamId,
    botId: row.botId,
    channel: row.channel,
    chatStatus: row.chatStatus,
    isLive: live,
    // Bot/closed chats never carry unread even if a stale counter lingers.
    unreadCount: live ? row.agentUnreadCount ?? 0 : 0,
    lastMessage: last?.message ?? null,
    lastMessageAt: last ? last.createdAt.toISOString() : null,
    lastMessageSender: (last?.sender as ConversationCardSender) ?? null,
    assignedAgentId: row.agentUserId ?? null,
    assignedAgentName: row.agent?.name ? formatAgentPublicName(row.agent.name) : null,
    contactName: row.externalContactName ?? null,
    contactId: row.externalContactId ?? null,
  };
}

// Three-tier ordering shared by the list endpoint and the client-side re-sort
// after a socket patch: live first, then everything not self-closed, then by
// most-recent activity.
export function compareConversationCards(a: ConversationCard, b: ConversationCard): number {
  if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
  const aClosed = SELF_CLOSED.has(a.chatStatus);
  const bClosed = SELF_CLOSED.has(b.chatStatus);
  if (aClosed !== bClosed) return aClosed ? 1 : -1;
  const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
  const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
  return bt - at;
}

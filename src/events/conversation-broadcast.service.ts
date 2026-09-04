import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioClientService } from 'src/minio-client/minio-client.service';
import { EventsGateway } from './events.gateway';
import {
  buildConversationCard,
  ConversationCard,
  ConversationCardSender,
  isLiveStatus,
} from './conversation-card.util';

export interface BroadcastMessage {
  id?: string;
  sender: ConversationCardSender;
  text: string;
  attachments?: unknown;
  createdAt: Date | string;
  agentName?: string | null;
}

interface BroadcastOptions {
  // The message(s) just persisted, newest last. When omitted the service falls
  // back to emitting a single event for the conversation's latest detail row.
  messages?: BroadcastMessage[];
  // When set, also fire `conversation:updated` with this reason (status change,
  // handoff, close, reopen, assignment) — independent of any message events.
  reason?:
    | 'handoff_requested'
    | 'assigned'
    | 'closed'
    | 'reopened'
    | 'status';
}

// The single fan-out point for the unified "Sohbetler" inbox. Every channel's
// message-persist site calls `broadcast(dbChatId, …)` right after it writes, so
// bot-handled conversations light up the agent panels in real time the same way
// human ones do. One lightweight query per call; no-ops safely if the chat row
// has vanished (deleted mid-flight).
@Injectable()
export class ConversationBroadcastService {
  private readonly logger = new Logger(ConversationBroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
    private readonly minioClientService: MinioClientService,
    private readonly configService: ConfigService,
  ) {}

  // Socket-delivered messages carry the attachments exactly as the sender
  // persisted them (storageId/objectPath/fileName/fileType/size) — no
  // presignedUrl. Without one the panels can't render an image thumbnail
  // and fall back to a plain file-link chip. Sign each attachment's URL the
  // same way `ReportService.getChatHistoryDetail` does for the REST payload,
  // so a live-pushed message looks identical to a reloaded one.
  private async enrichAttachments(attachments: unknown): Promise<unknown> {
    if (!Array.isArray(attachments) || attachments.length === 0)
      return attachments;

    const bucket = this.configService.get('S3_BUCKET_NAME');

    return Promise.all(
      attachments.map(async (att: any) => {
        if (!att?.objectPath || att.presignedUrl) return att;
        try {
          const presignedUrl = await this.minioClientService.getPresignedUrl(
            att.objectPath,
            bucket,
          );
          return { ...att, presignedUrl };
        } catch (err) {
          this.logger.warn(
            `attachment presign failed for ${att.objectPath}: ${err?.message ?? err}`,
          );
          return att;
        }
      }),
    );
  }

  private cardSelect() {
    return {
      id: true,
      chatId: true,
      teamId: true,
      botId: true,
      channel: true,
      chatStatus: true,
      agentUserId: true,
      agentUnreadCount: true,
      externalContactName: true,
      externalContactId: true,
      agent: { select: { name: true } },
      CustomerChatDetails: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { sender: true, message: true, createdAt: true },
      },
    };
  }

  async loadCard(dbChatId: string): Promise<ConversationCard | null> {
    const row = await this.prisma.customerChats.findUnique({
      where: { id: dbChatId },
      select: this.cardSelect(),
    });
    if (!row) return null;
    return buildConversationCard(row as any);
  }

  async broadcast(dbChatId: string, opts: BroadcastOptions = {}): Promise<void> {
    try {
      const card = await this.loadCard(dbChatId);
      if (!card) return;

      const base = {
        chatId: card.chatId,
        dbChatId: card.id,
        teamId: card.teamId,
        botId: card.botId,
        channel: card.channel,
      };

      const messages =
        opts.messages && opts.messages.length
          ? opts.messages
          : card.lastMessage !== null
            ? [
                {
                  sender: card.lastMessageSender ?? 'bot',
                  text: card.lastMessage,
                  createdAt: card.lastMessageAt ?? new Date().toISOString(),
                } as BroadcastMessage,
              ]
            : [];

      for (const m of messages) {
        this.gateway.emitConversationMessage(card.teamId, {
          ...base,
          message: {
            id: m.id ?? null,
            sender: m.sender,
            text: m.text,
            attachments: m.attachments
              ? await this.enrichAttachments(m.attachments)
              : null,
            createdAt:
              m.createdAt instanceof Date
                ? m.createdAt.toISOString()
                : m.createdAt,
            agentName: m.agentName ?? null,
          },
          conversation: card,
        });
      }

      if (opts.reason) {
        this.gateway.emitConversationUpdated(card.teamId, {
          ...base,
          reason: opts.reason,
          conversation: card,
        });
      }

      // Legacy per-agent event kept alive for the current web/mobile panels and
      // for any visitor->agent message while a human owns the chat.
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.sender === 'user');
      if (lastUserMsg && card.assignedAgentId && isLiveStatus(card.chatStatus)) {
        this.gateway.notifyAgent(card.assignedAgentId, {
          chatId: card.id,
          sender: 'user',
          message: lastUserMsg.text,
          createdAt:
            lastUserMsg.createdAt instanceof Date
              ? lastUserMsg.createdAt.toISOString()
              : lastUserMsg.createdAt,
        });
      }
    } catch (err) {
      // A broadcast failure must never take down the message-persist path.
      this.logger.warn(
        `conversation broadcast failed for chat=${dbChatId}: ${err?.message ?? err}`,
      );
    }
  }

  // Reset + fan out a read receipt so the agent's other devices clear the badge.
  async markRead(dbChatId: string, userId: string): Promise<void> {
    try {
      const row = await this.prisma.customerChats.update({
        where: { id: dbChatId },
        data: { agentUnreadCount: 0, agentLastReadAt: new Date() },
        select: { id: true, chatId: true, teamId: true },
      });
      this.gateway.emitConversationRead(row.teamId, {
        chatId: row.chatId,
        dbChatId: row.id,
        teamId: row.teamId,
        unreadCount: 0,
        readByUserId: userId,
      });
    } catch (err) {
      this.logger.warn(
        `markRead failed for chat=${dbChatId}: ${err?.message ?? err}`,
      );
    }
  }
}

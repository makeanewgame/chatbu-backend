import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FlowKind, Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FlowStateFor } from './flow-states';

export { LeadState, BookingState, HandoffState, FeedbackState, FlowStateFor } from './flow-states';

/**
 * Authoritative store for per-chat, per-flow orchestration state.
 *
 * Foundation for the P2 state-machine refactor (plan file
 * `.claude/plans/this-is-a-example-ticklish-dove.md`, Phase 1). See
 * the schema comment on `PerChatFlowState` in prisma/schema.prisma
 * for the "why".
 *
 * State transitions:
 *   - `transition(botId, chatId, flowKind, {from, to, payload?})`
 *   - Optimistic-locked when `from` is provided: rejects if the
 *     current state differs, so a caller can't blindly advance a
 *     state that has been moved out from under it (double-verify
 *     race, retry after backend restart, etc.).
 *   - When `from === null` the caller is asserting "start this flow
 *     if it doesn't exist" — used at the first transition site for
 *     each flow (e.g. `recordPrivacyConsent` starts LEAD flow at
 *     CONSENT_OK regardless of prior state).
 *
 * Reads:
 *   - `list(botId, chatId)` returns every active flow row for the
 *     chat, in `enteredAt DESC` order. The gateway probe endpoint
 *     serializes this straight to the wire.
 *
 * The service is intentionally schema-lite: `state` is a string, not
 * a per-flow enum. Per-flow state names are enforced by the callers
 * (LeadService, BookingService) and captured in the plan's Phase-2/3
 * mini-block tables. Adding a new state = new string + new
 * mini-block; no migration.
 */

// Payload the gateway probe returns per flow. Kept intentionally
// small — no `id`, no `updatedAt` — so the gateway doesn't grow a
// dependency on backend-internal fields.
export interface FlowStateReadDto {
  flowKind: FlowKind;
  state: string;
  enteredAt: Date;
  payload: Prisma.JsonValue | null;
}

/**
 * Args for a single state transition. Generic over the FlowKind so
 * callers get compile-time narrowing: `TransitionArgs<'LEAD'>` accepts
 * only `LeadState` values, `TransitionArgs<'BOOKING'>` only
 * `BookingState`, etc. Prevents typos and accidental cross-flow state
 * mix-ups at the call site.
 *
 * Defaults to `FlowKind` (widened) for the loose call site — this is
 * only really used by generic passthrough code that doesn't know the
 * concrete FlowKind at authoring time.
 */
export interface TransitionArgs<F extends FlowKind = FlowKind> {
  from?: FlowStateFor<F> | null;
  to: FlowStateFor<F>;
  payload?: Prisma.InputJsonValue | null;
}

@Injectable()
export class ChatFlowService {
  private readonly logger = new Logger(ChatFlowService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Move a flow to a new state. Idempotent when `from === to` (no
   * row change but tolerated so double-fires are safe).
   *
   * When `from` is provided and the current state differs, throws
   * `BadRequestException({code: 'INVALID_TRANSITION'})` — the caller
   * should log + swallow. Do NOT surface this to end users; a
   * mismatched transition means the flow was advanced by another
   * path (widget POST, concurrent turn) and the caller's view is
   * stale.
   *
   * When `from` is `null` or `undefined`, the row is upserted
   * regardless of prior state — used at flow-entry sites where the
   * caller doesn't know or care about the previous state.
   */
  async transition<F extends FlowKind>(
    botId: string,
    chatId: string,
    flowKind: F,
    args: TransitionArgs<F>,
  ): Promise<void> {
    if (!botId || !chatId) {
      throw new BadRequestException('botId and chatId are required');
    }
    if (!args.to) {
      throw new BadRequestException('transition target state is required');
    }

    const existing = await this.prisma.perChatFlowState.findUnique({
      where: {
        botId_chatId_flowKind: { botId, chatId, flowKind },
      },
    });

    // Optimistic lock: reject stale transitions
    if (args.from !== undefined && args.from !== null) {
      if (!existing) {
        // Caller expected a specific prior state but the row doesn't
        // exist at all — treat as invalid to avoid silently creating
        // a row that skips intermediate states
        throw new BadRequestException({
          code: 'INVALID_TRANSITION',
          reason: 'no_existing_row',
          expected_from: args.from,
        });
      }
      if (existing.state !== args.from) {
        throw new BadRequestException({
          code: 'INVALID_TRANSITION',
          reason: 'state_mismatch',
          expected_from: args.from,
          actual: existing.state,
        });
      }
    }

    // Idempotent no-op when the state hasn't changed and no payload
    // update was requested. Preserves `enteredAt`.
    if (existing && existing.state === args.to && args.payload === undefined) {
      return;
    }

    const now = new Date();
    await this.prisma.perChatFlowState.upsert({
      where: {
        botId_chatId_flowKind: { botId, chatId, flowKind },
      },
      create: {
        botId,
        chatId,
        flowKind,
        state: args.to,
        enteredAt: now,
        payload: args.payload ?? Prisma.DbNull,
      },
      update: {
        state: args.to,
        // Only bump enteredAt when the state actually changes;
        // re-writing the same state (with a payload update) shouldn't
        // reset the entry clock.
        ...(existing && existing.state !== args.to
          ? { enteredAt: now }
          : {}),
        ...(args.payload !== undefined
          ? { payload: args.payload ?? Prisma.DbNull }
          : {}),
      },
    });

    this.logger.log(
      `[chat-flow] ${botId}/${chatId} ${flowKind}: ${existing?.state ?? '∅'} → ${args.to}`,
    );
  }

  /**
   * Fire-and-log wrapper around `transition` for use at dual-write
   * sites (LeadService, BookingService, AppointmentService). Never
   * throws — a state-store failure MUST NOT break the underlying
   * feature flow (SMS send, appointment insert, …). Silently returns
   * when `chatId` is falsy so entry sites that can be called without
   * a chat context (email OTP without chat, MCP tool without chat
   * forwarding yet) don't error out on the guard.
   *
   * `source` is stamped into the log line to keep transition traces
   * greppable across the multiple services that call this helper.
   */
  async safeTransition<F extends FlowKind>(
    botId: string,
    chatId: string | null | undefined,
    flowKind: F,
    args: TransitionArgs<F>,
    source?: string,
  ): Promise<void> {
    if (!chatId) return;
    try {
      await this.transition(botId, chatId, flowKind, args);
    } catch (err) {
      const label = source ? ` source=${source}` : '';
      this.logger.warn(
        `[chat-flow] safeTransition swallow bot=${botId} chat=${chatId} kind=${flowKind} to=${args.to}${label}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Return every active flow row for a chat, freshest first. Called
   * by the gateway probe endpoint on every turn — must stay fast
   * (O(1) via the (botId, chatId, flowKind) unique index) since it
   * sits on the /chat hot path.
   */
  async list(botId: string, chatId: string): Promise<FlowStateReadDto[]> {
    if (!botId || !chatId) return [];
    const rows = await this.prisma.perChatFlowState.findMany({
      where: { botId, chatId },
      orderBy: { enteredAt: 'desc' },
      select: {
        flowKind: true,
        state: true,
        enteredAt: true,
        payload: true,
      },
    });
    return rows;
  }
}

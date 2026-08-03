/**
 * Per-FlowKind state literal-union types for compile-time safety at every
 * ChatFlowService transition call site.
 *
 * ## Why
 *
 * `PerChatFlowState.state` is a `String` column in Prisma (see the schema
 * comment for why we keep it schema-lite — new states shouldn't cost a
 * migration + deploy). But at the TS layer we DO want typos to fail
 * compilation and cross-flow mix-ups (e.g. writing `HANDOFF` state on a
 * LEAD transition) to be rejected before they hit prod.
 *
 * ## How
 *
 * Each `FlowKind` gets its own literal-union type listing every state the
 * backend services currently write. `ChatFlowService.transition` /
 * `safeTransition` are generic over `F extends FlowKind`, and their
 * `args.from` / `args.to` are typed as `FlowStateFor<F>` — so passing
 * `FlowKind.LEAD` narrows the acceptable state values automatically.
 *
 * ## Adding a new state
 *
 * 1. Append the string to the appropriate union below.
 * 2. Write the transition (compiler now accepts it).
 * 3. (Optional) Gateway `flow_prompt_builder.py` adds a matching
 *    mini-block entry — unknown states return `""` gracefully, so this
 *    step can be deferred without breaking anything.
 *
 * ## Adding a new FlowKind
 *
 * 1. Add the enum value in `prisma/schema.prisma` (Prisma migration).
 * 2. Add a `<Kind>State` union type below.
 * 3. Add the mapping entry in `FlowStateFor`.
 * 4. Wire the first transition call site.
 */

import { FlowKind } from '../../generated/prisma/client';

// ─── LEAD (LeadService: consent recording, SMS/email verify, submit) ──
// Written by: LeadService.recordPrivacyConsent, .requestSmsVerification,
// .verifySmsCode, .submit, .requestVerification, .verifyCode
export type LeadState =
  | 'CONSENT_OK'    // KVKK consent recorded, phone attached to the row
  | 'OTP_SENT'      // SMS OTP dispatched, awaiting user code
  | 'OTP_VERIFIED'  // OTP successfully checked, ready to submit lead
  | 'SUBMITTED'     // Lead forwarded to bot owner's destinations
  | 'FAILED';       // Submit failed (destination misconfig, delivery error)

// ─── BOOKING (BookingService + AppointmentService: calendar flow) ─────
// Written by: BookingService.requestSmsVerification, .verifySms,
// AppointmentService.createFromMcp
export type BookingState =
  | 'OTP_SENT'      // Booking SMS OTP dispatched
  | 'OTP_VERIFIED'  // Booking OTP checked, ready to create appointment
  | 'BOOKED';       // Google Calendar event created

// ─── HANDOFF (BotService: auto-handover to defaultAgent) ──────────────
// Written by: BotService.chat handover path (P2 Faz 4 PR #131)
export type HandoffState =
  | 'REQUESTED'     // Model signalled human_handover=true
  | 'ASSIGNED';     // CustomerChats.chatStatus flipped to HUMAN_ACTIVE

// ─── FEEDBACK (WidgetService: closing feedback submit) ────────────────
// Written by: WidgetService.recordFeedback (P2 Faz 4 PR #132)
export type FeedbackState =
  | 'SUBMITTED';    // Visitor submitted rating/answer via /widget/feedback

// ─── Mapping: FlowKind → its states ───────────────────────────────────
// Generic used by `ChatFlowService.transition<F>` so callers only see
// the states valid for the FlowKind they passed. `never` fallback
// intentionally forces adding a mapping when a new FlowKind lands.
export type FlowStateFor<F extends FlowKind> =
  F extends typeof FlowKind.LEAD ? LeadState :
  F extends typeof FlowKind.BOOKING ? BookingState :
  F extends typeof FlowKind.HANDOFF ? HandoffState :
  F extends typeof FlowKind.FEEDBACK ? FeedbackState :
  never;

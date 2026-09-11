/**
 * Which surface a conversation is happening on, derived from the chatId
 * the channel adapter minted.
 *
 * The prefix convention is the platform's own: the Meta webhooks mint
 * `ig_…` / `fb_…` / `wa_…` chat ids and the widget mints `sid…`. It has
 * been load-bearing since BotService started stamping
 * `CustomerChats.channel` from it (that call site now delegates here).
 * This module lifts the rule out so the lead consent/verification gates
 * can ask the same question instead of trusting the model-supplied
 * `source_channel` tool argument.
 *
 * Why this exists (2026-09-10): `capture_lead.source_channel` is filled
 * in by the agent, so it is prompt compliance, not a fact — and it gates
 * whether the off-widget privacy consent gets recorded at all. When it is
 * missing, `requestSmsVerification` answers KVKK_CONSENT_REQUIRED, whose
 * sentinel tells the agent to call `prompt_kvkk_consent` and then
 * `request_lead_sms_verification` — two tools the gateway's Meta filter
 * has already stripped on exactly those channels. The agent is then
 * holding an instruction it cannot execute, and what it does next is
 * anyone's guess; on prod (GÜNSA Instagram DM, 2026-09-05, one gate
 * earlier in the same chain) it improvised a "your details were saved"
 * reply with no lead row behind it.
 *
 * A legal gate must not hang off an argument a model can forget.
 * See [[feedback_deterministic_over_prompt_rules]].
 *
 * Why not read `CustomerChats.channel` instead: that row is written on
 * the first bot reply, so a visitor who hands over their phone in their
 * very first message can reach the lead gates before it exists. The
 * chatId is present from the first byte and needs no query.
 */
export type ChatChannelKind = 'WIDGET' | 'WHATSAPP' | 'META_MESSENGER' | 'INSTAGRAM';

export function inferChatChannel(chatId?: string | null): ChatChannelKind {
  const id = (chatId || '').trim();
  if (id.startsWith('wa_')) return 'WHATSAPP';
  if (id.startsWith('fb_')) return 'META_MESSENGER';
  if (id.startsWith('ig_')) return 'INSTAGRAM';
  return 'WIDGET';
}

/**
 * True when the conversation has no widget UI attached — no consent
 * card, no contact form, no OTP input card can be rendered, and the
 * gateway's Meta tool filter has removed the tools that drive them.
 */
export function isOffWidgetChat(chatId?: string | null): boolean {
  return inferChatChannel(chatId) !== 'WIDGET';
}

const CONSENT_SOURCE_BY_CHANNEL: Record<ChatChannelKind, string> = {
  WIDGET: 'chatbot',
  WHATSAPP: 'chatbot_whatsapp',
  META_MESSENGER: 'chatbot_messenger',
  INSTAGRAM: 'chatbot_instagram',
};

/**
 * Audit-trail label for a LeadPrivacyConsent row. Off-widget rows carry
 * the channel so they are distinguishable from a visitor who actually
 * tapped the widget's consent card: off-widget consent is a text-based
 * confirmation the agent was instructed to obtain, which is a weaker
 * record and must not be silently mixed in with card taps.
 */
export function consentSourceForChat(chatId?: string | null): string {
  return CONSENT_SOURCE_BY_CHANNEL[inferChatChannel(chatId)];
}

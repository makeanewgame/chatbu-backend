/**
 * Shared reply resolver for the three Meta-adjacent channel services
 * (`meta.service.ts` for Instagram DM / Messenger, `meta-whatsapp.service.ts`
 * for embedded WhatsApp, `whatsapp.service.ts` for legacy WhatsApp).
 *
 * The chat pipeline returns three shapes we care about here:
 *
 * 1. Normal bot reply:      `{ content: "…", … }`
 * 2. HUMAN_ACTIVE bypass:   `{ agent_active: true, session_id: … }` — chat
 *    was handed off; `bot.service.ts:550` short-circuits before invoking the
 *    LLM, so `content` is absent.
 * 3. Empty response:        anything else. Signals a real bug (pipeline
 *    error, blocked account) — the caller should log and skip.
 *
 * The old inline `response?.content ?? 'Üzgünüm, şu an yanıt veremiyorum.'`
 * silently collapsed (2) and (3) into the same generic apology, which is
 * what surfaced as the 2026-08-26 Instagram DM handoff bug (Ali Uğurlu Fiat):
 * every visitor message after handoff triggered the fallback because
 * `agent_active` was ignored.
 *
 * Localization is intentionally minimal — the vast majority of Meta-channel
 * bots today are Turkish, and there is no incoming-language signal at this
 * point in the request path other than what the caller already knows about
 * the bot. Callers may pass `primaryLanguage` if they have it; the resolver
 * defaults to Turkish otherwise.
 *
 * TODO (backlog #23 — channel-aware chat architecture): agent replies on
 * Meta channels have no return path today. This helper only makes the
 * visitor-facing bot side non-broken; the human agent still cannot reply
 * back to Instagram DM / Messenger / WhatsApp from the dashboard. Full
 * fix requires plumbing `channel` through `RequestState` and adding
 * outbound-agent-message adapters per channel.
 */

import { stripMarkdown } from 'src/util/strip-markdown.util';

export type MetaReplyLang = 'tr' | 'en';

/**
 * Deterministic handoff-pending acknowledgment shown once per visitor
 * message while the chat is in HUMAN_ACTIVE. Not ideal (repeats on every
 * subsequent turn until backlog #23 delivers agent-reply path), but
 * infinitely better than the confusing "Üzgünüm, şu an yanıt veremiyorum."
 * fallback the visitor previously saw.
 */
const HANDOFF_PENDING_MESSAGE: Record<MetaReplyLang, string> = {
  tr: 'Mesajınız ekibimize iletildi. Kısa süre içinde sizinle iletişime geçilecek.',
  en: 'Your message has been forwarded to the team. Someone will be in touch shortly.',
};

/**
 * Returns the text to send to the visitor on a Meta channel, or `null` if
 * the caller should skip the send entirely (unknown state — log + move on
 * rather than post a misleading apology).
 */
export function resolveMetaReplyText(
  response: any,
  lang: MetaReplyLang = 'tr',
): string | null {
  // Messenger / Instagram DM / WhatsApp render plain text only, so any
  // Markdown the model produced (`**bold**`, `[label](url)`, `## H2`)
  // would show up literally in the visitor's chat. The gateway strips on
  // the non-streaming path but only when MARKDOWN_STRIP_ENABLED is set
  // and never in SSE mode — strip again here so the guarantee holds for
  // these channels regardless of gateway config or the bot's streaming
  // flag.
  if (response?.content) return stripMarkdown(response.content);
  if (response?.agent_active) return HANDOFF_PENDING_MESSAGE[lang];
  return null;
}

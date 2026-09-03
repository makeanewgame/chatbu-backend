/**
 * Strip Markdown formatting from a plain-text bot reply.
 *
 * Port of:
 *   - fovi-longa-chat-be `app-gateway/utils/markdown_strip.py:strip_markdown`
 *   - chatbu-frontend `src/lib/stripMarkdown.ts:stripMarkdown`
 *
 * Why this exists on the backend too: Meta channels (Messenger / Instagram
 * DM) and WhatsApp render plain text only — a `**bold**` or `[label](url)`
 * marker shows up literally in the visitor's chat. The gateway's
 * `MarkdownStripMiddleware` already strips on the non-streaming path it
 * serves these channels, but that strip is env-flagged
 * (`MARKDOWN_STRIP_ENABLED`) and skipped whenever a bot is flipped to SSE
 * streaming. Stripping again at the channel send edge makes the guarantee
 * local and unconditional for the surfaces that can't render Markdown.
 *
 * Idempotent: `stripMarkdown(stripMarkdown(x)) === stripMarkdown(x)`.
 * Safe on plain text — returns the input unchanged when no markup exists.
 *
 * Order of substitutions matters (kept in lockstep with the Python / FE
 * sources):
 *   1. code blocks first (contents are literal)
 *   2. images before links (both share `[...](...)`)
 *   3. bold+italic > bold > italic
 *   4. strikethrough
 *   5. line-anchored patterns (headers, blockquotes) last
 */

// Fenced code — three backticks with optional language, spans lines.
const FENCED_CODE_RE = /```[a-zA-Z0-9_-]*\n?([\s\S]*?)\n?```/g;
// Inline code — single backtick pair on the same line.
const INLINE_CODE_RE = /`([^`\n]+)`/g;
// Image before link — leading `!` distinguishes; both share `[...](...)`.
const IMAGE_RE = /!\[([^\]\n]*)\]\([^)\n]+\)/g;
// Link `[label](url)` — replace with label (or url if label empty).
const LINK_RE = /\[([^\]\n]*)\]\(([^)\n]+)\)/g;
// Bold+italic `***text***` — MUST run before bold.
const BOLD_ITALIC_STAR_RE = /\*\*\*([^*\n]+?)\*\*\*/g;
// Bold `**text**` — MUST run before italic.
const BOLD_STAR_RE = /\*\*([^*\n]+?)\*\*/g;
// Bold `__text__` — underscore variant.
const BOLD_UNDERSCORE_RE = /__([^_\n]+?)__/g;
// Italic single-star `*text*` — word-boundary trick so `2*3` / `**foo*`
// don't match.
const ITALIC_STAR_RE = /(?<![*\w])\*([^*\n]+?)\*(?!\w)/g;
// Italic single-underscore `_text_` — strict boundaries so
// `erkan_sirin@…` and `_dunder_` stay intact.
const ITALIC_UNDERSCORE_RE = /(?<![_\w])_([^_\n]+?)_(?![_\w])/g;
// Strikethrough `~~text~~`.
const STRIKETHROUGH_RE = /~~([^~\n]+?)~~/g;
// ATX headers `# `..`###### ` at line start — strip marker only, keep text.
const HEADER_RE = /^(#{1,6})\s+/gm;
// Blockquote leader `> ` at line start (may repeat).
const BLOCKQUOTE_RE = /^(?:>\s?)+/gm;

export function stripMarkdown(text: string): string {
  if (!text) return text;

  let out = text;

  // 1. Code blocks first — their contents are literal.
  out = out.replace(FENCED_CODE_RE, (_m, inner) => inner);
  out = out.replace(INLINE_CODE_RE, (_m, inner) => inner);

  // 2. Images before links.
  out = out.replace(IMAGE_RE, (_m, alt) => alt);
  out = out.replace(LINK_RE, (_m, label, url) => (label ? label : url));

  // 3. Bold+italic > bold > italic (widest first).
  out = out.replace(BOLD_ITALIC_STAR_RE, (_m, inner) => inner);
  out = out.replace(BOLD_STAR_RE, (_m, inner) => inner);
  out = out.replace(BOLD_UNDERSCORE_RE, (_m, inner) => inner);
  out = out.replace(ITALIC_STAR_RE, (_m, inner) => inner);
  out = out.replace(ITALIC_UNDERSCORE_RE, (_m, inner) => inner);

  // 4. Strikethrough.
  out = out.replace(STRIKETHROUGH_RE, (_m, inner) => inner);

  // 5. Line-anchored patterns.
  out = out.replace(HEADER_RE, '');
  out = out.replace(BLOCKQUOTE_RE, '');

  return out;
}

/**
 * Incremental Server-Sent Event frame parser.
 *
 * SSE frames arrive on the wire as `event: <name>\ndata: <json>\n\n`.
 * TCP chunks handed to the reader are NOT aligned to frame boundaries —
 * one chunk may hold several complete frames plus a partial trailing
 * frame that must accumulate until the next chunk arrives. This helper
 * buffers those partial reads and yields complete frames.
 *
 * Used by the widget SSE proxy in `bot.service.ts:publicChatStreamInternal`
 * to observe gateway output (token accumulation, metadata event capture)
 * while forwarding the raw byte stream to the client. The parser does
 * NOT rewrite frames — it only reads a shadow copy.
 *
 * Malformed frames (missing `event:` or `data:`, non-JSON payload) are
 * dropped silently in the JSON branch and returned with `data: rawString`
 * in the fallback branch — the accumulator's job is best-effort
 * observation for persistence, not strict protocol enforcement (the
 * client is receiving the exact bytes regardless).
 *
 * The parser is intentionally NOT tied to a specific event schema —
 * that's the caller's job. See `chat_sse.py` (fovi-longa-chat-be) for
 * the authoritative frame types.
 */
export interface SseFrame {
  event: string;
  /**
   * Parsed JSON if `data:` line was valid JSON (the normal case for
   * every gateway frame). Falls back to the raw `data:` line as a
   * string if JSON.parse throws, so callers that want to gracefully
   * ignore malformed frames can `typeof === 'object'` gate.
   */
  data: any;
}

export class SseFrameParser {
  private buffer = '';

  /**
   * Push chunk bytes into the parser and return every complete frame
   * that can now be decoded. Any trailing partial frame stays in the
   * internal buffer until the next `feed` call.
   */
  feed(chunk: Buffer | string): SseFrame[] {
    this.buffer +=
      typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    const frames: SseFrame[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      const parsed = this.parseFrame(raw);
      if (parsed) frames.push(parsed);
    }
    return frames;
  }

  /**
   * Flush any partial frame the buffer still holds. Called when the
   * upstream stream closes so a lone frame without a trailing `\n\n`
   * (rare — gateway is well-behaved — but possible on ungraceful shutdown)
   * is still surfaced. Returns [] when the buffer is empty or the
   * partial cannot be parsed.
   */
  flush(): SseFrame[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }
    const parsed = this.parseFrame(this.buffer);
    this.buffer = '';
    return parsed ? [parsed] : [];
  }

  private parseFrame(raw: string): SseFrame | null {
    let eventType = '';
    let dataLine = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.slice('data:'.length).trim();
      }
    }
    if (!eventType || !dataLine) {
      return null;
    }
    try {
      return { event: eventType, data: JSON.parse(dataLine) };
    } catch {
      return { event: eventType, data: dataLine };
    }
  }
}

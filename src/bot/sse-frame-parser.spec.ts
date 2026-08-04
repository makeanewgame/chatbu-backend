/**
 * SseFrameParser unit tests.
 *
 * The parser sits on the widget SSE proxy hot path — every gateway
 * byte arrives here to be shadow-parsed for post-stream persistence.
 * A regression that mis-frames chunks (miscount buffer boundaries,
 * drop metadata event when it splits across chunks) silently corrupts
 * widget transcript writes and quota counters without any observable
 * error at request time.
 */

import { SseFrameParser } from './sse-frame-parser';

describe('SseFrameParser', () => {
  it('parses a single complete frame', () => {
    const parser = new SseFrameParser();
    const frames = parser.feed('event: token\ndata: {"delta":"hi"}\n\n');
    expect(frames).toEqual([{ event: 'token', data: { delta: 'hi' } }]);
  });

  it('parses multiple frames from one chunk', () => {
    const parser = new SseFrameParser();
    const frames = parser.feed(
      'event: token\ndata: {"delta":"a"}\n\n' +
        'event: token\ndata: {"delta":"b"}\n\n' +
        'event: end\ndata: {}\n\n',
    );
    expect(frames.map((f) => f.event)).toEqual(['token', 'token', 'end']);
    expect(frames[0].data).toEqual({ delta: 'a' });
    expect(frames[1].data).toEqual({ delta: 'b' });
    expect(frames[2].data).toEqual({});
  });

  it('buffers a frame that spans two chunks', () => {
    // Gateway may flush mid-frame; we must accumulate until the
    // `\n\n` terminator arrives in a later chunk.
    const parser = new SseFrameParser();
    const first = parser.feed('event: token\ndata: {"delt');
    expect(first).toEqual([]);
    const second = parser.feed('a":"hi"}\n\n');
    expect(second).toEqual([{ event: 'token', data: { delta: 'hi' } }]);
  });

  it('buffers a frame that spans three chunks', () => {
    const parser = new SseFrameParser();
    expect(parser.feed('event: metadata\n')).toEqual([]);
    expect(parser.feed('data: {"session_id":"s1","tokens":{')).toEqual([]);
    const done = parser.feed('"total_tokens":42}}\n\n');
    expect(done).toHaveLength(1);
    expect(done[0].event).toBe('metadata');
    expect(done[0].data.session_id).toBe('s1');
    expect(done[0].data.tokens.total_tokens).toBe(42);
  });

  it('preserves UTF-8 (Turkish, Arabic) — Polly needs raw chars', () => {
    // Non-Latin text arriving in the SSE stream MUST survive the
    // parser without escape corruption — voice pods feed the text
    // directly to TTS and Polly won't decode `\uXXXX` back.
    const parser = new SseFrameParser();
    const frames = parser.feed(
      'event: token\ndata: {"delta":"Merhaba çğ ıöşü مرحبا"}\n\n',
    );
    expect(frames[0].data.delta).toBe('Merhaba çğ ıöşü مرحبا');
  });

  it('drops frames missing an event: line', () => {
    // Malformed frames must not surface as `event: ""` — that would
    // corrupt caller switch statements. Silent drop is safe: the
    // client's already-forwarded bytes carry the real signal.
    const parser = new SseFrameParser();
    const frames = parser.feed('data: {"lonely":true}\n\n');
    expect(frames).toEqual([]);
  });

  it('drops frames missing a data: line', () => {
    const parser = new SseFrameParser();
    const frames = parser.feed('event: token\n\n');
    expect(frames).toEqual([]);
  });

  it('falls back to raw string when data: is not valid JSON', () => {
    // The gateway always sends JSON, but a proxy misconfiguration or
    // future non-JSON event type shouldn't crash the parser.
    const parser = new SseFrameParser();
    const frames = parser.feed('event: raw\ndata: plain text here\n\n');
    expect(frames).toEqual([{ event: 'raw', data: 'plain text here' }]);
  });

  it('flush() returns a trailing partial frame if it parses', () => {
    // Some gateway shutdowns close the socket right after the final
    // frame's `data:` line without the trailing `\n\n`. Flush is our
    // last chance to recover the metadata event so persistence still
    // gets an accurate token count.
    const parser = new SseFrameParser();
    parser.feed('event: metadata\ndata: {"session_id":"s2"}');
    const flushed = parser.flush();
    expect(flushed).toEqual([{ event: 'metadata', data: { session_id: 's2' } }]);
  });

  it('flush() returns [] when the buffer is empty', () => {
    const parser = new SseFrameParser();
    parser.feed('event: token\ndata: {"delta":"a"}\n\n');
    expect(parser.flush()).toEqual([]);
  });

  it('flush() returns [] when the trailing partial is malformed', () => {
    const parser = new SseFrameParser();
    parser.feed('event: broken\n'); // no data: line at all
    expect(parser.flush()).toEqual([]);
  });

  it('accepts Buffer chunks (Node stream data event shape)', () => {
    // Real gateway chunks arrive as Buffer, not string. The .on('data')
    // handler in bot.service.ts passes them through unchanged.
    const parser = new SseFrameParser();
    const buf = Buffer.from('event: token\ndata: {"delta":"buf"}\n\n', 'utf-8');
    const frames = parser.feed(buf);
    expect(frames[0].data.delta).toBe('buf');
  });

  it('handles a metadata event that splits across many small chunks', () => {
    // Simulate worst-case fragmentation — one character per chunk.
    // If the buffer boundary logic mis-counts, one of these will fail.
    const parser = new SseFrameParser();
    const frame = 'event: metadata\ndata: {"session_id":"x","actions":[{"type":"KVKK_CONSENT"}],"human_handover":false}\n\n';
    const emittedFrames: any[] = [];
    for (const ch of frame) {
      emittedFrames.push(...parser.feed(ch));
    }
    expect(emittedFrames).toHaveLength(1);
    expect(emittedFrames[0].event).toBe('metadata');
    expect(emittedFrames[0].data.session_id).toBe('x');
    expect(emittedFrames[0].data.actions[0].type).toBe('KVKK_CONSENT');
    expect(emittedFrames[0].data.human_handover).toBe(false);
  });
});

import { resolveMetaReplyText } from './meta-reply.util';

describe('resolveMetaReplyText', () => {
  it('returns stripped content for a normal bot reply', () => {
    expect(resolveMetaReplyText({ content: '**Merhaba** dünya' })).toBe('Merhaba dünya');
  });

  it('returns null during HUMAN_ACTIVE — the bot is fully silent', () => {
    // Regression for the 2026-09-04 Beautyisland canary: the old
    // HANDOFF_PENDING acknowledgment raced the human agent on every
    // visitor turn and never appeared in the dashboard transcript.
    expect(resolveMetaReplyText({ agent_active: true, session_id: 'x' })).toBeNull();
  });

  it('returns null for unknown shapes (caller logs, no misleading apology)', () => {
    expect(resolveMetaReplyText({})).toBeNull();
    expect(resolveMetaReplyText(undefined)).toBeNull();
  });
});

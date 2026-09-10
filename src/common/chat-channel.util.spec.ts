import {
  consentSourceForChat,
  inferChatChannel,
  isOffWidgetChat,
} from './chat-channel.util';

describe('chat-channel.util', () => {
  describe('inferChatChannel', () => {
    it.each([
      ['ig_1128825063142264_1788609920677', 'INSTAGRAM'],
      ['fb_1352067784645988_998', 'META_MESSENGER'],
      ['wa_905321112233', 'WHATSAPP'],
      // The WhatsApp test console mints wa_test_… — same family, and it
      // has no widget either.
      ['wa_test_905556259605', 'WHATSAPP'],
      ['sid_abc123', 'WIDGET'],
      ['cmqjrhegd00003ukaur1psong-4cf19b82-20656-2328', 'WIDGET'],
    ])('maps %s to %s', (chatId, expected) => {
      expect(inferChatChannel(chatId)).toBe(expected);
    });

    it('treats a missing chatId as the widget, never as a Meta channel', () => {
      // Fail-safe direction: an unknown chat must not inherit the
      // off-widget consent shortcut.
      expect(inferChatChannel(undefined)).toBe('WIDGET');
      expect(inferChatChannel(null)).toBe('WIDGET');
      expect(inferChatChannel('')).toBe('WIDGET');
      expect(inferChatChannel('   ')).toBe('WIDGET');
    });

    it('does not match a prefix that merely appears inside the id', () => {
      expect(inferChatChannel('sid_ig_not_instagram')).toBe('WIDGET');
    });
  });

  describe('isOffWidgetChat', () => {
    it('is true exactly for the DM channels', () => {
      expect(isOffWidgetChat('ig_1')).toBe(true);
      expect(isOffWidgetChat('fb_1')).toBe(true);
      expect(isOffWidgetChat('wa_1')).toBe(true);
      expect(isOffWidgetChat('sid_1')).toBe(false);
      expect(isOffWidgetChat(null)).toBe(false);
    });
  });

  describe('consentSourceForChat', () => {
    it('labels off-widget rows by channel so they are distinguishable from card taps', () => {
      expect(consentSourceForChat('ig_1')).toBe('chatbot_instagram');
      expect(consentSourceForChat('fb_1')).toBe('chatbot_messenger');
      expect(consentSourceForChat('wa_1')).toBe('chatbot_whatsapp');
    });

    it('leaves widget rows on the historical label', () => {
      expect(consentSourceForChat('sid_1')).toBe('chatbot');
    });
  });
});

import { looksLikeSpamName } from './suspicious-name.util';

describe('looksLikeSpamName', () => {
  it('accepts ordinary names', () => {
    for (const name of [
      'Hazal Can Elersu',
      'Ayşe Yılmaz',
      "O'Brien",
      'Jean-Luc Picard',
      '李雷',
      'José da Silva',
      'Anna-Maria 🙂',
    ]) {
      expect(looksLikeSpamName(name)).toBe(false);
    }
  });

  it('rejects the observed abuse payloads', () => {
    for (const name of [
      '✨Claim 70K Lira - Your Key is One Tap Away -> https://bit.ly/4hTkAkc ✨',
      'FREE MONEY www.scam.shop',
      'Win now t.me/spamchannel',
      'contact me: 5551234567890',
      '$$$ 70000 $$$',
      '✨✨✨✨✨ Claim ✨✨✨✨✨',
    ]) {
      expect(looksLikeSpamName(name)).toBe(true);
    }
  });

  it('rejects control characters and invisible smuggling', () => {
    const zeroWidthSpace = String.fromCharCode(0x200b);
    const rtlOverride = String.fromCharCode(0x202e);
    expect(looksLikeSpamName('John\nDoe')).toBe(true);
    expect(looksLikeSpamName(`John${zeroWidthSpace}Doe promo`)).toBe(true);
    expect(looksLikeSpamName(`a${rtlOverride}evil`)).toBe(true);
  });

  it('rejects non-string and out-of-range lengths', () => {
    expect(looksLikeSpamName(undefined)).toBe(true);
    expect(looksLikeSpamName('')).toBe(true);
    expect(looksLikeSpamName('x')).toBe(true);
    expect(looksLikeSpamName('a'.repeat(121))).toBe(true);
  });
});

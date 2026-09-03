import { stripMarkdown } from './strip-markdown.util';

describe('stripMarkdown', () => {
  it('strips bold markers around a captured phone number', () => {
    expect(stripMarkdown('Telefon: **0538 123 45 67**')).toBe(
      'Telefon: 0538 123 45 67',
    );
  });

  it('strips bold / italic / bold+italic', () => {
    expect(stripMarkdown('**a** *b* ***c*** __d__ _e_')).toBe('a b c d e');
  });

  it('keeps link label, falls back to url when label empty', () => {
    expect(stripMarkdown('see [our offer](https://x.com/offer)')).toBe(
      'see our offer',
    );
    expect(stripMarkdown('[](https://x.com/offer)')).toBe(
      'https://x.com/offer',
    );
  });

  it('strips ATX headers and blockquote leaders but keeps the text', () => {
    expect(stripMarkdown('## Başlık\n> alıntı')).toBe('Başlık\nalıntı');
  });

  it('unwraps fenced and inline code', () => {
    expect(stripMarkdown('```js\nconst a = 1;\n```')).toBe('const a = 1;');
    expect(stripMarkdown('run `npm i` now')).toBe('run npm i now');
  });

  it('leaves Turkish emails and bare URLs intact', () => {
    expect(stripMarkdown('erkan_sirin@example.com')).toBe(
      'erkan_sirin@example.com',
    );
    expect(stripMarkdown('https://www.fovimarlo.com/offer')).toBe(
      'https://www.fovimarlo.com/offer',
    );
  });

  it('is idempotent and safe on plain text', () => {
    const plain = 'Merhaba, size nasıl yardımcı olabilirim?';
    expect(stripMarkdown(plain)).toBe(plain);
    const once = stripMarkdown('**Ad:** Erkan\n**Tel:** 05065432731');
    expect(stripMarkdown(once)).toBe(once);
  });

  it('returns falsy input unchanged', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown(undefined as unknown as string)).toBe(undefined);
  });
});

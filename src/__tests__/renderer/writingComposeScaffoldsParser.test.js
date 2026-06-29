import { parseComposeScaffolds } from '../../renderer/views/writing/composeScaffoldsParser';

describe('parseComposeScaffolds', () => {
  test('valid response returns gists / phrases / translation', () => {
    const out = parseComposeScaffolds({
      gists: ['Sentence 1 gist', 'Sentence 2 gist'],
      phrases: ['happened during', 'together with'],
      translation: 'Some translated text.',
    });
    expect(out.gists).toEqual(['Sentence 1 gist', 'Sentence 2 gist']);
    expect(out.phrases).toEqual(['happened during', 'together with']);
    expect(out.translation).toBe('Some translated text.');
  });

  test('drops non-string and empty entries from arrays', () => {
    const out = parseComposeScaffolds({
      gists: ['ok', '', null, 'also ok'],
      phrases: [42, 'good', '   '],
      translation: '',
    });
    expect(out.gists).toEqual(['ok', 'also ok']);
    expect(out.phrases).toEqual(['good']);
    expect(out.translation).toBe('');
  });

  test('missing fields default to empty', () => {
    const out = parseComposeScaffolds({});
    expect(out.gists).toEqual([]);
    expect(out.phrases).toEqual([]);
    expect(out.translation).toBe('');
  });

  test('string (raw JSON) input is parsed', () => {
    const out = parseComposeScaffolds(
      '{"gists":["a"],"phrases":["b"],"translation":"c"}',
    );
    expect(out).toEqual({ gists: ['a'], phrases: ['b'], translation: 'c' });
  });

  test('null input throws', () => {
    expect(() => parseComposeScaffolds(null)).toThrow(/expected object/i);
  });
});

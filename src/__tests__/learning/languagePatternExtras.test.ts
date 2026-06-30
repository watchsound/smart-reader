import {
  emptyExtrasFor,
  LanguagePatternExtras,
} from '../../commons/model/LearningPointDomains';

describe('LanguagePatternExtras for translate weaknesses', () => {
  test('accepts translate-weakness fields', () => {
    const extras: LanguagePatternExtras = {
      sourceLang: 'zh-Hans',
      targetLang: 'en-US',
      pattern: 'Existential there-is for stative 有',
      bucket: 'tense',
      learnerAttempt: 'The library has many books on second floor.',
      modelTarget: 'There are many books on the second floor of the library.',
      reason: '有 maps to existential "there are…"',
      hintsUsed: { svo: true, tense: false, vocabulary: false },
    };
    expect(extras.bucket).toBe('tense');
    expect(extras.hintsUsed?.svo).toBe(true);
  });
  test('emptyExtrasFor("language") returns required keys', () => {
    const e = emptyExtrasFor('language');
    expect(e.sourceLang).toBe('');
    expect(e.targetLang).toBe('');
    expect(e.pattern).toBe('');
  });
});

import {
  getSvoHintPrompt,
  getTenseHintPrompt,
  getTranslateComparePrompt,
  getTranslateParagraphComparePrompt,
} from '../../commons/utils/AIPrompts';

describe('Translate prompt functions', () => {
  test('getSvoHintPrompt embeds source + asks for subject/verb/object', () => {
    const p = getSvoHintPrompt('图书馆的二楼有很多书', 'Chinese');
    expect(p).toMatch(/图书馆的二楼有很多书/);
    expect(p).toMatch(/subject/i);
    expect(p).toMatch(/verb/i);
    expect(p).toMatch(/object/i);
  });

  test('getTenseHintPrompt embeds source + asks for tense + justification', () => {
    const p = getTenseHintPrompt('他昨天去了图书馆', 'Chinese');
    expect(p).toMatch(/他昨天去了图书馆/);
    expect(p).toMatch(/tense/i);
    expect(p).toMatch(/justification/i);
  });

  test('getTranslateComparePrompt embeds source + attempt + all 6 buckets + stepBreakdown', () => {
    const p = getTranslateComparePrompt(
      '图书馆的二楼有很多书',
      'The library has books on second floor',
      'Chinese',
    );
    expect(p).toMatch(/图书馆的二楼有很多书/);
    expect(p).toMatch(/The library has books on second floor/);
    ['tense', 'word-order', 'article-number', 'preposition-collocation', 'connector-cohesion', 'idiom-register'].forEach((b) => {
      expect(p).toMatch(new RegExp(b));
    });
    // stepBreakdown was dropped from the compare prompt — it's fetched
    // lazily via translate-quick when the user opens the breakdown panel.
    expect(p).not.toMatch(/stepBreakdown/);
  });

  test('getTranslateParagraphComparePrompt asks for sentenceComparisons + emphasises cohesion', () => {
    const p = getTranslateParagraphComparePrompt('图书馆。二楼有书。', 'Library. There are books.', 'Chinese');
    expect(p).toMatch(/sentenceComparisons/);
    expect(p).toMatch(/cohesion/i);
  });
});

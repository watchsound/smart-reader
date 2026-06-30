import {
  getSvoHintPrompt,
  getTenseHintPrompt,
  getTranslateComparePrompt,
  getTranslateParagraphComparePrompt,
  getVerbOptionsPrompt,
} from '../../commons/utils/AIPrompts';

describe('Translate prompt functions', () => {
  test('getSvoHintPrompt demands multi-clause decomposition with role tags', () => {
    const p = getSvoHintPrompt('因为下雨了，他没去图书馆', 'Chinese');
    expect(p).toMatch(/因为下雨了/);
    // The new prompt must instruct decomposing ALL clauses, not just main.
    expect(p).toMatch(/ALL of its clauses/);
    expect(p).toMatch(/"clauses"/);
    // Role enum should include the compound/complex-sentence categories.
    ['main', 'coordinate', 'relative', 'cause', 'concession', 'condition', 'time', 'noun-clause'].forEach((role) => {
      expect(p).toMatch(new RegExp(role));
    });
    // Each clause carries connector hints + a learner-facing note.
    expect(p).toMatch(/connectorEnglishHints/);
    expect(p).toMatch(/"note"/);
  });

  test('getVerbOptionsPrompt asks for per-verb English candidates with usage notes', () => {
    const p = getVerbOptionsPrompt('他昨天去了图书馆', 'Chinese');
    expect(p).toMatch(/他昨天去了图书馆/);
    expect(p).toMatch(/EVERY verb/);
    expect(p).toMatch(/"verbs"/);
    expect(p).toMatch(/"options"/);
    expect(p).toMatch(/usage/i);
    expect(p).toMatch(/example/i);
    expect(p).toMatch(/recommendedForThisSentence/);
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

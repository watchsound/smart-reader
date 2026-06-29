import { parseExpressionDiff } from '../../renderer/views/writing/expressionDiffParser';

describe('parseExpressionDiff', () => {
  test('valid response normalizes spans + notes', () => {
    const input = {
      spans: [
        { side: 'learner', text: 'made a choice', kind: 'weaker', pair_id: 'p1' },
        { side: 'original', text: 'took a decision', kind: 'stronger', pair_id: 'p1' },
        { side: 'learner', text: 'fast', kind: 'grammar', note: "use 'quickly'" },
      ],
      notes: [
        {
          pair_id: 'p1',
          learner_phrase: 'made a choice',
          original_phrase: 'took a decision',
          explanation: 'Take a decision is the standard collocation.',
        },
      ],
    };
    const result = parseExpressionDiff(input);
    expect(result.spans).toHaveLength(3);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].pair_id).toBe('p1');
  });

  test('drops spans with unknown side', () => {
    const input = {
      spans: [
        { side: 'learner', text: 'a', kind: 'weaker' },
        { side: 'banana', text: 'b', kind: 'weaker' },
      ],
      notes: [],
    };
    expect(parseExpressionDiff(input).spans).toHaveLength(1);
  });

  test('drops spans with unknown kind', () => {
    const input = {
      spans: [
        { side: 'learner', text: 'a', kind: 'mystery' },
        { side: 'learner', text: 'b', kind: 'grammar' },
      ],
      notes: [],
    };
    const out = parseExpressionDiff(input);
    expect(out.spans).toHaveLength(1);
    expect(out.spans[0].kind).toBe('grammar');
  });

  test('missing notes defaults to empty array', () => {
    expect(parseExpressionDiff({ spans: [] }).notes).toEqual([]);
  });

  test('string (raw JSON) is parsed', () => {
    const out = parseExpressionDiff('{"spans":[],"notes":[]}');
    expect(out).toEqual({ spans: [], notes: [] });
  });

  test('null input throws', () => {
    expect(() => parseExpressionDiff(null)).toThrow(/expected object/i);
  });
});

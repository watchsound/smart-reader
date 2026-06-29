import { parseRecallLadder } from '../../renderer/views/writing/recallLadderParser';

describe('parseRecallLadder', () => {
  test('valid response returns the 3 rungs', () => {
    const input = {
      light: 'Although the project ${fell} behind schedule…',
      medium: 'Although the project ${fell behind} schedule…',
      hard: 'Although ${the project fell behind schedule…}',
    };
    expect(parseRecallLadder(input)).toEqual(input);
  });

  test('missing rung throws', () => {
    expect(() =>
      parseRecallLadder({ light: 'a', medium: 'b' }),
    ).toThrow(/missing rung: hard/i);
  });

  test('non-string rung throws', () => {
    expect(() =>
      parseRecallLadder({ light: 'a', medium: 'b', hard: 42 }),
    ).toThrow(/rung "hard" must be a string/i);
  });

  test('null input throws', () => {
    expect(() => parseRecallLadder(null)).toThrow(/expected object/i);
  });

  test('string (raw JSON) input is parsed', () => {
    const json = JSON.stringify({ light: 'a', medium: 'b', hard: 'c' });
    expect(parseRecallLadder(json)).toEqual({
      light: 'a',
      medium: 'b',
      hard: 'c',
    });
  });
});

import { commitMaskAttempt } from '../../renderer/views/writing/maskAttempt';

describe('commitMaskAttempt', () => {
  test('exact match returns ok=true', () => {
    expect(commitMaskAttempt('decision', 'decision')).toEqual({
      ok: true,
      hint: null,
    });
  });

  test('case-insensitive match returns ok=true', () => {
    expect(commitMaskAttempt('Decision', 'decision')).toEqual({
      ok: true,
      hint: null,
    });
  });

  test('trailing/leading whitespace ignored', () => {
    expect(commitMaskAttempt('  decision  ', 'decision').ok).toBe(true);
  });

  test('empty attempt returns ok=false with no hint', () => {
    expect(commitMaskAttempt('', 'decision')).toEqual({
      ok: false,
      hint: null,
    });
  });

  test('wrong attempt returns ok=false with first-letter+length hint', () => {
    expect(commitMaskAttempt('choice', 'decision')).toEqual({
      ok: false,
      hint: 'd_______',
    });
  });

  test('hint preserves leading-letter case of expected', () => {
    expect(commitMaskAttempt('apple', 'Banana').hint).toBe('B_____');
  });

  test('multi-word expected: hint shows word-by-word skeleton', () => {
    expect(commitMaskAttempt('took the choice', 'made a decision').hint).toBe(
      'm___ a d_______',
    );
  });
});

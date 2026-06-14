const {
  register,
  lookup,
  listNames,
} = require('../../renderer/components/impressjs/effects/registries');

describe('effects/registries', () => {
  test('register + lookup roundtrips a descriptor', () => {
    const d = {
      name: '__test_effect__',
      track: 'typography',
      requiresWebGL: false,
      mood: ['calm'],
      roles: ['*'],
      apply: () => () => {},
    };
    register(d);
    expect(lookup('typography', '__test_effect__')).toBe(d);
  });

  test('lookup returns null for unknown name', () => {
    expect(lookup('typography', '__nope__')).toBeNull();
  });

  test('lookup returns null for unknown track', () => {
    expect(lookup('not_a_track', 'anything')).toBeNull();
  });

  test('register rejects missing name', () => {
    expect(() => register({ track: 'typography' })).toThrow(/name and track/);
  });

  test('register rejects unknown track', () => {
    expect(() => register({ name: 'x', track: 'bogus' })).toThrow(/unknown track/);
  });

  test('listNames returns registered names for a track', () => {
    register({
      name: '__list_test__',
      track: 'background',
      requiresWebGL: false,
      mood: [],
      roles: ['*'],
      apply: () => () => {},
    });
    expect(listNames('background')).toContain('__list_test__');
  });
});

const assemble = require('../../main/brain/spine/promptAssembler');

describe('promptAssembler', () => {
  test('combines input + context into a deterministic prompt', () => {
    const p = assemble({
      userInput: 'Propose a micro-card for: bonds price.',
      context: { mastery: [{ c: 'duration', m: 0.78 }] },
      profileLabel: 'Propose micro-card',
    });
    expect(p).toContain('Propose a micro-card');
    expect(p).toContain('mastery');
    expect(p).toContain('duration');
  });

  test('includes context section header when context is non-empty', () => {
    const p = assemble({ userInput: 'x', context: { mastery: [] }, profileLabel: 'X' });
    expect(p).toMatch(/Learner Context/);
  });

  test('omits context section when empty', () => {
    const p = assemble({ userInput: 'x', context: {}, profileLabel: 'X' });
    expect(p).not.toMatch(/Learner Context/);
  });
});

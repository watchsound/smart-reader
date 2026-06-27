const buildSeedPrompt = require('../../main/brain/prompts/forumSeed');
const buildReplyPrompt = require('../../main/brain/prompts/forumReply');

describe('forumSeed', () => {
  test('includes passage, persona voices, and the 6-turn sequence', () => {
    const prompt = buildSeedPrompt({
      bookTitle: 'Walden',
      chapterTitle: 'Solitude',
      passage: 'I have a great deal of company in my house.',
    });
    expect(prompt).toContain('Walden');
    expect(prompt).toContain('Solitude');
    expect(prompt).toContain('I have a great deal of company');
    expect(prompt).toContain('Mira');
    expect(prompt).toContain('Sam');
    expect(prompt).toContain('Sora');
    expect(prompt).toContain('Noa');
    expect(prompt).toMatch(/exactly 6 turns/i);
    expect(prompt).toMatch(/strict JSON/i);
  });

  test('truncates passage over 1500 chars', () => {
    const long = 'a'.repeat(2000);
    const prompt = buildSeedPrompt({
      bookTitle: 'X',
      chapterTitle: 'Y',
      passage: long,
    });
    const inPassage = prompt.split('"""')[1] || '';
    expect(inPassage.length).toBeLessThan(1700);
  });
});

describe('forumReply', () => {
  const history = [
    { persona: 'moderator', content: 'What is the claim here?' },
    { persona: 'skeptic', content: 'Sounds shaky.' },
  ];

  test('includes history, user content, and address directive when set', () => {
    const prompt = buildReplyPrompt({
      passage: 'short passage',
      history,
      userContent: 'I think Sam is wrong.',
      addressedTo: 'skeptic',
    });
    expect(prompt).toContain('Mira: What is the claim here?');
    expect(prompt).toContain('Sam: Sounds shaky.');
    expect(prompt).toContain('I think Sam is wrong.');
    expect(prompt).toMatch(/addressed this to:\s*Skeptic/);
  });

  test('omits address directive when addressedTo null', () => {
    const prompt = buildReplyPrompt({
      passage: 'p',
      history,
      userContent: 'general comment',
      addressedTo: null,
    });
    expect(prompt).not.toMatch(/addressed this to/);
  });

  test('compacts long history (>20 turns)', () => {
    const long = Array.from({ length: 30 }, (_, i) => ({
      persona: i % 2 ? 'skeptic' : 'synthesizer',
      content: `turn ${i}`,
    }));
    const prompt = buildReplyPrompt({
      passage: 'p',
      history: long,
      userContent: 'q',
      addressedTo: null,
    });
    expect(prompt).toMatch(/Earlier discussion/);
  });
});

// src/main/brain/prompts/forumSeed.js
const { PERSONAS } = require('../../../commons/model/forumPersonas');

const MAX_PASSAGE = 1500;

function buildSeedPrompt({ bookTitle, chapterTitle, passage }) {
  const trimmed =
    passage.length > MAX_PASSAGE
      ? `${passage.slice(0, MAX_PASSAGE)}…`
      : passage;
  const voices = ['moderator', 'skeptic', 'synthesizer', 'novice']
    .map(
      (id) => `- ${PERSONAS[id].name} (${PERSONAS[id].role}): ${PERSONAS[id].voice}`,
    )
    .join('\n');

  return `You are simulating a study forum where four readers are discussing a passage from a book.

PASSAGE (from "${bookTitle}", chapter "${chapterTitle}"):
"""
${trimmed}
"""

PERSONAS:
${voices}

Generate exactly 6 turns in this order:
1. Mira opens with a framing question about the passage.
2. Noa asks a clarifying question, naming what is unclear.
3. Sam challenges a claim or framing in the passage, with a concrete counterpoint.
4. Sora connects the passage to a broader idea or earlier reference.
5. Sam pushes back on Sora's connection — does it really hold?
6. Mira surfaces the open question back to the reader, inviting them to weigh in.

Each turn must:
- Stay in that persona's voice.
- Reference the passage concretely (quote a phrase or name a concept).
- Be 2-4 sentences. No filler.
- Build on prior turns — do not restate them.

Return strict JSON: { "turns": [ { "persona": "moderator|skeptic|synthesizer|novice", "content": "..." }, ... ] }`;
}

module.exports = buildSeedPrompt;

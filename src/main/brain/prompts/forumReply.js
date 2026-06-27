// src/main/brain/prompts/forumReply.js
const { PERSONAS } = require('../../../commons/model/forumPersonas');

const MAX_PASSAGE = 600;
const COMPACTION_THRESHOLD = 20;
const KEEP_RECENT = 12;

function turnLabel(t) {
  if (t.persona === 'user') return 'User';
  const p = PERSONAS[t.persona];
  return p ? p.name : t.persona;
}

function compactHistory(history) {
  if (history.length <= COMPACTION_THRESHOLD) return history;
  const recent = history.slice(-KEEP_RECENT);
  const older = history.slice(0, history.length - KEEP_RECENT);
  const speakers = [
    ...new Set(
      older
        .filter((t) => t.persona !== 'user')
        .map((t) => turnLabel(t)),
    ),
  ].join(', ');
  return [
    {
      persona: 'system',
      content: `[Earlier discussion: ${speakers} covered ${older.length} turns]`,
    },
    ...recent,
  ];
}

function buildReplyPrompt({ passage, history, userContent, addressedTo }) {
  const trimmed =
    passage.length > MAX_PASSAGE
      ? `${passage.slice(0, MAX_PASSAGE)}…`
      : passage;
  const compact = compactHistory(history);
  const historyLines = compact
    .map((t) => `${turnLabel(t)}: ${t.content}`)
    .join('\n');

  const addressLine = addressedTo
    ? `\nThe user addressed this to: ${PERSONAS[addressedTo].role} (${PERSONAS[addressedTo].name}).`
    : '';

  return `You are continuing a study forum discussion.

PASSAGE (excerpt, for grounding):
${trimmed}

DISCUSSION SO FAR:
${historyLines}

USER JUST POSTED:
${userContent}${addressLine}

Rules:
- If the user addressed a specific persona, that persona MUST respond first.
- One other persona MAY chime in only if the topic naturally fits their lens (Skeptic for claims, Synthesizer for cross-references, Novice for confusion, Moderator only to redirect a stuck thread).
- Return 1 or 2 turns. Never more. Never zero — if no one would naturally engage, Mira nudges the user forward with a question.
- Each turn 2-4 sentences. Stay in voice. Reference what the user said.

Return strict JSON: { "turns": [ { "persona": "moderator|skeptic|synthesizer|novice", "content": "..." }, ... ] }`;
}

module.exports = buildReplyPrompt;

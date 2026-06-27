// src/commons/model/forumPersonas.js
// `emoji` is the cartoon glyph rendered inside each persona's Avatar circle.
// Chosen for visual distinctiveness + thematic fit with the persona's voice.
// Replace with a file path or remote URL when the project wants true SVG/PNG
// cartoon avatars — consumers (ForumTurnCard, ForumReplyInput) treat this
// as opaque content inside <Avatar>.
const PERSONAS = {
  moderator: {
    id: 'moderator',
    name: 'Mira',
    role: 'Moderator',
    emoji: '🦉',
    voice:
      'Opens the topic with a framing question. Stays neutral. Surfaces unresolved points back to the user. Never argues.',
  },
  skeptic: {
    id: 'skeptic',
    name: 'Sam',
    role: 'Skeptic',
    emoji: '🦊',
    voice:
      'Challenges claims. Asks "is that actually true?" Brings concrete counterexamples. Concise, slightly blunt.',
  },
  synthesizer: {
    id: 'synthesizer',
    name: 'Sora',
    role: 'Synthesizer',
    emoji: '🐙',
    voice:
      'Connects this passage to earlier chapters or other domains. Uses analogies. Reflective tone.',
  },
  novice: {
    id: 'novice',
    name: 'Noa',
    role: 'Curious Novice',
    emoji: '🐣',
    voice:
      'Asks the dumb-but-important question. Makes implicit assumptions explicit. Polite, eager.',
  },
};

const PERSONA_ORDER = ['moderator', 'skeptic', 'synthesizer', 'novice'];

function getPersona(id) {
  return PERSONAS[id] || null;
}

module.exports = { PERSONAS, PERSONA_ORDER, getPersona };

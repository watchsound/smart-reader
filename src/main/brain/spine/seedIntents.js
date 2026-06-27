// src/main/brain/spine/seedIntents.js
const intents = require('./intents');

intents.register('extract-learning-points', {
  label: 'Extract learning points',
  contextSlices: ['currentBook', 'mastery'],
  costCeilingTokens: 1200,
  cachePolicy: 'content-hash',
});

intents.register('propose-microcard', {
  label: 'Propose micro-card',
  contextSlices: ['currentBook', 'mastery', 'recentEpisodes'],
  costCeilingTokens: 800,
  cachePolicy: 'content-hash',
});

intents.register('diagnose-book', {
  label: 'Pre-reading book diagnostic',
  contextSlices: ['mastery', 'activeQuest'],
  costCeilingTokens: 1500,
  cachePolicy: 'content-hash',
});

intents.register('grade-comprehension', {
  label: 'Grade comprehension',
  contextSlices: ['currentBook', 'mastery', 'recentEpisodes'],
  costCeilingTokens: 1000,
  cachePolicy: 'none',
});

intents.register('plan-cross-book-path', {
  label: 'Plan cross-book learning path',
  contextSlices: ['activeQuest', 'mastery'],
  costCeilingTokens: 2000,
  cachePolicy: 'session',
});

intents.register('schedule-reread', {
  label: 'Schedule re-read',
  contextSlices: ['recentComprehension', 'recentEpisodes'],
  costCeilingTokens: 600,
  cachePolicy: 'none',
});

intents.register('suggest-organize', {
  label: 'Suggest MoodBoard organize',
  contextSlices: ['mastery', 'currentBook'],
  costCeilingTokens: 800,
  cachePolicy: 'content-hash',
});

intents.register('schedule-production-prompt', {
  label: 'Schedule production prompt',
  contextSlices: ['mastery', 'activeQuest'],
  costCeilingTokens: 800,
  cachePolicy: 'content-hash',
});

intents.register('argument-xray', {
  label: 'Argument X-ray',
  contextSlices: ['currentBook'],
  costCeilingTokens: 1200,
  cachePolicy: 'content-hash',
});

intents.register('synthesize-pull-suggestion', {
  label: 'Synthesize pull suggestion',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  costCeilingTokens: 1000,
  cachePolicy: 'session',
});

intents.register('tutor-context', {
  label: 'Tutor system prompt',
  contextSlices: ['activeQuest', 'currentBook', 'mastery', 'recentEpisodes'],
  costCeilingTokens: 1500,
  cachePolicy: 'session',
});

intents.register('director-pull-suggestion', {
  label: 'Director — pull suggestion ReAct loop',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  costCeilingTokens: 1500,
  cachePolicy: 'content-hash',
});

intents.register('director-session-step', {
  label: 'Director — per-step session decision',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery'],
  costCeilingTokens: 2000,
  cachePolicy: 'none',
});

intents.register('session-soft-write', {
  label: 'Session soft-write acknowledgement',
  contextSlices: [],
  costCeilingTokens: 200,
  cachePolicy: 'none',
});

intents.register('simulate-forum-seed', {
  label: 'Study Forum — generate opening discussion',
  contextSlices: ['currentBook'],
  costCeilingTokens: 2000,
  cachePolicy: 'none',
  schema: {
    type: 'object',
    required: ['turns'],
    properties: {
      turns: {
        type: 'array',
        items: {
          type: 'object',
          required: ['persona', 'content'],
          properties: {
            persona: {
              type: 'string',
              enum: ['moderator', 'skeptic', 'synthesizer', 'novice'],
            },
            content: { type: 'string' },
          },
        },
      },
    },
  },
});

intents.register('simulate-forum-reply', {
  label: 'Study Forum — generate persona reply',
  contextSlices: ['currentBook'],
  costCeilingTokens: 1400,
  cachePolicy: 'none',
  schema: {
    type: 'object',
    required: ['turns'],
    properties: {
      turns: {
        type: 'array',
        items: {
          type: 'object',
          required: ['persona', 'content'],
          properties: {
            persona: {
              type: 'string',
              enum: ['moderator', 'skeptic', 'synthesizer', 'novice'],
            },
            content: { type: 'string' },
          },
        },
      },
    },
  },
});

module.exports = {};

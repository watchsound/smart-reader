// src/main/brain/director/configs/pullSuggestion.js
const deterministicPullFallback = require('./deterministicPullFallback');

module.exports = {
  intent: 'director-pull-suggestion',
  contextSlices: ['activeQuest', 'recentEpisodes', 'mastery', 'acceptDismissPatterns'],
  systemPrompt: `
You are deciding ONE concrete next action for the learner right now. Be specific and brief.

You have a budget of 3 iterations total. Each iteration you must return EITHER:
- { action: "tool", tool: "<name>", args: { ... }, reasoning?: "..." } to gather more context
- { action: "answer", answer: { title, body, navigate? }, reasoning?: "..." } to conclude

Prefer answering directly if the injected Learner Context is sufficient. Only use tools when the
context truly lacks the signal you need.

Final answer schema:
- title:    string, ≤ 80 chars, imperative ("Review your weak yield-curve concept")
- body:     string, ≤ 200 chars, one-sentence why
- navigate: optional string, route path (e.g. "reading/3", "vocabulary", "knowledge") or omitted
`,
  tools: ['topUnmasteredConcepts', 'recentEpisodeSummary', 'currentQuestProgress'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      navigate: { type: 'string' },
    },
    required: ['title', 'body'],
  },
  budget: 3,
  deterministicFallback: deterministicPullFallback,
};

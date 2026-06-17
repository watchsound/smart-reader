const config = require('../../main/brain/director/configs/studySession');

test('config wires director-session-step intent + 13 tools', () => {
  expect(config.intent).toBe('director-session-step');
  expect(config.tools).toEqual(expect.arrayContaining([
    'topUnmasteredConcepts', 'recentEpisodeSummary', 'currentQuestProgress',
    'dueReviewsByDomain', 'recentlyAcceptedMicroCards',
    'openLeitnerCard', 'openComprehensionPanel', 'openMicroCardChip', 'openMoodBoard',
    'scheduleReread', 'createMicroCard', 'scheduleProductionPrompt',
    'endSession',
  ]));
  expect(config.tools).toHaveLength(13);
  expect(config.budget).toBe(12);
});

test('promptTemplate includes goal + iteration + observations', () => {
  const prompt = config.promptTemplate({
    goal: 'Review weak vocabulary', iteration: 2, budget: 12,
    observations: [{ tool: 'topUnmasteredConcepts', summary: '5 weak' }],
    softWrites: [],
  });
  expect(prompt).toMatch(/Review weak vocabulary/);
  expect(prompt).toMatch(/2\/12/);
  expect(prompt).toMatch(/topUnmasteredConcepts/);
});

test('fallback returns endSession with budget-exhausted reason', () => {
  const decision = config.fallback({ state: { iteration: 12 } });
  expect(decision.tool).toBe('endSession');
  expect(decision.args.reason).toMatch(/fallback/);
});

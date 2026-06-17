// src/main/brain/director/configs/studySession.js
//
// Director config for the Study-Session loop.
// SessionRunner (Task 12) calls Director.step({ config, state, traceId, userId })
// once per iteration, building systemPrompt via config.promptTemplate each time.
//
// NOTE on field naming:
//   - `reasoning`  → the Director/LLM response field (REACT_STEP_SCHEMA + responseSchema)
//   - `args.reason` → the endSession TOOL argument — a different field, keep distinct.

module.exports = {
  intent: 'director-session-step',
  budget: 12,
  tools: [
    // read tools
    'topUnmasteredConcepts',
    'recentEpisodeSummary',
    'currentQuestProgress',
    'dueReviewsByDomain',
    'recentlyAcceptedMicroCards',
    // surface tools
    'openLeitnerCard',
    'openComprehensionPanel',
    'openMicroCardChip',
    'openMoodBoard',
    // soft-write tools
    'scheduleReread',
    'createMicroCard',
    'scheduleProductionPrompt',
    // control
    'endSession',
  ],

  /**
   * Builds the system prompt for one Director iteration.
   * SessionRunner calls this each step, passing the evolving session state.
   *
   * @param {{ goal: string, iteration: number, budget: number,
   *            observations: Array, softWrites: Array }} state
   * @returns {string}
   */
  promptTemplate: ({ goal, iteration, budget, observations, softWrites }) => `
You are conducting a study session.

Goal: ${goal}
Iteration: ${iteration}/${budget}
Observations so far: ${JSON.stringify(observations || [])}
Soft writes so far: ${(softWrites || []).map((w) => w.tool).join(', ') || 'none'}

Pick ONE tool to invoke next. If the goal is satisfied or no useful action remains, call endSession.
Return JSON: { "tool": "<name>", "args": {...}, "reasoning": "<one sentence>" }.
`.trim(),

  responseSchema: {
    type: 'object',
    properties: {
      tool:      { type: 'string' },
      args:      { type: 'object' },
      reasoning: { type: 'string' },
    },
    required: ['tool', 'args', 'reasoning'],
  },

  /**
   * Called by SessionRunner when the LLM is unavailable or budget is exhausted.
   * Returns a safe endSession decision so the session always terminates cleanly.
   *
   * @param {{ state: Object }} opts
   * @returns {{ tool: string, args: Object, reasoning: string }}
   */
  fallback: ({ state }) => ({   // eslint-disable-line no-unused-vars
    tool: 'endSession',
    args: { reason: 'fallback: director unavailable' },
    reasoning: 'fallback path',
  }),
};

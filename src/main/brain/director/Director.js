// src/main/brain/director/Director.js
/**
 * Director runtime — ReAct loop over a config object.
 *
 * Each iteration asks the LLM (via brainCall) to either call a tool or
 * produce a final answer. On budget exhaustion or any unrecoverable error
 * the config's deterministicFallback() is returned so callers always get a
 * usable value.
 */
const brainCall = require('../spine/brainCall');
const tools = require('../spine/tools');
const crypto = require('crypto');

const REACT_STEP_SCHEMA = {
  type: 'object',
  properties: {
    action:    { type: 'string', enum: ['tool', 'answer'] },
    tool:      { type: 'string' },
    args:      { type: 'object' },
    answer:    { type: 'object' },
    reasoning: { type: 'string' },
  },
  required: ['action'],
};

function generateTraceId() {
  return `tr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function validateAnswer(answer, outputSchema) {
  if (!answer || typeof answer !== 'object') return false;
  const required = outputSchema?.required || [];
  for (const k of required) {
    if (!(k in answer)) return false;
  }
  return true;
}

function buildIterationPrompt(systemPrompt, input, history, availableTools) {
  const toolDescriptions = (availableTools || [])
    .map((name) => {
      const d = tools.describe(name);
      return d ? `- ${name}: ${d.description || 'no description'}` : null;
    })
    .filter(Boolean)
    .join('\n');
  const historyBlock = history.length === 0 ? '(no iterations yet)' : history
    .map((h, i) => `Step ${i + 1}: tool=${h.tool} args=${JSON.stringify(h.args || {})} result=${JSON.stringify(h.result)}`)
    .join('\n');
  return [
    systemPrompt,
    '',
    'Available tools:',
    toolDescriptions || '(none)',
    '',
    'Iteration history:',
    historyBlock,
    '',
    `Task: ${input}`,
    '',
    'Return a JSON object matching the ReAct step schema: { action: "tool"|"answer", ... }',
  ].join('\n');
}

async function run({ config, input, userId = 1, contextOverrides = {} }) {
  const traceId = generateTraceId();
  const history = [];
  const callIds = [];

  try {
    for (let iter = 0; iter < config.budget; iter++) {
      const prompt = buildIterationPrompt(config.systemPrompt, input, history, config.tools);
      let stepResult;
      try {
        stepResult = await brainCall(config.intent, prompt, {
          userId,
          traceId,
          schema: REACT_STEP_SCHEMA,
          contextOverrides,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[Director] brainCall failed iter=${iter}:`, e?.message || e);
        return runFallback(config, traceId, callIds);
      }
      callIds.push(stepResult.callId);
      const step = stepResult.output || {};

      if (step.action === 'tool') {
        if (!config.tools.includes(step.tool)) {
          history.push({ tool: step.tool, args: step.args || {}, result: { error: 'tool not in director scope' } });
          continue;
        }
        try {
          const result = await tools.invoke(step.tool, step.args || {});
          history.push({ tool: step.tool, args: step.args || {}, result });
        } catch (e) {
          history.push({ tool: step.tool, args: step.args || {}, result: { error: e?.message || String(e) } });
        }
        continue;
      }

      if (step.action === 'answer') {
        if (validateAnswer(step.answer, config.outputSchema)) {
          return { output: step.answer, traceId, callIds, usedFallback: false };
        }
        history.push({ tool: null, args: null, result: { error: 'malformed final answer' } });
        continue;
      }

      // Unknown action — treat as a malformed step and keep iterating.
      history.push({ tool: null, args: null, result: { error: `unknown action: ${step.action}` } });
    }
    return runFallback(config, traceId, callIds);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Director] unexpected error:', e?.message || e);
    return runFallback(config, traceId, callIds);
  }
}

function runFallback(config, traceId, callIds) {
  return {
    output: config.deterministicFallback(),
    traceId,
    callIds,
    usedFallback: true,
  };
}

module.exports = { run };

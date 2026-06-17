// src/main/brain/director/UndoRegistry.js
/**
 * UndoRegistry — maps soft-write tool names to their reversal functions.
 *
 * The live trace sidebar (Plan 10b-2) calls run(toolName, args) to undo
 * a previously auto-executed soft-write. Each soft-write tool registers
 * its own reversal handler at module load time.
 *
 * Contract:
 *   - register(toolName, handler) — bind a reversal fn (may be async)
 *   - run(toolName, args) → { undone: boolean, reason?: string }
 *   - __reset() — test helper; clears all handlers between test cases
 */

const HANDLERS = new Map();

function register(toolName, handler) {
  HANDLERS.set(toolName, handler);
}

async function run(toolName, args) {
  const handler = HANDLERS.get(toolName);
  if (!handler) return { undone: false, reason: 'no-handler' };
  try {
    return await handler(args);
  } catch (e) {
    return { undone: false, reason: e.message };
  }
}

function __reset() {
  HANDLERS.clear();
}

module.exports = { register, run, __reset };

// src/main/brain/spine/tools.js
/**
 * Tool Registry — declarations of AI-invocable capabilities.
 *
 * Phase 9: registered + describable + listable, but invocation throws.
 * Phase 10 (Director Mode) wires invoke() to actual handlers.
 *
 * Schemas are JSON-schema-shaped property maps with type per property.
 */

const TOOLS = {};
const HANDLERS = {};

function register(name, decl) {
  if (!name || !decl || !decl.schema) {
    throw new Error('tools.register: name and schema required');
  }
  TOOLS[name] = Object.freeze({ name, ...decl });
}

function registerHandler(name, fn) {
  if (!TOOLS[name]) {
    throw new Error(`registerHandler: tool '${name}' is not registered`);
  }
  HANDLERS[name] = fn;
}

function _clearHandlers() { for (const k of Object.keys(HANDLERS)) delete HANDLERS[k]; }

function describe(name) {
  return TOOLS[name] || null;
}

function list() {
  return Object.keys(TOOLS).sort();
}

function invoke(name, args) {
  if (!TOOLS[name]) throw new Error(`unknown tool: ${name}`);
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`tool ${name} has no handler — Phase 10 must register one`);
  return handler(args || {});
}

register('navigate', {
  description: 'Navigate the renderer to a view.',
  schema: { properties: { view: { type: 'string' }, params: { type: 'object' } }, required: ['view'] },
});
register('createMicroCard', {
  description: 'Create a micro-card from a paragraph.',
  schema: {
    properties: {
      paragraphId: { type: 'string' },
      front: { type: 'string' },
      back: { type: 'string' },
    },
    required: ['paragraphId', 'front', 'back'],
  },
});
register('markConceptMastered', {
  description: 'Mark a concept as mastered in the learning point store.',
  schema: { properties: { conceptId: { type: 'string' } }, required: ['conceptId'] },
});
register('openMoodBoard', {
  description: 'Open a specific MoodBoard view.',
  schema: { properties: { boardId: { type: 'string' } }, required: ['boardId'] },
});
register('scheduleReread', {
  description: 'Schedule a chapter for re-reading.',
  schema: {
    properties: {
      bookId: { type: 'string' },
      chapterIndex: { type: 'number' },
      delayHours: { type: 'number' },
    },
    required: ['bookId', 'chapterIndex'],
  },
});

module.exports = { register, registerHandler, _clearHandlers, describe, list, invoke };

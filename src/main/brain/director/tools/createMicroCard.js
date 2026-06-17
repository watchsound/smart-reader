// src/main/brain/director/tools/createMicroCard.js
/**
 * createMicroCard — soft-write Director tool.
 *
 * Calls meteredCallJson to get a ledger row (tagged
 * session-soft-write:createMicroCard), then commits an accepted micro-card
 * draft via the MicroCardProposer singleton. Returns { callId, microCardId }
 * so the live trace sidebar (Plan 10b-2) can surface an undo action.
 *
 * Undo: UndoRegistry.run('createMicroCard', { microCardId }) → removes the card.
 *
 * Why re-register 'createMicroCard': tools.js bootstraps a minimal Phase-9
 * skeleton of this tool. This module replaces it with the full Director-aware
 * declaration (correct schema, kind=soft-write) at Phase 10b-1 load time.
 *
 * Why microCardProposerSingleton: MicroCardProposer is an ES-module default
 * export that requires no injection but pulls in aiProviderManager and other
 * Electron-context modules on import. The singleton wrapper exposes the narrow
 * commit/delete surface for Director tools and is mockable in Jest without
 * touching the ES-module default.
 */
const tools = require('../../spine/tools');
const meteredCallJson = require('../../spine/meteredCallJson');
const MicroCardProposer = require('../../../utils/microCardProposerSingleton');
const UndoRegistry = require('../UndoRegistry');

// Re-register with the authoritative schema and kind, overwriting the Phase-9
// skeleton in tools.js.
tools.register('createMicroCard', {
  description: 'Create a micro-card from a paragraph the user just read. Reversible.',
  argsSchema: {
    properties: {
      userId:        { type: 'number' },
      paragraphHash: { type: 'string' },
      draft:         { type: 'object' },
      domain:        { type: 'string' },
    },
    required: ['userId', 'paragraphHash', 'draft', 'domain'],
  },
  kind: 'soft-write',
});

tools.registerHandler('createMicroCard', async (args, ctx = {}) => {
  const {
    userId = 1,
    paragraphHash = '',
    draft = {},
    domain = 'knowledge',
  } = args;

  const { callId } = await meteredCallJson(
    `Create micro-card from paragraph ${paragraphHash}, domain ${domain}`,
    null,
    { legacyLabel: 'session-soft-write:createMicroCard', traceId: ctx.traceId },
  );

  const { id: microCardId } = MicroCardProposer.commit({
    userId, paragraphHash, draft, domain,
  });

  return { callId, microCardId };
});

UndoRegistry.register('createMicroCard', async ({ microCardId }) => {
  const undone = MicroCardProposer.delete(microCardId);
  return { undone: !!undone };
});

/**
 * Shared JSDoc typedefs for the Brain-driven shell.
 * Imported by both main and renderer processes — no runtime exports.
 *
 * @module commons/brain/triggerTypes
 */

/**
 * @typedef {'atomic-chip' | 'inline-sequence' | 'multi-surface-flow'} FlowUnit
 */

/**
 * @typedef {'low' | 'normal' | 'high'} TriggerPriority
 */

/**
 * @typedef {'idle' | 'thinking' | 'has-proposal' | 'mid-flow' | 'uncertain'} OrbState
 */

/**
 * Where a Trigger should render. The shape is unit-dependent.
 * For atomic-chip: `{ kind: 'paragraph', cfi: string }` or `{ kind: 'global' }`.
 * For inline-sequence: `{ kind: 'view', view: string }`.
 * For multi-surface-flow: `{ kind: 'flow', steps: Array<{ view: string, payload?: object }> }`.
 *
 * @typedef {object} SurfaceTarget
 * @property {string} kind
 * @property {string} [cfi]
 * @property {string} [view]
 * @property {Array<object>} [steps]
 */

/**
 * @typedef {object} Trigger
 * @property {string} id                Stable dedup id, e.g. `phase4:para:${cfi}`
 * @property {string} source            Trigger source tag, e.g. `phase-4-micro-card`
 * @property {FlowUnit} unit
 * @property {SurfaceTarget} surfaceTarget
 * @property {TriggerPriority} priority
 * @property {number} freshness         TTL in ms after emission
 * @property {number} emittedAt         epoch ms
 * @property {object} payload           unit-specific payload
 */

/**
 * A queued Trigger awaiting user engagement.
 * @typedef {Trigger & { queuedAt: number, status: 'queued' | 'active' | 'dismissed' | 'expired' }} Proposal
 */

/**
 * @typedef {object} FlowState
 * @property {string} proposalId
 * @property {FlowUnit} unit
 * @property {'running' | 'paused' | 'completed' | 'aborted'} status
 * @property {number} [step]            current step for sequence/multi-surface
 * @property {number} [totalSteps]
 */

module.exports = {};

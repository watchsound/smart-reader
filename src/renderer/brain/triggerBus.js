/**
 * TriggerBus — renderer-side singleton that subscribes to main-process
 * Trigger emissions, owns the ProposalQueue, and exposes pub/sub for
 * the Orb, FlowCoordinator, and Brain Dashboard.
 *
 * The active proposal snapshot is captured at accept() time, before the
 * queue dismisses it — downstream consumers (FlowCoordinator) read it
 * from getActiveProposal() / snapshot.activeProposal.
 *
 * Lifecycle: init() once from BrainShell mount.
 */

const ProposalQueue = require('./proposalQueue');

const queue = new ProposalQueue();
const subscribers = new Set();
let initialized = false;
let activeProposalId = null;
let activeProposalSnapshot = null;

function getOrbState() {
  if (activeProposalId) return 'mid-flow';
  const size = queue.size();
  if (size === 0) return 'idle';
  return 'has-proposal';
}

function persistQueueSnapshot() {
  const ipc = window.electron?.ipcRenderer;
  if (!ipc) return;
  try {
    // Fire-and-forget; persistence is best-effort.
    ipc.invoke('brain:trigger:queue-snapshot', queue.list());
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[triggerBus] persist failed', e);
  }
}

function notify() {
  const snapshot = {
    queue: queue.list(),
    orbState: getOrbState(),
    activeProposalId,
    activeProposal: activeProposalSnapshot,
  };
  persistQueueSnapshot();
  subscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[triggerBus] subscriber error', e);
    }
  });
}

function init() {
  if (initialized) return;
  const ipc = window.electron?.ipcRenderer;
  if (!ipc) {
    // eslint-disable-next-line no-console
    console.warn('[triggerBus] ipcRenderer unavailable; bus is inert.');
    return;
  }
  ipc.on('brain:trigger:push', (_evt, trigger) => {
    queue.enqueue(trigger);
    notify();
  });
  // Restore any queue snapshot persisted by a previous session.
  // Best-effort: queue.enqueue dedups by id, so re-restoring is idempotent;
  // expired items are purged by queue.purgeExpired on next reaching it.
  try {
    Promise.resolve(ipc.invoke('brain:trigger:queue-restore')).then((items) => {
      if (!Array.isArray(items) || items.length === 0) return;
      items.forEach((item) => queue.enqueue(item));
      queue.purgeExpired();
      notify();
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[triggerBus] restore failed', e);
  }
  initialized = true;
}

function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function getQueueSnapshot() {
  return queue.list();
}

function getActiveProposal() {
  return activeProposalSnapshot;
}

async function accept(proposalId) {
  const captured = queue.list().find((p) => p.id === proposalId) || null;
  const ipc = window.electron?.ipcRenderer;
  if (ipc) await ipc.invoke('brain:trigger:accept', proposalId);
  activeProposalId = proposalId;
  activeProposalSnapshot = captured;
  queue.dismiss(proposalId);
  notify();
}

async function dismiss(proposalId) {
  const ipc = window.electron?.ipcRenderer;
  if (ipc) await ipc.invoke('brain:trigger:dismiss', proposalId);
  queue.dismiss(proposalId);
  notify();
}

function completeActive() {
  activeProposalId = null;
  activeProposalSnapshot = null;
  notify();
}

async function pull() {
  const top = queue.peek();
  if (top) return top;
  const ipc = window.electron?.ipcRenderer;
  if (!ipc) return null;
  return ipc.invoke('brain:trigger:pull');
}

// Test-only: clear all module-level state so tests can share React imports
// without jest.resetModules() (which causes "two copies of React" errors).
function _resetForTests() {
  Array.from(queue.list()).forEach((p) => queue.dismiss(p.id));
  subscribers.clear();
  initialized = false;
  activeProposalId = null;
  activeProposalSnapshot = null;
}

module.exports = {
  init,
  subscribe,
  getQueueSnapshot,
  getActiveProposal,
  getOrbState,
  accept,
  dismiss,
  completeActive,
  pull,
  _resetForTests,
};

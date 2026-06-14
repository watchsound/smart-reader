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

// Set of bookIds in active Quests. Bus owns this so ProposalQueue can
// consult it lazily during sort (see proposalQueue.getQuestBookIds opt).
let questBookIds = new Set();

const queue = new ProposalQueue({
  getQuestBookIds: () => questBookIds,
});
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

/**
 * Set the active Quest book IDs. Bus consults this set when sorting the
 * Proposal queue: matching proposals bubble to the top within their
 * priority tier. Triggers a notify so subscribers re-render with the
 * reordered queue immediately.
 *
 * @param {Iterable<number>} ids
 */
function setQuestBookIds(ids) {
  questBookIds = new Set();
  if (ids) {
    for (const id of ids) if (typeof id === 'number') questBookIds.add(id);
  }
  notify();
}

async function _hydrateQuestContext() {
  const ipc = window.electron?.ipcRenderer;
  if (!ipc) return;
  try {
    const list = await ipc.invoke('quest-list', { status: 'active' });
    if (!Array.isArray(list)) {
      // quest-list handler guarantees an array; reaching this branch means
      // a transport regression. Log so it's not invisible — bus runs
      // unweighted, which is correct fallback semantics.
      // eslint-disable-next-line no-console
      console.warn('[triggerBus] quest-list returned non-array:', list);
      return;
    }
    const ids = new Set();
    list.forEach((q) => {
      (q.bookIds || []).forEach((b) => {
        if (typeof b === 'number') ids.add(b);
      });
    });
    questBookIds = ids;
    notify();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[triggerBus] hydrate quest context failed', e);
  }
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
  // Quest mutations on main re-broadcast so the bus can refresh its
  // weighting context without a renderer poll.
  ipc.on('quest:changed', () => {
    _hydrateQuestContext();
  });
  // Initial hydrate so a freshly-mounted bus already weights the queue
  // against existing active Quests from previous sessions.
  _hydrateQuestContext();
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
  if (ipc) {
    await ipc.invoke('brain:trigger:accept', {
      proposalId,
      source: captured?.source || null,
    });
  }
  activeProposalId = proposalId;
  activeProposalSnapshot = captured;
  queue.dismiss(proposalId);
  notify();
}

async function dismiss(proposalId) {
  // Capture source BEFORE removing from queue so telemetry sees it.
  const captured = queue.list().find((p) => p.id === proposalId)
    || (activeProposalSnapshot && activeProposalSnapshot.id === proposalId
      ? activeProposalSnapshot
      : null);
  const ipc = window.electron?.ipcRenderer;
  if (ipc) {
    await ipc.invoke('brain:trigger:dismiss', {
      proposalId,
      source: captured?.source || null,
    });
  }
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
  questBookIds = new Set();
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
  setQuestBookIds,
  _resetForTests,
};

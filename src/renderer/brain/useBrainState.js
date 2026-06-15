import { useEffect, useState } from 'react';
import triggerBus from './triggerBus';

/**
 * useBrainState — exposes Orb state, queue, and active proposal from
 * the singleton TriggerBus. Initializes the bus on first call.
 *
 * @returns {{
 *   orbState: import('../../commons/brain/triggerTypes').OrbState,
 *   queue: Array<import('../../commons/brain/triggerTypes').Proposal>,
 *   activeProposalId: string | null,
 *   activeProposal: import('../../commons/brain/triggerTypes').Proposal | null,
 * }}
 */
export default function useBrainState() {
  const [snapshot, setSnapshot] = useState(() => ({
    queue: triggerBus.getQueueSnapshot(),
    orbState: triggerBus.getOrbState(),
    activeProposalId: null,
    activeProposal: triggerBus.getActiveProposal(),
  }));

  useEffect(() => {
    triggerBus.init();
    const unsub = triggerBus.subscribe(setSnapshot);
    return unsub;
  }, []);

  return snapshot;
}

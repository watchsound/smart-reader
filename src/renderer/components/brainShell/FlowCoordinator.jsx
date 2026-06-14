import React from 'react';
import AtomicChipHost from './AtomicChipHost';

/**
 * FlowCoordinator — routes an active Proposal to its Flow Unit host.
 * Plan 1: only `atomic-chip` is implemented; `inline-sequence` and
 * `multi-surface-flow` are deferred to Plan 2.
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal | null} props.proposal
 */
export default function FlowCoordinator({ proposal }) {
  if (!proposal) return null;
  switch (proposal.unit) {
    case 'atomic-chip':
      return <AtomicChipHost proposal={proposal} />;
    case 'inline-sequence':
    case 'multi-surface-flow':
      // eslint-disable-next-line no-console
      console.warn(
        '[FlowCoordinator] flow unit not yet implemented:',
        proposal.unit,
      );
      return null;
    default:
      return null;
  }
}

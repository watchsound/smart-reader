import React from 'react';
import AtomicChipHost from './AtomicChipHost';
import InlineSequenceHost from './InlineSequenceHost';

/**
 * FlowCoordinator — routes an active Proposal to its Flow Unit host.
 * Plan 1: atomic-chip. Plan 2 slice 1: inline-sequence. multi-surface-flow
 * remains deferred.
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
      return <InlineSequenceHost proposal={proposal} />;
    case 'multi-surface-flow':
      // eslint-disable-next-line no-console
      console.warn(
        '[FlowCoordinator] multi-surface-flow not yet implemented:',
        proposal.id,
      );
      return null;
    default:
      return null;
  }
}

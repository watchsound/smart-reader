import React from 'react';
import AtomicChipHost from './AtomicChipHost';
import InlineSequenceHost from './InlineSequenceHost';
import MultiSurfaceFlowHost from './MultiSurfaceFlowHost';

/**
 * FlowCoordinator — routes an active Proposal to its Flow Unit host.
 * All three Flow Units are now installed (atomic-chip / inline-sequence /
 * multi-surface-flow).
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
      return <MultiSurfaceFlowHost proposal={proposal} />;
    default:
      return null;
  }
}

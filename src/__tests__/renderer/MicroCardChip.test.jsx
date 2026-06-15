import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
import MicroCardChip from '../../renderer/views/reading/MicroCardChip';
import { hashParagraph } from '../../commons/brain/paragraphHash';

jest.useFakeTimers();

function makeProposal(text) {
  return {
    proposalId: 'prop_1',
    front: 'Q: What?',
    back: 'A: That.',
    domain: 'knowledge',
    confidence: 0.8,
    paragraphHash: hashParagraph(text),
  };
}

// Walk up to the positioned chip surface. MUI emotion generates a class with
// `position: fixed`, so `getComputedStyle(el).position === 'fixed'` is the
// reliable cross-check. We climb until we hit it.
function findChipSurface(startEl) {
  let probe = startEl;
  while (probe && probe !== document.body) {
    const cs = window.getComputedStyle(probe);
    if (cs.position === 'fixed') return probe;
    probe = probe.parentElement;
  }
  return null;
}

describe('MicroCardChip — anchoring', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 768,
    });
  });

  test('falls back to fixed positioning when no accessor is given', () => {
    render(
      <MicroCardChip
        proposal={makeProposal('paragraph text')}
        onAccept={jest.fn()}
        onAcknowledge={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    const front = screen.getByText('Q: What?');
    const surface = findChipSurface(front);
    expect(surface).not.toBeNull();
    const cs = window.getComputedStyle(surface);
    // Fallback: bottom + right are set; top + left are not (auto).
    expect(cs.right).toBe('24px');
    expect(cs.bottom).toBe('24px');
  });

  test('anchors near the paragraph when accessor returns an element', () => {
    const text = 'paragraph whose hash drives positioning of the micro chip';
    const proposal = makeProposal(text);

    const fakeEl = document.createElement('p');
    fakeEl.textContent = text;
    document.body.appendChild(fakeEl);
    fakeEl.getBoundingClientRect = () => ({
      top: 100,
      left: 50,
      bottom: 140,
      right: 250,
      width: 200,
      height: 40,
      x: 50,
      y: 100,
      toJSON() {
        return {};
      },
    });

    // jsdom: fakeEl sits in the top window, so its
    // ownerDocument.defaultView.frameElement is null — the chip uses a
    // zero iframe offset, which matches the elRect we stubbed.
    const accessorRef = {
      current: {
        getElementByHash: (h) => (h === proposal.paragraphHash ? fakeEl : null),
      },
    };

    render(
      <MicroCardChip
        proposal={proposal}
        anchorAccessor={accessorRef}
        onAccept={jest.fn()}
        onAcknowledge={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    // The initial measure runs synchronously inside the effect; tick once
    // more for the interval to confirm it's stable.
    act(() => {
      jest.advanceTimersByTime(200);
    });

    const surface = findChipSurface(screen.getByText('Q: What?'));
    expect(surface).not.toBeNull();
    const cs = window.getComputedStyle(surface);
    // bottom (140) + ANCHOR_GAP (8) = 148
    expect(cs.top).toBe('148px');
    expect(cs.left).toBe('50px');
    // Anchored mode clears the fallback right/bottom — jsdom reports ''
    // when the longhand is the initial 'auto'; check it's NOT the 24px
    // fallback value.
    expect(cs.right).not.toBe('24px');
    expect(cs.bottom).not.toBe('24px');
  });

  test('dismiss button invokes onDismiss', () => {
    const onDismiss = jest.fn();
    render(
      <MicroCardChip
        proposal={makeProposal('x')}
        onAccept={jest.fn()}
        onAcknowledge={jest.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('header-close');
  });
});

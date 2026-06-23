/**
 * ReadingControls drag behavior.
 *
 * Pins three invariants:
 *  1) The toolbar starts at the centered transform (no drag offset).
 *  2) Pointer-down on the drag handle followed by pointermove on the window
 *     updates the toolbar's transform with the user's offset.
 *  3) Pointer-down on a regular toolbar button does NOT start a drag —
 *     button clicks must remain clickable, not get hijacked into drags.
 *
 * @jest-environment jsdom
 */

const React = require('react');
const { render, fireEvent, screen } = require('@testing-library/react');
const ReadingControls = require('../../renderer/views/reading/ReadingControls').default;

function renderToolbar(props = {}) {
  const defaultProps = {
    page: { curPage: 1, totalPages: 10 },
    visible: true,
    isFullscreen: false,
    onFullscreen: jest.fn(),
    fontSize: 100,
    onFontSizeChange: jest.fn(),
    onPrevPage: jest.fn(),
    onNextPage: jest.fn(),
    onZoomIn: jest.fn(),
    onZoomOut: jest.fn(),
    onSearch: jest.fn(),
    ...props,
  };
  return {
    ...render(React.createElement(ReadingControls, defaultProps)),
    props: defaultProps,
  };
}

describe('ReadingControls drag', () => {
  it('renders centered with no drag offset by default', () => {
    renderToolbar();
    const toolbar = screen.getByTestId('reading-controls-toolbar');
    // Default transform: translateX(-50%) + 0 offsets.
    expect(toolbar.style.transform).toBe(
      'translate(calc(-50% + 0px), 0px)',
    );
  });

  it('updates transform when the drag handle is dragged', () => {
    renderToolbar();
    const handle = screen.getByTestId('reading-controls-drag-handle');
    const toolbar = screen.getByTestId('reading-controls-toolbar');

    // fireEvent.pointerDown shorthand doesn't carry clientX/Y reliably in
    // jsdom; dispatch a MouseEvent directly so coordinates survive.
    fireEvent(
      handle,
      new MouseEvent('pointerdown', {
        clientX: 100,
        clientY: 200,
        bubbles: true,
      }),
    );
    fireEvent(
      window,
      new MouseEvent('pointermove', {
        clientX: 140,
        clientY: 175,
        bubbles: true,
      }),
    );

    // +40px horizontally, -25px vertically (drag up).
    expect(toolbar.style.transform).toBe(
      'translate(calc(-50% + 40px), -25px)',
    );

    fireEvent(window, new MouseEvent('pointerup', { bubbles: true }));
  });

  it('clicking a control button does NOT start a drag (button stays clickable)', () => {
    renderToolbar();
    const toolbar = screen.getByTestId('reading-controls-toolbar');

    // The DragHandle is the FIRST <button> in the toolbar; the next-page
    // button is later. Filter out the drag handle by data-testid so we hit
    // a real control button instead.
    const buttons = Array.from(toolbar.querySelectorAll('button')).filter(
      (b) => b.getAttribute('data-testid') !== 'reading-controls-drag-handle',
    );
    expect(buttons.length).toBeGreaterThan(0);
    const realBtn = buttons[0];

    fireEvent(
      realBtn,
      new MouseEvent('pointerdown', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }),
    );
    fireEvent(
      window,
      new MouseEvent('pointermove', {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      }),
    );

    // Transform must remain default — no drag was started.
    expect(toolbar.style.transform).toBe(
      'translate(calc(-50% + 0px), 0px)',
    );
  });
});

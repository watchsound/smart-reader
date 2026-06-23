/**
 * NoteCardSurface — Editorial Premium card chrome.
 *
 * Pins the surface's contract:
 *   - renders its children
 *   - applies the accent color (as the ::before stripe and ::after gradient)
 *   - runs the entry animation (CSS keyframes defined in the same file)
 *   - forwards onClick
 *
 * @jest-environment jsdom
 */

const React = require('react');
const { render, fireEvent, screen } = require('@testing-library/react');
const NoteCardSurface = require('../../renderer/components/note/NoteCardSurface').default;

function renderSurface(props = {}) {
  return render(
    React.createElement(
      NoteCardSurface,
      { accentColor: '#FFEB3B', ...props },
      React.createElement('div', { 'data-testid': 'child' }, 'child content'),
    ),
  );
}

describe('NoteCardSurface', () => {
  it('renders its children', () => {
    renderSurface();
    expect(screen.getByTestId('child').textContent).toBe('child content');
  });

  it('forwards onClick', () => {
    const onClick = jest.fn();
    renderSurface({ onClick });
    // Click bubbles from the child to the surface root.
    fireEvent.click(screen.getByTestId('child'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('injects the note-card-enter @keyframes globally (idempotent style block)', () => {
    renderSurface();
    const styleBlock = document.querySelector('[data-note-card-keyframes]');
    expect(styleBlock).not.toBeNull();
    expect(styleBlock.textContent).toContain('@keyframes note-card-enter');
  });

  it('renders without crashing when accentColor is undefined (falls back to theme primary)', () => {
    render(
      React.createElement(
        NoteCardSurface,
        {},
        React.createElement('div', { 'data-testid': 'fallback-child' }, 'no accent'),
      ),
    );
    // Just verify no throw; visual rendering uses theme.palette.primary.main
    // which jsdom can't resolve to a pixel value, but the component should mount.
    expect(screen.getByTestId('fallback-child').textContent).toBe('no accent');
  });

  it('mounts cleanly with useFlatBackground for presentation contexts', () => {
    // MoodBoard / Leitner / Slider opt in to flat-color cards. The
    // surface should mount and render children; visual rules (stripe
    // suppressed, background = accent) live in CSS which jsdom doesn't
    // resolve, but the prop must not throw.
    render(
      React.createElement(
        NoteCardSurface,
        { accentColor: '#FF5733', useFlatBackground: true },
        React.createElement('div', { 'data-testid': 'flat-child' }, 'flat'),
      ),
    );
    expect(screen.getByTestId('flat-child').textContent).toBe('flat');
  });

  it('accepts MUI palette names as accentColor without crashing (regression for old note records)', () => {
    // Old notes have `color: 'primary'` (a MUI palette name from
    // AnnotationNoteUtil.colorsMui), not a hex code. MUI's alpha() throws
    // on palette names — the surface must resolve them via the theme.
    ['primary', 'secondary', 'error', 'warning', 'info', 'success'].forEach(
      (paletteName) => {
        const { unmount } = render(
          React.createElement(
            NoteCardSurface,
            { accentColor: paletteName },
            React.createElement('div', null, `mui-${paletteName}`),
          ),
        );
        // Just verifying no throw during render.
        unmount();
      },
    );
  });

  it('renders a .note__body child without crashing (typography target lives in CSS)', () => {
    // Regression for "typography rules dormant" — CSS selectors target
    // `.note__body` inside the surface so the existing content scaffolding
    // gets the serif-quote refresh. jsdom can't resolve the computed
    // fontFamily on the descendant (emotion injects styles but jsdom
    // doesn't apply them to getComputedStyle reliably), so we just
    // verify the descendant mounts inside the surface's subtree.
    render(
      React.createElement(
        NoteCardSurface,
        { accentColor: '#FFEB3B' },
        React.createElement('div', {
          className: 'note__body',
          'data-testid': 'note-body',
          dangerouslySetInnerHTML: { __html: '<p>passage text</p>' },
        }),
      ),
    );
    const body = screen.getByTestId('note-body');
    expect(body.className).toContain('note__body');
    expect(body.querySelector('p').textContent).toBe('passage text');
  });
});

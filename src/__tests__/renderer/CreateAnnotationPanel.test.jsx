/**
 * CreateAnnotationPanel — save-button wiring.
 *
 * Pins the contract that the panel hands the final (selectionType, type,
 * color, emoji) tuple to handleWindowClose. Pre-fix, the Save button was
 * fixed-label "Save Highlight" regardless of selectedStyle, which let
 * users think the style buttons didn't do anything.
 *
 * @jest-environment jsdom
 */

// EmojiList pulls a stored emoji list through customStorage which calls
// window.electron.ipcRenderer — undefined in jsdom. Stub it out; the
// panel-save behavior we want to test doesn't depend on emoji rendering.
jest.mock('../../renderer/components/emoji/EmojiList', () => ({
  __esModule: true,
  default: () => null,
}));

const React = require('react');
const { render, fireEvent, screen } = require('@testing-library/react');
const CreateAnnotationPanel = require('../../renderer/views/reading/CreateAnnotationPanel').default;

function renderPanel(overrides = {}) {
  const handleWindowClose = jest.fn();
  const props = {
    handleWindowClose,
    setMarkColor: jest.fn(),
    setMarkType: jest.fn(),
    setEmoji: jest.fn(),
    showImageOption: true,
    showPresentOption: true,
    ...overrides,
  };
  render(React.createElement(CreateAnnotationPanel, props));
  return { handleWindowClose };
}

describe('CreateAnnotationPanel save flow', () => {
  it('save button defaults to "Save Highlight"', () => {
    renderPanel();
    expect(screen.getByTestId('save-annotation').textContent).toContain(
      'Save Highlight',
    );
  });

  it('save button label tracks the selected style', () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('style-underline'));
    expect(screen.getByTestId('save-annotation').textContent).toContain(
      'Save Underline',
    );

    fireEvent.click(screen.getByTestId('style-strikeline'));
    expect(screen.getByTestId('save-annotation').textContent).toContain(
      'Save Strike',
    );

    fireEvent.click(screen.getByTestId('style-dashline'));
    expect(screen.getByTestId('save-annotation').textContent).toContain(
      'Save Dash',
    );
  });

  it('clicking save forwards (selectionType, selectedStyle, selectedColor, selectedEmoji)', () => {
    const { handleWindowClose } = renderPanel();

    // Pick a non-default style so we can prove the panel forwards it.
    fireEvent.click(screen.getByTestId('style-strikeline'));
    fireEvent.click(screen.getByTestId('save-annotation'));

    expect(handleWindowClose).toHaveBeenCalledTimes(1);
    const [selectionType, style, color, emoji] =
      handleWindowClose.mock.calls[0];
    // selectionType is the SelectionType.Highlight sentinel — the panel
    // uses one save button regardless of style, with the style itself
    // carried in the second arg.
    expect(selectionType).toBe('highlight');
    expect(style).toBe('strikeline');
    // Default first color is yellow.
    expect(color).toBe('#FFEB3B');
    expect(emoji).toBe('');
  });

  // ─── Quick Note expand-in-place flow ──────────────────────────────────

  it('clicking the Note quick-action expands the panel with a textarea', () => {
    renderPanel();
    expect(screen.queryByTestId('quick-note-textarea')).toBeNull();

    fireEvent.click(screen.getByTestId('quick-note-toggle'));

    expect(screen.getByTestId('quick-note-textarea')).toBeInTheDocument();
    expect(
      screen.getByTestId('quick-note-full-editor'),
    ).toBeInTheDocument();
  });

  it('saving with typed text dispatches QuickNote and includes the text', () => {
    const { handleWindowClose } = renderPanel();
    fireEvent.click(screen.getByTestId('quick-note-toggle'));

    // The TextField wraps the textarea; .querySelector reaches the actual
    // <textarea> element.
    const textareaWrapper = screen.getByTestId('quick-note-textarea');
    const textarea = textareaWrapper.querySelector('textarea');
    fireEvent.change(textarea, { target: { value: 'this is my note' } });
    fireEvent.click(screen.getByTestId('save-annotation'));

    const [selectionType, , , , noteText] = handleWindowClose.mock.calls[0];
    expect(selectionType).toBe('quick-note');
    expect(noteText).toBe('this is my note');
  });

  it('saving with empty textarea falls back to plain Highlight', () => {
    const { handleWindowClose } = renderPanel();
    fireEvent.click(screen.getByTestId('quick-note-toggle'));
    // No text typed.
    fireEvent.click(screen.getByTestId('save-annotation'));

    const [selectionType, , , , noteText] = handleWindowClose.mock.calls[0];
    expect(selectionType).toBe('highlight');
    expect(noteText).toBeUndefined();
  });

  it('whitespace-only textarea also falls back to plain Highlight', () => {
    const { handleWindowClose } = renderPanel();
    fireEvent.click(screen.getByTestId('quick-note-toggle'));
    const textarea = screen
      .getByTestId('quick-note-textarea')
      .querySelector('textarea');
    fireEvent.change(textarea, { target: { value: '   \n  ' } });
    fireEvent.click(screen.getByTestId('save-annotation'));

    const [selectionType] = handleWindowClose.mock.calls[0];
    expect(selectionType).toBe('highlight');
  });

  it('clicking "Open full editor" dispatches the existing Note flow (modal path)', () => {
    const { handleWindowClose } = renderPanel();
    fireEvent.click(screen.getByTestId('quick-note-toggle'));
    fireEvent.click(screen.getByTestId('quick-note-full-editor'));

    const [selectionType] = handleWindowClose.mock.calls[0];
    expect(selectionType).toBe('note');
  });

  it('save button label gains "+ Note" suffix when quick-note has text', () => {
    renderPanel();
    expect(screen.getByTestId('save-annotation').textContent).toContain(
      'Save Highlight',
    );
    expect(screen.getByTestId('save-annotation').textContent).not.toContain(
      '+ Note',
    );

    fireEvent.click(screen.getByTestId('quick-note-toggle'));
    const textarea = screen
      .getByTestId('quick-note-textarea')
      .querySelector('textarea');
    fireEvent.change(textarea, { target: { value: 'x' } });
    expect(screen.getByTestId('save-annotation').textContent).toContain(
      'Save Highlight + Note',
    );
  });
});

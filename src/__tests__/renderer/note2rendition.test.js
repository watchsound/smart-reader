/**
 * note2rendition — annotation-restore mapping.
 *
 * Pins the contract: every annotation type — highlight included — is
 * routed through epub.js's 'underline' annotation path so it hits the
 * custom View.prototype.underline override. The override dispatches on
 * `mtype` to the right Mark subclass. Before this, highlights took the
 * default epub.js highlight path, which silently dropped data.emoji.
 *
 * @jest-environment node
 */

const {
  note2rendition,
} = require('../../renderer/views/reading/AnnotationNoteUtil');

describe('note2rendition', () => {
  it('routes highlights through the custom underline path with mtype=Highlight', () => {
    const m = note2rendition({
      id: 'n1',
      type: 'highlight',
      cfi: 'epubcfi(/6/4!/4/2)',
      color: '#FFEB3B',
      emoji: '😊',
    });
    expect(m.aType).toBe('underline');
    expect(m.className).toBe('hl');
    expect(m.style.mtype).toBe('Highlight');
    expect(m.style.fill).toBe('#FFEB3B');
    expect(m.style['fill-opacity']).toBe('0.5');
    expect(m.detail.emoji).toBe('😊');
  });

  it('routes underline-style annotations through the same custom path with mtype=underline', () => {
    const m = note2rendition({
      id: 'n2',
      type: 'underline',
      cfi: 'epubcfi(/6/4!/4/4)',
      color: '#2196F3',
      emoji: '',
    });
    expect(m.aType).toBe('underline');
    expect(m.className).toBe('ul');
    expect(m.style.mtype).toBe('underline');
    expect(m.style.stroke).toBe('#2196F3');
    expect(m.style.fill).toBeUndefined();
  });

  it('preserves strikeline/dashline mtype so reload renders the right Mark subclass', () => {
    const strike = note2rendition({
      id: 'n3',
      type: 'strikeline',
      cfi: 'cfi/x',
      color: '#E91E63',
    });
    expect(strike.style.mtype).toBe('strikeline');

    const dash = note2rendition({
      id: 'n4',
      type: 'dashline',
      cfi: 'cfi/y',
      color: '#9C27B0',
    });
    expect(dash.style.mtype).toBe('dashline');
  });
});

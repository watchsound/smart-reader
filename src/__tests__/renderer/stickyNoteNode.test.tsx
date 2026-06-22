// src/__tests__/renderer/stickyNoteNode.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { StickyNoteNodeModel } from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeModel';
import StickyNoteNodeWidget from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeWidget';

describe('StickyNoteNodeModel', () => {
  test('defaults: empty text, yellow color, 160x120', () => {
    const s = new StickyNoteNodeModel({});
    expect(s.text).toBe('');
    expect(s.color).toBe('#fff59d'); // pastel yellow
    expect(s.width).toBe(160);
    expect(s.height).toBe(120);
    expect(s.getType()).toBe('sticky');
  });

  test('serialize/deserialize round-trip', () => {
    const s = new StickyNoteNodeModel({
      text: 'central argument',
      color: '#ffcc80',
    });
    const data = s.serialize();
    const r = new StickyNoteNodeModel({});
    r.deserialize({ data });
    expect(r.text).toBe('central argument');
    expect(r.color).toBe('#ffcc80');
  });
});

describe('StickyNoteNodeWidget', () => {
  test('renders the text', () => {
    const s = new StickyNoteNodeModel({ text: 'hello' });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText } = render(
      <StickyNoteNodeWidget node={s} engine={engine} />,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  test('double-click → edit mode → blur commits text', () => {
    const s = new StickyNoteNodeModel({ text: 'old' });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText, container } = render(
      <StickyNoteNodeWidget node={s} engine={engine} />,
    );
    fireEvent.doubleClick(getByText('old'));
    const ta = container.querySelector(
      '[data-testid="sticky-textarea"]',
    ) as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    fireEvent.change(ta, { target: { value: 'new' } });
    fireEvent.blur(ta);
    expect(s.text).toBe('new');
  });
});

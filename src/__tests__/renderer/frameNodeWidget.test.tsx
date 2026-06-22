// src/__tests__/renderer/frameNodeWidget.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';
import FrameNodeWidget from '../../renderer/components/MoodBoard/diagram/FrameNodeWidget';

describe('FrameNodeWidget', () => {
  test('renders the frame label', () => {
    const frame = new FrameNodeModel({
      label: 'Vocabulary cluster',
      accentColor: '#42a5f5',
    });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText } = render(
      <FrameNodeWidget node={frame} engine={engine} />,
    );
    expect(getByText('Vocabulary cluster')).toBeTruthy();
  });

  test('applies the accent color to the border', () => {
    const frame = new FrameNodeModel({ accentColor: '#42a5f5' });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(
      <FrameNodeWidget node={frame} engine={engine} />,
    );
    const outer = container.querySelector('[data-testid="frame-outer"]');
    expect((outer as HTMLElement).style.borderColor).toBe(
      'rgb(66, 165, 245)',
    );
  });

  test('label is editable on double-click', () => {
    const frame = new FrameNodeModel({ label: 'old' });
    const engine = { repaintCanvas: jest.fn() };
    const { getByText, container } = render(
      <FrameNodeWidget node={frame} engine={engine} />,
    );
    fireEvent.doubleClick(getByText('old'));
    const input = container.querySelector(
      '[data-testid="frame-label-input"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: 'new label' } });
    fireEvent.blur(input);
    expect(frame.label).toBe('new label');
  });
});

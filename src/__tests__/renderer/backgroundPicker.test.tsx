// src/__tests__/renderer/backgroundPicker.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import BackgroundPicker from '../../renderer/components/MoodBoard/diagram/canvas/BackgroundPicker';

describe('BackgroundPicker', () => {
  test('renders 3 mode buttons: none / pattern / image', () => {
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'none' }} onChange={() => {}} />,
    );
    expect(container.querySelector('[data-mode="none"]')).toBeTruthy();
    expect(container.querySelector('[data-mode="pattern"]')).toBeTruthy();
    expect(container.querySelector('[data-mode="image"]')).toBeTruthy();
  });

  test('clicking "pattern" emits onChange with mode pattern', () => {
    const onChange = jest.fn();
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'none' }} onChange={onChange} />,
    );
    fireEvent.click(container.querySelector('[data-mode="pattern"]') as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'pattern' }),
    );
  });

  test('currently-selected mode has data-selected="true"', () => {
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'pattern' }} onChange={() => {}} />,
    );
    const selected = container.querySelector('[data-mode="pattern"][data-selected="true"]');
    expect(selected).toBeTruthy();
  });
});

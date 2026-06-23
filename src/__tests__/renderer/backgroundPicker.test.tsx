// src/__tests__/renderer/backgroundPicker.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import BackgroundPicker from '../../renderer/components/MoodBoard/diagram/canvas/BackgroundPicker';

describe('BackgroundPicker', () => {
  test('renders a single button showing the current mode', () => {
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'none' }} onChange={() => {}} />,
    );
    const btn = container.querySelector('[data-testid="background-picker"]');
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute('data-mode')).toBe('none');
  });

  test('clicking cycles from none → pattern and calls onChange', () => {
    const onChange = jest.fn();
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'none' }} onChange={onChange} />,
    );
    fireEvent.click(container.querySelector('[data-testid="background-picker"]') as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'pattern' }),
    );
  });

  test('button reflects current mode via data-mode attribute', () => {
    const { container } = render(
      <BackgroundPicker spec={{ mode: 'pattern' }} onChange={() => {}} />,
    );
    const btn = container.querySelector('[data-testid="background-picker"]');
    expect(btn?.getAttribute('data-mode')).toBe('pattern');
  });
});

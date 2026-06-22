// src/__tests__/renderer/themePicker.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ThemePicker from '../../renderer/components/MoodBoard/diagram/canvas/ThemePicker';

describe('ThemePicker', () => {
  test('renders one button per built-in palette + a "Custom" entry', () => {
    const { container } = render(
      <ThemePicker theme={{ paletteId: 'paper-and-ink' }} onChange={() => {}} />,
    );
    const buttons = container.querySelectorAll('[data-testid="theme-option"]');
    // 5 built-ins + 1 "Custom" entry
    expect(buttons.length).toBe(6);
  });

  test('clicking an option emits onChange with the chosen palette', () => {
    const onChange = jest.fn();
    const { container } = render(
      <ThemePicker theme={{ paletteId: 'paper-and-ink' }} onChange={onChange} />,
    );
    const warm = container.querySelector(
      '[data-testid="theme-option"][data-palette-id="warm-roman"]',
    ) as HTMLElement;
    fireEvent.click(warm);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ paletteId: 'warm-roman' }),
    );
  });

  test('the currently-selected palette has data-selected="true"', () => {
    const { container } = render(
      <ThemePicker theme={{ paletteId: 'cold-noir' }} onChange={() => {}} />,
    );
    const selected = container.querySelector(
      '[data-testid="theme-option"][data-selected="true"]',
    ) as HTMLElement;
    expect(selected).toBeTruthy();
    expect(selected.getAttribute('data-palette-id')).toBe('cold-noir');
  });
});

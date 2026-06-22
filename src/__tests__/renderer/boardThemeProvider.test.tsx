import React from 'react';
import { render } from '@testing-library/react';
import BoardThemeProvider from '../../renderer/components/MoodBoard/diagram/canvas/BoardThemeProvider';
import { PALETTES } from '../../renderer/components/MoodBoard/diagram/canvas/themes';

describe('BoardThemeProvider', () => {
  test('renders children inside a div that carries palette CSS variables', () => {
    const { container } = render(
      <BoardThemeProvider theme={{ paletteId: 'cold-noir' }}>
        <span>child</span>
      </BoardThemeProvider>,
    );
    const root = container.querySelector('[data-testid="board-theme-root"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.getPropertyValue('--mb-accent')).toBe(
      PALETTES['cold-noir'].accent,
    );
    expect(root.style.getPropertyValue('--mb-bg')).toBe(
      PALETTES['cold-noir'].bg,
    );
    expect(root.style.getPropertyValue('--mb-ink')).toBe(
      PALETTES['cold-noir'].ink,
    );
    expect(root.style.getPropertyValue('--mb-muted')).toBe(
      PALETTES['cold-noir'].muted,
    );
    expect(root.textContent).toBe('child');
  });

  test('fontFamily override populates --mb-font-family', () => {
    const { container } = render(
      <BoardThemeProvider theme={{ paletteId: 'warm-roman', fontFamily: 'serif' }}>
        <span />
      </BoardThemeProvider>,
    );
    const root = container.querySelector('[data-testid="board-theme-root"]') as HTMLElement;
    expect(root.style.getPropertyValue('--mb-font-family')).toContain('serif');
  });

  test('omitting fontFamily leaves --mb-font-family unset', () => {
    const { container } = render(
      <BoardThemeProvider theme={{ paletteId: 'austere-mono' }}>
        <span />
      </BoardThemeProvider>,
    );
    const root = container.querySelector('[data-testid="board-theme-root"]') as HTMLElement;
    expect(root.style.getPropertyValue('--mb-font-family')).toBe('');
  });
});

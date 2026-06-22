// src/renderer/components/MoodBoard/diagram/canvas/BoardThemeProvider.tsx
import * as React from 'react';
import { BoardTheme } from '../types';
import { resolvePalette } from './themes';

const FONT_STACKS: Record<string, string> = {
  serif: "'Source Serif Pro', Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
  display: "'Playfair Display', Georgia, serif",
};

export interface BoardThemeProviderProps {
  theme: BoardTheme;
  children: React.ReactNode;
}

function BoardThemeProvider({ theme, children }: BoardThemeProviderProps) {
  const palette = resolvePalette(theme);
  const style: React.CSSProperties = {
    '--mb-accent': palette.accent,
    '--mb-bg': palette.bg,
    '--mb-ink': palette.ink,
    '--mb-muted': palette.muted,
    width: '100%',
    height: '100%',
  } as React.CSSProperties;

  if (theme.fontFamily && FONT_STACKS[theme.fontFamily]) {
    (style as any)['--mb-font-family'] = FONT_STACKS[theme.fontFamily];
  }

  return (
    <div data-testid="board-theme-root" style={style}>
      {children}
    </div>
  );
}

export default BoardThemeProvider;

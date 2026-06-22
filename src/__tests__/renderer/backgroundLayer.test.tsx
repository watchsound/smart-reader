// src/__tests__/renderer/backgroundLayer.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import BackgroundLayer from '../../renderer/components/MoodBoard/diagram/canvas/BackgroundLayer';

describe('BackgroundLayer', () => {
  test('mode="none" renders an empty positioned layer', () => {
    const { container } = render(<BackgroundLayer spec={{ mode: 'none' }} />);
    const layer = container.querySelector('[data-testid="background-layer"]') as HTMLElement;
    expect(layer).toBeTruthy();
    expect(layer.querySelector('img')).toBeNull();
    expect(layer.querySelector('svg')).toBeNull();
  });

  test('mode="image" renders an <img> with provided src and applied opacity', () => {
    const { container } = render(
      <BackgroundLayer
        spec={{ mode: 'image', imageAssetId: 'data:image/png;base64,AAA', opacity: 0.2 }}
      />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(img.style.opacity).toBe('0.2');
  });

  test('mode="pattern" renders an inline SVG pattern (dot-grid by default)', () => {
    const { container } = render(
      <BackgroundLayer spec={{ mode: 'pattern', patternKey: 'dot-grid' }} />,
    );
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toBeTruthy();
    expect(svg.querySelector('pattern')).toBeTruthy();
  });

  test('opacity defaults to 0.1 when not provided', () => {
    const { container } = render(
      <BackgroundLayer spec={{ mode: 'image', imageAssetId: 'x' }} />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.opacity).toBe('0.1');
  });
});

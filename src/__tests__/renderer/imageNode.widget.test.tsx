// src/__tests__/renderer/imageNode.widget.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { ImageNodeModel } from '../../renderer/components/MoodBoard/diagram/ImageNodeModel';
import ImageNodeWidget from '../../renderer/components/MoodBoard/diagram/ImageNodeWidget';

describe('ImageNodeWidget', () => {
  test('renders an <img> with the node src', () => {
    const node = new ImageNodeModel({
      src: 'data:image/png;base64,AAA',
      width: 200,
      height: 150,
    });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(<ImageNodeWidget node={node} engine={engine} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  test('applies width/height to the outer container', () => {
    const node = new ImageNodeModel({ src: 'x', width: 300, height: 200 });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(<ImageNodeWidget node={node} engine={engine} />);
    const outer = container.querySelector('[data-testid="image-node-outer"]') as HTMLElement;
    expect(outer.style.width).toBe('300px');
    expect(outer.style.height).toBe('200px');
  });

  test('renders a placeholder when src is empty', () => {
    const node = new ImageNodeModel({ src: '' });
    const engine = { repaintCanvas: jest.fn() };
    const { container } = render(<ImageNodeWidget node={node} engine={engine} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="image-node-placeholder"]')).toBeTruthy();
  });
});

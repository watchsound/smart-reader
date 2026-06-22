// src/__tests__/renderer/colorZoneLayer.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import ColorZoneLayer from '../../renderer/components/MoodBoard/diagram/canvas/ColorZoneLayer';
import { ColorZone } from '../../renderer/components/MoodBoard/diagram/types';

describe('ColorZoneLayer', () => {
  test('renders one positioned div per zone', () => {
    const zones: ColorZone[] = [
      { id: 'z1', color: '#ffcc80', opacity: 0.2, x: 10, y: 20, width: 100, height: 80 },
      { id: 'z2', color: '#90caf9', opacity: 0.3, x: 200, y: 150, width: 150, height: 100 },
    ];
    const { container } = render(<ColorZoneLayer zones={zones} />);
    const items = container.querySelectorAll('[data-testid="color-zone"]');
    expect(items).toHaveLength(2);
  });

  test('a zone with label renders the label text', () => {
    const zones: ColorZone[] = [
      {
        id: 'z1',
        color: '#ffcc80',
        opacity: 0.2,
        x: 0, y: 0, width: 200, height: 100,
        label: 'Cause',
      },
    ];
    const { getByText } = render(<ColorZoneLayer zones={zones} />);
    expect(getByText('Cause')).toBeTruthy();
  });

  test('empty zones array renders nothing visible', () => {
    const { container } = render(<ColorZoneLayer zones={[]} />);
    expect(container.querySelectorAll('[data-testid="color-zone"]')).toHaveLength(0);
  });
});

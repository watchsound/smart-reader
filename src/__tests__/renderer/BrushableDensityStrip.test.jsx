import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BrushableDensityStrip from '../../renderer/components/brainShell/spendReturns/BrushableDensityStrip';

describe('BrushableDensityStrip', () => {
  it('renders one rect per day in densityData', () => {
    const data = [
      { day: '2026-06-01', count: 5 },
      { day: '2026-06-02', count: 3 },
      { day: '2026-06-03', count: 0 },
    ];
    const { container } = render(
      <BrushableDensityStrip
        densityData={data}
        selected={{ from: Date.UTC(2026,5,1), to: Date.UTC(2026,5,3) }}
        onChange={jest.fn()}
      />
    );
    expect(container.querySelectorAll('rect.density-day').length).toBe(3);
  });

  it('renders empty state gracefully when densityData is []', () => {
    const { container } = render(
      <BrushableDensityStrip densityData={[]} selected={{ from: 0, to: 1 }} onChange={jest.fn()} />
    );
    // Should not crash; should render some placeholder text or an empty svg
    expect(container).toBeTruthy();
  });

  it('fires onChange with new {from, to} when brush handle is dragged', () => {
    const onChange = jest.fn();
    const data = [
      { day: '2026-06-01', count: 5 },
      { day: '2026-06-02', count: 3 },
      { day: '2026-06-03', count: 1 },
    ];
    const { container } = render(
      <BrushableDensityStrip
        densityData={data}
        selected={{ from: Date.UTC(2026,5,1), to: Date.UTC(2026,5,3) }}
        onChange={onChange}
      />
    );
    // Simulate a pointer drag on the right brush handle
    const rightHandle = container.querySelector('rect.brush-handle-right');
    expect(rightHandle).toBeTruthy();
    fireEvent.pointerDown(rightHandle, { clientX: 200 });
    fireEvent.pointerMove(window, { clientX: 250 });
    fireEvent.pointerUp(window, { clientX: 250 });
    expect(onChange).toHaveBeenCalled();
    const [{ from, to }] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(typeof from).toBe('number');
    expect(typeof to).toBe('number');
  });
});

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SurfaceFrame from '../../../renderer/views/aiSession/SurfaceFrame';

test('no pendingSurface: shows Thinking state', () => {
  render(<SurfaceFrame pendingSurface={null} onSubmit={jest.fn()} lastThought="picking next move" />);
  expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  expect(screen.getByText(/picking next move/i)).toBeInTheDocument();
});

test('openLeitnerCard pendingSurface renders LeitnerSurface', () => {
  render(
    <SurfaceFrame
      pendingSurface={{ tool: 'openLeitnerCard', args: { learningPointId: 1 } }}
      onSubmit={jest.fn()}
    />
  );
  expect(screen.getByText(/Loading card #1/i)).toBeInTheDocument();
});

test('unknown surface tool: shows error', () => {
  render(
    <SurfaceFrame pendingSurface={{ tool: 'doesNotExist', args: {} }} onSubmit={jest.fn()} />
  );
  expect(screen.getByText(/unknown surface/i)).toBeInTheDocument();
});

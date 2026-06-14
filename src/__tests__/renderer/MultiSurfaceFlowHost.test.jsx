import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import triggerBus from '../../renderer/brain/triggerBus';
import MultiSurfaceFlowHost from '../../renderer/components/brainShell/MultiSurfaceFlowHost';

const makeProposal = (steps, over = {}) => ({
  id: 'flow-1',
  source: 'phase-7-quest',
  unit: 'multi-surface-flow',
  surfaceTarget: { kind: 'flow', steps },
  priority: 'high',
  freshness: 60_000,
  emittedAt: Date.now(),
  queuedAt: Date.now(),
  status: 'queued',
  payload: { title: 'German B2 quest', steps },
  ...over,
});

// LocationProbe records the current pathname so tests can assert navigation.
function LocationProbe({ onChange }) {
  const location = useLocation();
  React.useEffect(() => {
    onChange(location.pathname);
  }, [location.pathname, onChange]);
  return null;
}

beforeEach(() => {
  triggerBus._resetForTests();
  window.electron = {
    ipcRenderer: {
      on: () => {},
      removeListener: () => {},
      invoke: jest.fn().mockResolvedValue({ ok: true }),
    },
  };
});

afterEach(() => {
  delete window.electron;
});

describe('MultiSurfaceFlowHost', () => {
  test('navigates to first step view on mount', () => {
    const seen = [];
    const proposal = makeProposal([
      { view: 'reading', payload: { label: 'Read chapter 2' } },
      { view: 'vocabulary', payload: { label: 'Drill 5 words' } },
    ]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <LocationProbe onChange={(p) => seen.push(p)} />
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/reading" element={<div>reading view</div>} />
          <Route path="/vocabulary" element={<div>vocab view</div>} />
        </Routes>
        <MultiSurfaceFlowHost proposal={proposal} />
      </MemoryRouter>,
    );
    expect(seen).toContain('/reading');
    expect(screen.getByText(/German B2 quest/)).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 2/)).toBeInTheDocument();
  });

  test('Next advances step and navigates to next view', () => {
    const seen = [];
    const proposal = makeProposal([
      { view: 'reading' },
      { view: 'vocabulary' },
    ]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <LocationProbe onChange={(p) => seen.push(p)} />
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/reading" element={<div>reading view</div>} />
          <Route path="/vocabulary" element={<div>vocab view</div>} />
        </Routes>
        <MultiSurfaceFlowHost proposal={proposal} />
      </MemoryRouter>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    expect(seen).toContain('/vocabulary');
    expect(screen.getByText(/step 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  test('Done at last step emits done + completeActive', () => {
    const onStepResult = jest.fn();
    triggerBus.completeActive = jest.fn();
    const proposal = makeProposal([{ view: 'reading' }]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/reading" element={<div>reading view</div>} />
        </Routes>
        <MultiSurfaceFlowHost
          proposal={proposal}
          onStepResult={onStepResult}
        />
      </MemoryRouter>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /done/i }));
    });
    const kinds = onStepResult.mock.calls.map((c) => c[0].kind);
    expect(kinds).toContain('next');
    expect(kinds).toContain('done');
    expect(triggerBus.completeActive).toHaveBeenCalled();
  });

  test('Pause emits pause + lifts strip via completeActive', () => {
    const onStepResult = jest.fn();
    triggerBus.completeActive = jest.fn();
    const proposal = makeProposal([{ view: 'reading' }, { view: 'vocabulary' }]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/reading" element={<div>reading view</div>} />
          <Route path="/vocabulary" element={<div>vocab view</div>} />
        </Routes>
        <MultiSurfaceFlowHost
          proposal={proposal}
          onStepResult={onStepResult}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onStepResult).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pause', step: 0 }),
    );
    expect(triggerBus.completeActive).toHaveBeenCalled();
  });

  test('Abort emits abort + dismiss + completeActive', () => {
    const onStepResult = jest.fn();
    triggerBus.dismiss = jest.fn();
    triggerBus.completeActive = jest.fn();
    const proposal = makeProposal([{ view: 'reading' }]);
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/reading" element={<div>reading view</div>} />
        </Routes>
        <MultiSurfaceFlowHost
          proposal={proposal}
          onStepResult={onStepResult}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /abort/i }));
    expect(triggerBus.dismiss).toHaveBeenCalledWith('flow-1');
    expect(triggerBus.completeActive).toHaveBeenCalled();
  });
});

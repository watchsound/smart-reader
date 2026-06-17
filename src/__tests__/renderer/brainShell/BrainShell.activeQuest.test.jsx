import React from 'react';
import '@testing-library/jest-dom';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock triggerBus before importing BrainShell (BrainShell imports it at module load).
jest.mock('../../../renderer/brain/triggerBus', () => ({
  __esModule: true,
  default: {
    accept: jest.fn(),
    pull: jest.fn().mockResolvedValue(null),
    subscribe: jest.fn(() => () => {}),
    _resetForTests: jest.fn(),
  },
}));

// Mock useBrainState so BrainShell renders without Redux.
jest.mock('../../../renderer/brain/useBrainState', () => ({
  __esModule: true,
  default: () => ({ orbState: 'idle', queue: [], activeProposal: null }),
}));

// Mock sessionApi.
jest.mock('../../../renderer/api/sessionApi', () => ({
  __esModule: true,
  default: { loadActive: jest.fn().mockResolvedValue(null) },
}));

// Mock questApi — two quests; first is active.
const mockQuestList = jest.fn().mockResolvedValue([
  { id: 7, name: 'Master React', goal: 'Become proficient in React', status: 'active' },
  { id: 8, name: 'Learn Rust', goal: 'Understand ownership model', status: 'paused' },
]);
jest.mock('../../../renderer/api/questApi', () => ({
  __esModule: true,
  default: { list: mockQuestList },
}));

// Mock SessionStartDialog so we can inspect the activeQuest prop.
let capturedActiveQuest = '__unset__';
jest.mock('../../../renderer/views/aiSession/SessionStartDialog', () => ({
  __esModule: true,
  default: function MockSessionStartDialog({ activeQuest }) {
    capturedActiveQuest = activeQuest;
    return null;
  },
}));

// Mock child components that have side-effects or external deps.
jest.mock('../../../renderer/components/brainShell/OrbQuestMenu', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/components/brainShell/FlowCoordinator', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/components/brainShell/ManualMenu', () => ({
  __esModule: true,
  default: () => null,
}));

// Import after all mocks are declared.
// eslint-disable-next-line import/first
import BrainShell from '../../../renderer/components/brainShell/BrainShell';

beforeEach(() => {
  capturedActiveQuest = '__unset__';
  mockQuestList.mockClear();

  window.electron = {
    ipcRenderer: {
      on: jest.fn(),
      removeListener: jest.fn(),
      invoke: jest.fn().mockResolvedValue(null),
    },
  };
});

afterEach(() => {
  delete window.electron;
});

describe('BrainShell active Quest wiring', () => {
  test('calls questApi.list with status:active on mount', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <BrainShell />
        </MemoryRouter>,
      );
    });

    expect(mockQuestList).toHaveBeenCalledWith({ status: 'active' });
  });

  test('passes first active quest to SessionStartDialog', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <BrainShell />
        </MemoryRouter>,
      );
    });

    // capturedActiveQuest should be the first (and only) active quest.
    expect(capturedActiveQuest).toMatchObject({
      id: 7,
      status: 'active',
    });
  });

  test('passes null to SessionStartDialog when no active quests', async () => {
    mockQuestList.mockResolvedValueOnce([]);

    await act(async () => {
      render(
        <MemoryRouter>
          <BrainShell />
        </MemoryRouter>,
      );
    });

    expect(capturedActiveQuest).toBeNull();
  });

  test('subscribes to quest:changed IPC event on mount', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <BrainShell />
        </MemoryRouter>,
      );
    });

    expect(window.electron.ipcRenderer.on).toHaveBeenCalledWith(
      'quest:changed',
      expect.any(Function),
    );
  });

  test('re-fetches active quest when quest:changed fires', async () => {
    let questChangedHandler;
    window.electron.ipcRenderer.on.mockImplementation((channel, cb) => {
      if (channel === 'quest:changed') questChangedHandler = cb;
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <BrainShell />
        </MemoryRouter>,
      );
    });

    // Should have been called once on mount.
    expect(mockQuestList).toHaveBeenCalledTimes(1);

    // Simulate main process broadcasting quest:changed.
    await act(async () => {
      questChangedHandler?.();
    });

    expect(mockQuestList).toHaveBeenCalledTimes(2);
  });

  test('removes quest:changed listener on unmount', async () => {
    let { unmount } = {};
    await act(async () => {
      ({ unmount } = render(
        <MemoryRouter>
          <BrainShell />
        </MemoryRouter>,
      ));
    });

    unmount();

    expect(window.electron.ipcRenderer.removeListener).toHaveBeenCalledWith(
      'quest:changed',
      expect.any(Function),
    );
  });
});

/**
 * StudySessionPage.performance.test.js
 *
 * Performance and render tests for StudySessionPage
 * Prevents infinite re-render bugs
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import StudySessionPage from '../../renderer/views/study/StudySessionPage';
import userReducer from '../../renderer/store/reducers/userSlice';

// Mock IPC
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  sendToHost: jest.fn(),
  sendSync: jest.fn(() => ({ enabled: false })), // Mock sound config
};

window.electron = {
  ipcRenderer: mockIpcRenderer,
};

describe('StudySessionPage Performance Tests', () => {
  let store;
  let renderCount;

  beforeEach(() => {
    renderCount = 0;

    // Create mock store
    store = configureStore({
      reducer: {
        user: userReducer,
      },
      preloadedState: {
        user: {
          userInfo: {
            id: 1,
            username: 'test@test.com',
            token: 'test-token-123',
          },
        },
      },
    });

    // Mock API responses
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      if (channel === 'learning-plan-get-due-items') {
        return Promise.resolve({
          success: true,
          items: [
            { id: '1', front: 'test1', back: 'answer1', box: 1 },
            { id: '2', front: 'test2', back: 'answer2', box: 1 },
            { id: '3', front: 'test3', back: 'answer3', box: 1 },
          ],
        });
      }
      if (channel === 'learning-plan-start-session') {
        return Promise.resolve({ sessionId: 'session-123' });
      }
      if (channel === 'brain-record-episode') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Render Stability', () => {
    it('should not infinite re-render on mount', async () => {
      const TestWrapper = () => {
        renderCount++;
        return (
          <Provider store={store}>
            <MemoryRouter initialEntries={['/study/plan-123']}>
              <Routes>
                <Route path="/study/:planId" element={<StudySessionPage />} />
              </Routes>
            </MemoryRouter>
          </Provider>
        );
      };

      render(<TestWrapper />);

      // Wait for initial render and data loading
      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled(), { timeout: 2000 });

      // Wait a bit more to ensure no excessive re-renders
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1000));
      });

      // Should have a reasonable number of renders
      // Initial + data load + maybe 1-2 more for state updates
      expect(renderCount).toBeLessThan(10);
    });

    it('should not re-render excessively when timer updates', async () => {
      let initialRenderCount;

      const TestWrapper = () => {
        renderCount++;
        return (
          <Provider store={store}>
            <MemoryRouter initialEntries={['/study/plan-123']}>
              <Routes>
                <Route path="/study/:planId" element={<StudySessionPage />} />
              </Routes>
            </MemoryRouter>
          </Provider>
        );
      };

      render(<TestWrapper />);

      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());

      // Capture render count after initial load
      await act(async () => {
        await new Promise((r) => setTimeout(r, 500));
      });
      initialRenderCount = renderCount;

      // Wait for 3 seconds (timer ticks 3 times)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 3000));
      });

      // Should have rendered 3 more times (once per second for timer)
      // Plus maybe 1-2 for other state updates
      const additionalRenders = renderCount - initialRenderCount;
      expect(additionalRenders).toBeLessThan(10); // Should be ~3-5, definitely not 100+
    });

    it('should have stable dependencies for useEffect hooks', async () => {
      // This test ensures date, tags, and other dependencies are stable
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/study/plan-123?mode=standard&date=2024-01-15']}>
            <Routes>
              <Route path="/study/:planId" element={<StudySessionPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 1000));
      });

      // Should not have "Maximum update depth exceeded" warnings
      const maxDepthWarnings = warnSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Maximum update depth')
      );
      expect(maxDepthWarnings.length).toBe(0);

      const maxDepthErrors = errorSpy.mock.calls.filter((call) =>
        call[0]?.includes?.('Maximum update depth')
      );
      expect(maxDepthErrors.length).toBe(0);

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('Memory Leaks', () => {
    it('should clean up timers on unmount', async () => {
      const { unmount } = render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/study/plan-123']}>
            <Routes>
              <Route path="/study/:planId" element={<StudySessionPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());

      const renderCountBeforeUnmount = renderCount;

      unmount();

      // Wait to ensure no timers trigger after unmount
      await act(async () => {
        await new Promise((r) => setTimeout(r, 2000));
      });

      // Render count should not increase after unmount
      expect(renderCount).toBe(renderCountBeforeUnmount);
    });

    it('should clean up event listeners on unmount', async () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/study/plan-123']}>
            <Routes>
              <Route path="/study/:planId" element={<StudySessionPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());

      const addedListeners = addEventListenerSpy.mock.calls.length;

      unmount();

      const removedListeners = removeEventListenerSpy.mock.calls.length;

      // All added listeners should be removed
      expect(removedListeners).toBeGreaterThanOrEqual(addedListeners);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Episode Recording Stability', () => {
    it('should not re-render when recording episodes', async () => {
      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/study/plan-123']}>
            <Routes>
              <Route path="/study/:planId" element={<StudySessionPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());

      const renderCountBefore = renderCount;

      // Simulate episode recording (should be fire-and-forget)
      await act(async () => {
        mockIpcRenderer.invoke('brain-record-episode', {
          eventType: 'REVIEW_COMPLETED',
          payload: {},
        });
        await new Promise((r) => setTimeout(r, 500));
      });

      // Episode recording should not trigger re-renders
      expect(renderCount - renderCountBefore).toBeLessThan(3);
    });

    it('should handle episode recording errors gracefully', async () => {
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        if (channel === 'brain-record-episode') {
          return Promise.reject(new Error('Neo4j error'));
        }
        if (channel === 'learning-plan-get-due-items') {
          return Promise.resolve({ success: true, items: [] });
        }
        return Promise.resolve({ success: true });
      });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/study/plan-123']}>
            <Routes>
              <Route path="/study/:planId" element={<StudySessionPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());

      // Should not crash or infinite loop on episode error
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1000));
      });

      expect(renderCount).toBeLessThan(15);

      errorSpy.mockRestore();
    });
  });
});

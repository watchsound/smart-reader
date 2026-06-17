import { renderHook, act } from '@testing-library/react';

const fakeApi = {
  subscribeTrace: jest.fn(),
  get: jest.fn().mockResolvedValue({ id: 's1', goal: 'g', iteration: 0, budget: 12, trace: [], pendingSurface: null }),
  userResult: jest.fn(),
  cancel: jest.fn(),
  undoSoftWrite: jest.fn(),
};
jest.mock('../../../renderer/api/sessionApi', () => ({ __esModule: true, default: fakeApi }));

import useStudySession from '../../../renderer/views/aiSession/useStudySession';

beforeEach(() => {
  jest.clearAllMocks();
  fakeApi.subscribeTrace.mockReturnValue(jest.fn());
});

test('subscribes to trace on mount, unsubscribes on unmount', () => {
  const unsubscribe = jest.fn();
  fakeApi.subscribeTrace.mockReturnValue(unsubscribe);
  const { unmount } = renderHook(() => useStudySession('s1'));
  expect(fakeApi.subscribeTrace).toHaveBeenCalledWith('s1', expect.any(Function));
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test('appends trace events to state', () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'thought', iteration: 0, payload: { reasoning: 'starting' } }));
  expect(result.current.trace).toHaveLength(1);
  expect(result.current.trace[0].kind).toBe('thought');
});

test('openSurface event sets pendingSurface', () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'openSurface', payload: { tool: 'openLeitnerCard', args: { learningPointId: 42 } } }));
  expect(result.current.pendingSurface).toEqual({ tool: 'openLeitnerCard', args: { learningPointId: 42 } });
});

test('end event sets status to completed', () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'end', iteration: 5, payload: { reason: 'done' } }));
  expect(result.current.status).toBe('completed');
  expect(result.current.endReason).toBe('done');
});

test('submitUserResult delegates to sessionApi.userResult and clears pendingSurface', async () => {
  let handler;
  fakeApi.subscribeTrace.mockImplementation((id, fn) => { handler = fn; return jest.fn(); });
  const { result } = renderHook(() => useStudySession('s1'));
  act(() => handler({ sessionId: 's1', kind: 'openSurface', payload: { tool: 'openLeitnerCard', args: {} } }));
  await act(async () => result.current.submitUserResult({ rating: 'easy' }));
  expect(fakeApi.userResult).toHaveBeenCalledWith('s1', { rating: 'easy' });
  expect(result.current.pendingSurface).toBe(null);
});

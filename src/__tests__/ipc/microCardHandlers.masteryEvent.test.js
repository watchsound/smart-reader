/**
 * microCardHandlers — mastery_event instrumentation test.
 *
 * Verifies that Phase 13 attribution: on a successful microcard-accept,
 * a mastery_event row is written via masteryEventRecorder with
 * featureSurface='reading-microcard' and proximateCallId=null.
 *
 * @jest-environment node
 */

// ── ipcMain mock (collect handlers so we can invoke them directly) ──────────
const mockHandlers = {};
const mockIpcMain = {
  handle: jest.fn((channel, fn) => {
    mockHandlers[channel] = fn;
  }),
  on: jest.fn((channel, fn) => {
    mockHandlers[channel] = fn;
  }),
};
jest.mock('electron', () => ({ ipcMain: mockIpcMain }));

// ── microCardProposer mock ────────────────────────────────────────────────────
jest.mock('../../main/utils/MicroCardProposer', () => ({
  __esModule: true,
  default: {
    proposeFromParagraph: jest.fn(),
    freezeChapter: jest.fn(),
    resetState: jest.fn(),
    getStateSnapshot: jest.fn(() => ({})),
  },
}));

// ── LearningPointService mock ─────────────────────────────────────────────────
const mockCreateLearningPoint = jest.fn();
const mockUpdateLearningPoint = jest.fn();
jest.mock('../../main/utils/LearningPointService', () => ({
  learningPointService: {
    createLearningPoint: (...args) => mockCreateLearningPoint(...args),
    updateLearningPoint: (...args) => mockUpdateLearningPoint(...args),
  },
}));

// ── extractors mock ───────────────────────────────────────────────────────────
jest.mock('../../main/utils/extractors', () => ({
  extractForDomain: jest.fn().mockResolvedValue({ source: 'static', extras: {} }),
}));

// ── LearningPointDomains mock ─────────────────────────────────────────────────
jest.mock('../../commons/model/LearningPointDomains', () => ({
  LIVE_WRITABLE_DOMAINS: ['vocabulary', 'knowledge', 'math', 'programming'],
}));

// ── dbManager mock — getUserIdFromToken ────────────────────────────────────────
const mockGetUserIdFromToken = jest.fn((token) => (token === 'tok-1' ? 1 : -1));
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {},
  getUserIdFromToken: (token) => mockGetUserIdFromToken(token),
}));

// ── masteryEventRecorder mock ─────────────────────────────────────────────────
const mockRecordWithProximateCall = jest.fn();
jest.mock('../../main/db/masteryEventRecorder', () => ({
  recordWithProximateCall: (...args) => mockRecordWithProximateCall(...args),
}));

// Load handler module AFTER all mocks are in place.
const { registerMicroCardHandlers } = require('../../main/ipc/microCardHandlers');

const VALID_PROPOSAL = {
  front: 'What is a monad?',
  back: 'A design pattern for composing effectful computations via unit + bind.',
  domain: 'programming',
  conceptName: 'monad',
  confidence: 0.85,
  proposalId: 'prop-test-1',
};

describe('microcard-accept — Phase 13 mastery_event instrumentation', () => {
  // Register once — the module-level `registered` guard prevents double-registration.
  beforeAll(() => {
    registerMicroCardHandlers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('on successful accept, writes mastery_event with featureSurface=reading-microcard and null proximateCallId', async () => {
    mockCreateLearningPoint.mockResolvedValue({ id: 'lp-new-1', domainType: 'programming', sourceType: 'book' });

    const result = await mockHandlers['microcard-accept']({}, {
      proposal: VALID_PROPOSAL,
      mode: 'accept',
      token: 'tok-1',
      bookId: 42,
    });

    expect(result.success).toBe(true);
    expect(result.learningPointId).toBe('lp-new-1');

    expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.surface).toBe('reading-microcard');
    expect(ev.learningPointId).toBe('lp-new-1');
    expect(ev.userId).toBe(1);
    expect(ev.eventType).toBe('mastery_change');
    expect(ev.newBox).toBe(1);
    expect(ev.newMastery).toBe(0);
    expect(ev.prevBox).toBeNull();
    expect(ev.prevMastery).toBeNull();
    expect(ev.source).toBe('microcard-accept');
    expect(ev.traceId).toBeNull();
    // proximateCallId is resolved from traceId:null inside masteryEventRecorder —
    // the mock captures the args before the lookup, so we verify traceId is null.
  });

  it('does NOT write mastery_event when createLearningPoint fails', async () => {
    mockCreateLearningPoint.mockResolvedValue({ error: 'DB constraint violation' });

    const result = await mockHandlers['microcard-accept']({}, {
      proposal: VALID_PROPOSAL,
      mode: 'accept',
      token: 'tok-1',
      bookId: 42,
    });

    expect(result.success).toBe(false);
    expect(mockRecordWithProximateCall).not.toHaveBeenCalled();
  });

  it('does NOT write mastery_event when proposal is invalid', async () => {
    const result = await mockHandlers['microcard-accept']({}, {
      proposal: { front: '', back: '' },
      token: 'tok-1',
    });

    expect(result.success).toBe(false);
    expect(mockRecordWithProximateCall).not.toHaveBeenCalled();
  });

  it('accept flow still succeeds even if masteryEventRecorder throws', async () => {
    mockCreateLearningPoint.mockResolvedValue({ id: 'lp-new-2', domainType: 'knowledge', sourceType: 'book' });
    mockRecordWithProximateCall.mockImplementationOnce(() => {
      throw new Error('recorder blew up');
    });

    // Should NOT reject — recorder errors are swallowed.
    const result = await mockHandlers['microcard-accept']({}, {
      proposal: VALID_PROPOSAL,
      mode: 'accept',
      token: 'tok-1',
      bookId: 5,
    });
    expect(result.success).toBe(true);
    expect(result.learningPointId).toBe('lp-new-2');
  });

  it('on acknowledge mode, mastery_event is still emitted (LP creation succeeds)', async () => {
    mockCreateLearningPoint.mockResolvedValue({ id: 'lp-ack-1', domainType: 'knowledge', sourceType: 'book' });
    mockUpdateLearningPoint.mockResolvedValue({ id: 'lp-ack-1', box: 4 });

    const result = await mockHandlers['microcard-accept']({}, {
      proposal: VALID_PROPOSAL,
      mode: 'acknowledge',
      token: 'tok-1',
      bookId: 7,
    });

    expect(result.success).toBe(true);
    expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.surface).toBe('reading-microcard');
    expect(ev.learningPointId).toBe('lp-ack-1');
    // newBox is 1 — the event reflects entry into the system, not the subsequent
    // box-bump for acknowledge mode (that's a separate update, not a mastery_event).
    expect(ev.newBox).toBe(1);
  });
});

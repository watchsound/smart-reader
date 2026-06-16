/**
 * VocabularyManager dual-write + backfill — unit tests with mocked db.
 *
 * Contract: every successful createVocabulary() must mirror the new word
 * into the learning_point table (domain_type='vocabulary', source_type='vocabulary',
 * source_id=String(vocab.id)) so the Forgetting-Fog / Knowledge-Accretion
 * features have live SRS state to render. backfillVocabularyToLearningPoints()
 * is the catch-up path for rows added before the dual-write landed.
 *
 * Mirror call IS the side-effect contract — asserting on the createLearningPoint
 * mock is allowed by the TDD skill's "side effect IS the contract" carve-out.
 *
 * @jest-environment node
 */

// --- Mock dbManager -----------------------------------------------------
// `sqlBehavior` is a per-test override: keys are SQL substrings, values
// are partial stmt overrides (run/get/all/iterate). Substring match keeps
// tests robust to whitespace / inline comments in real SQL strings.
let sqlBehavior;

const defaultStmt = () => ({
  get: jest.fn(() => undefined),
  run: jest.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
  all: jest.fn(() => []),
  // eslint-disable-next-line no-empty-function
  iterate: jest.fn(function* iter() {}),
  // bind is a chainable no-op — VocabularyManager uses prepare().bind(...).run()
  bind() {
    return this;
  },
});

const mockDb = {
  prepare: jest.fn((sql) => {
    const stmt = defaultStmt();
    if (sqlBehavior) {
      const key = Object.keys(sqlBehavior).find((k) => sql.includes(k));
      if (key) Object.assign(stmt, sqlBehavior[key]);
    }
    return stmt;
  }),
  exec: jest.fn(),
};

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: mockDb,
  getUserIdFromToken: jest.fn(() => 1),
  addUserIdCreatedAt: jest.fn((obj, userId) => {
    obj.userId = userId;
    obj.createdAt = '2026-06-16';
    return obj;
  }),
  assertUpdateField: jest.fn(() => {}),
}));

// --- Mock LeitnerItemManager -------------------------------------------
// Always returns a valid leitner row; vocab path needs leitnerItemId > 0.
const mockCreateLeitnerItem = jest.fn(() => ({
  id: 99,
  box: 1,
  type: 0,
  skips: 0,
  flips: 0,
  nextReview: '',
  fullyLearned: 0,
  score: 0,
}));
const mockGetLeitnerItemById = jest.fn((id) =>
  id
    ? {
        id,
        box: 1,
        type: 0,
        skips: 0,
        flips: 0,
        nextReview: '',
        fullyLearned: 0,
        score: 0,
      }
    : null,
);

jest.mock('../../main/db/LeitnerItemManager', () => ({
  __esModule: true,
  createLeitnerItem: mockCreateLeitnerItem,
  getLeitnerItemById: mockGetLeitnerItemById,
}));

// --- Mock LearningPointService -----------------------------------------
// Read path goes through LearningPointService → graphInterface → Kuzu.
// Writes via LearningPointManager.createLearningPoint (SQLite) are NEVER
// seen by lp-get-all. The mirror MUST target the service layer.
const mockCreateLearningPoint = jest.fn(() =>
  Promise.resolve({ id: 'lp_uuid_1', title: 'serendipity' }),
);
const mockGetBySource = jest.fn(() => Promise.resolve([]));

jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  learningPointService: {
    createLearningPoint: mockCreateLearningPoint,
    getBySource: mockGetBySource,
  },
}));

// --- Subject under test (require AFTER jest.mock calls) -----------------
const {
  createVocabulary,
  backfillVocabularyToLearningPoints,
} = require('../../main/db/VocabularyManager');

beforeEach(() => {
  jest.clearAllMocks();
  sqlBehavior = null;
});

describe('createVocabulary — dual-write to learning_point', () => {
  it('mirrors a new vocab into learning_point with the canonical payload', () => {
    sqlBehavior = {
      'INSERT INTO vocabulary': {
        run: jest.fn(() => ({ changes: 1, lastInsertRowid: 42 })),
      },
      // getVocabularyById hits this after the INSERT to assemble the return obj.
      'SELECT * FROM vocabulary WHERE id = ?': {
        get: jest.fn(() => ({
          id: 42,
          word: 'serendipity',
          definition: 'good fortune',
          related_words: 'luck',
          example: 'a serendipitous meeting',
          set_id: 0,
          leitner_item_id: 99,
          created_at: '2026-06-16',
          user_id: 1,
        })),
      },
    };

    const result = createVocabulary(
      {
        word: 'serendipity',
        definition: 'good fortune',
        relatedWords: 'luck',
        example: 'a serendipitous meeting',
      },
      'tok',
    );

    expect(result).toBeTruthy();
    expect(result.id).toBe(42);

    // The contract: a single learning_point mirror is created with the
    // canonical vocab payload. sourceId is String(vocab.id) so backfill
    // dedup via getBySource('vocabulary', String(id), token) is O(1).
    expect(mockCreateLearningPoint).toHaveBeenCalledTimes(1);
    expect(mockCreateLearningPoint).toHaveBeenCalledWith(
      {
        title: 'serendipity',
        front: { text: 'serendipity' },
        back: { text: 'good fortune' },
        itemType: 'word',
        domainType: 'vocabulary',
        sourceType: 'vocabulary',
        sourceId: '42',
        extras: {
          relatedWords: 'luck',
          example: 'a serendipitous meeting',
        },
      },
      'tok',
    );
  });

  it('returns the vocab row even when the mirror throws (non-transactional)', () => {
    // The user-facing contract: vocab insert is the source of truth. A
    // learning_point failure must not abort vocab creation — the next
    // backfill catches the miss. Without this guarantee, an LP-service
    // outage would silently break "Add to Vocabulary."
    sqlBehavior = {
      'INSERT INTO vocabulary': {
        run: jest.fn(() => ({ changes: 1, lastInsertRowid: 77 })),
      },
      'SELECT * FROM vocabulary WHERE id = ?': {
        get: jest.fn(() => ({
          id: 77,
          word: 'obstreperous',
          definition: 'noisy and unruly',
          related_words: '',
          example: '',
          set_id: 0,
          leitner_item_id: 99,
          created_at: '2026-06-16',
          user_id: 1,
        })),
      },
    };
    mockCreateLearningPoint.mockImplementationOnce(() => {
      throw new Error('learning_point service offline');
    });

    const result = createVocabulary(
      {
        word: 'obstreperous',
        definition: 'noisy and unruly',
      },
      'tok',
    );

    expect(result).toBeTruthy();
    expect(result.id).toBe(77);
    expect(result.word).toBe('obstreperous');
  });
});

describe('backfillVocabularyToLearningPoints — catch up missed mirrors', () => {
  it('creates a learning_point mirror for every vocab row that lacks one', async () => {
    // Three legacy vocab rows in the table, none yet mirrored
    // (getBySource returns []). After backfill, all three should have
    // a mirror create call; result accounting matches.
    sqlBehavior = {
      'SELECT id, word, definition, related_words, example FROM vocabulary WHERE user_id = ?':
        {
          all: jest.fn(() => [
            {
              id: 1,
              word: 'pellucid',
              definition: 'transparently clear',
              related_words: '',
              example: '',
            },
            {
              id: 2,
              word: 'sonorous',
              definition: 'deep and resonant',
              related_words: '',
              example: '',
            },
            {
              id: 3,
              word: 'gossamer',
              definition: 'light and delicate',
              related_words: '',
              example: '',
            },
          ]),
        },
    };
    mockGetBySource.mockResolvedValue([]); // no existing mirrors

    const result = await backfillVocabularyToLearningPoints('tok');

    expect(result).toEqual({
      scanned: 3,
      created: 3,
      skipped: 0,
      errors: 0,
    });
    expect(mockCreateLearningPoint).toHaveBeenCalledTimes(3);
    // Spot-check that one mirror call carries the canonical payload.
    expect(mockCreateLearningPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'pellucid',
        front: { text: 'pellucid' },
        back: { text: 'transparently clear' },
        domainType: 'vocabulary',
        sourceType: 'vocabulary',
        sourceId: '1',
      }),
      'tok',
    );
  });

  it('skips vocab rows that already have a learning_point mirror (idempotent)', async () => {
    // Two vocab rows: id=10 already has a mirror, id=11 does not.
    // Without dedup, repeated boot-time backfills would create duplicate
    // mirrors per row, eventually polluting the LeitnerSystem with N copies
    // of the same word. Idempotency is the only way the backfill stays safe
    // to run unconditionally on every login/session.
    sqlBehavior = {
      'SELECT id, word, definition, related_words, example FROM vocabulary WHERE user_id = ?':
        {
          all: jest.fn(() => [
            {
              id: 10,
              word: 'alreadyMirrored',
              definition: 'd1',
              related_words: '',
              example: '',
            },
            {
              id: 11,
              word: 'needsMirror',
              definition: 'd2',
              related_words: '',
              example: '',
            },
          ]),
        },
    };
    mockGetBySource.mockImplementation((sourceType, sourceId) => {
      if (sourceType === 'vocabulary' && sourceId === '10') {
        return Promise.resolve([{ id: 'existing-lp-uuid' }]);
      }
      return Promise.resolve([]);
    });

    const result = await backfillVocabularyToLearningPoints('tok');

    expect(result).toEqual({
      scanned: 2,
      created: 1,
      skipped: 1,
      errors: 0,
    });
    expect(mockCreateLearningPoint).toHaveBeenCalledTimes(1);
    expect(mockCreateLearningPoint).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: '11', title: 'needsMirror' }),
      'tok',
    );
  });
});

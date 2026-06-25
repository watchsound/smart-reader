/**
 * NoteJsonManager.addNoteToLeitnerStudy — discriminator + mirror contract.
 *
 * Contract:
 *   - new add               → { ...leitnerItem, wasAlreadyAdded: false }
 *   - already in Leitner    → { ...leitnerItem, wasAlreadyAdded: true }
 *   - any error             → -1
 *
 * Mirror contract: every successful add (new or re-add) must SYNCHRONOUSLY
 * insert a learning_point row with source_type='note', source_id=String(noteId),
 * and next_review = today (so the LeitnerSystem main panel surfaces it
 * for study immediately, not tomorrow). Mirror is idempotent: the existence
 * check via (source_type, source_id) skips a duplicate INSERT.
 *
 * Sync is mandatory: addNoteToLeitnerStudy runs inside an ipcMain.on
 * sendSync handler — the renderer's post-dispatch panel refresh fires
 * the moment the IPC returns, so the row MUST exist by then.
 *
 * @jest-environment node
 */

let sqlBehavior;
let insertedRows;

const defaultStmt = () => ({
  get: jest.fn(() => undefined),
  run: jest.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
  all: jest.fn(() => []),
  // eslint-disable-next-line no-empty-function
  iterate: jest.fn(function* iter() {}),
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
    // Capture INSERTs into learning_point regardless of sqlBehavior so
    // tests can assert on the row shape without per-test wiring.
    if (sql.includes('INSERT INTO learning_point')) {
      const originalRun = stmt.run;
      stmt.run = jest.fn((...args) => {
        insertedRows.push({ sql, args });
        return originalRun(...args);
      });
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
    obj.createdAt = '2026-06-25';
    return obj;
  }),
  assertUpdateField: jest.fn(() => {}),
}));

const mockCreateLeitnerItem = jest.fn(() => ({
  id: 77,
  box: 1,
  type: 1,
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
        box: 2,
        type: 1,
        skips: 1,
        flips: 1,
        nextReview: '2026-06-30',
        fullyLearned: 0,
        score: 10,
      }
    : null,
);

jest.mock('../../main/db/LeitnerItemManager', () => ({
  __esModule: true,
  createLeitnerItem: mockCreateLeitnerItem,
  getLeitnerItemById: mockGetLeitnerItemById,
}));

const { addNoteToLeitnerStudy } = require('../../main/db/NoteJsonManager');

const NOTE_SELECT = 'SELECT * FROM note WHERE id = ?';
const LP_EXISTS_SELECT = 'SELECT id FROM learning_point';

beforeEach(() => {
  jest.clearAllMocks();
  sqlBehavior = null;
  insertedRows = [];
});

describe('addNoteToLeitnerStudy — return discriminator', () => {
  it('tags a fresh add with wasAlreadyAdded: false', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 5,
          data: JSON.stringify({ title: 'hello', cards: [{ text: 'h' }] }),
          leitner_item_id: 0,
          created_at: '2026-06-25',
          user_id: 1,
        })),
      },
    };

    const result = addNoteToLeitnerStudy(5, 'tok');

    expect(result).toMatchObject({ id: 77, wasAlreadyAdded: false });
    expect(mockCreateLeitnerItem).toHaveBeenCalledTimes(1);
  });

  it('tags a re-add with wasAlreadyAdded: true', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 5,
          data: JSON.stringify({ title: 'hello', cards: [{ text: 'h' }] }),
          leitner_item_id: 42,
          created_at: '2026-06-25',
          user_id: 1,
        })),
      },
    };

    const result = addNoteToLeitnerStudy(5, 'tok');

    expect(result).toMatchObject({ id: 42, wasAlreadyAdded: true });
    expect(mockCreateLeitnerItem).not.toHaveBeenCalled();
  });

  it('returns -1 when the note does not exist', () => {
    sqlBehavior = { [NOTE_SELECT]: { get: jest.fn(() => undefined) } };
    expect(addNoteToLeitnerStudy(999, 'tok')).toBe(-1);
  });

  it('returns -1 when createLeitnerItem fails (DB error)', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 5,
          data: JSON.stringify({ title: 'x', cards: [{ text: 'x' }] }),
          leitner_item_id: 0,
          created_at: '2026-06-25',
          user_id: 1,
        })),
      },
    };
    mockCreateLeitnerItem.mockReturnValueOnce(null);
    expect(addNoteToLeitnerStudy(5, 'tok')).toBe(-1);
  });
});

describe('addNoteToLeitnerStudy — learning_point mirror', () => {
  it('synchronously inserts a learning_point row with source_type=note and next_review=today', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 5,
          data: JSON.stringify({
            title: 'What is a closure?',
            cards: [
              { text: 'What is a closure?' },
              { text: 'A function bundled with its lexical scope.' },
            ],
          }),
          leitner_item_id: 0,
          created_at: '2026-06-25',
          user_id: 1,
        })),
      },
      // existence check returns nothing → mirror proceeds
      [LP_EXISTS_SELECT]: { get: jest.fn(() => undefined) },
    };

    // Note: addNoteToLeitnerStudy is SYNC — no await needed.
    addNoteToLeitnerStudy(5, 'tok');

    expect(insertedRows).toHaveLength(1);
    const { args } = insertedRows[0];
    // Schema column order (see mirror code):
    //   0:id 1:userId 2:title 3:front 4:back 5:extras
    //   6:itemType 7:domainType 8:difficulty 9:format
    //   10:tags 11:sourceType 12:sourceId 13:planId 14:bookId
    //   15:box 16:nextReview 17:masteryLevel 18:easeFactor 19:intervalDays
    //   20:status 21:createdAt 22:updatedAt
    expect(args[1]).toBe(1); // userId
    expect(args[2]).toBe('What is a closure?'); // title
    expect(JSON.parse(args[3])).toEqual({ text: 'What is a closure?' }); // front
    expect(JSON.parse(args[4])).toEqual({
      text: 'A function bundled with its lexical scope.',
    }); // back
    expect(args[6]).toBe('concept'); // itemType
    expect(args[7]).toBe('knowledge'); // domainType
    expect(args[11]).toBe('note'); // sourceType
    expect(args[12]).toBe('5'); // sourceId
    expect(args[15]).toBe(1); // box

    // next_review must be today (not today+1) so the row is immediately
    // due in LeitnerSystem.getDueItems (`next_review <= now` filter).
    const today = new Date().toISOString().slice(0, 10);
    expect(args[16].startsWith(today)).toBe(true);

    expect(args[20]).toBe('active'); // status
  });

  it('skips mirror when a note-source learning_point already exists (idempotent)', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 5,
          data: JSON.stringify({ title: 'x', cards: [{ text: 'x' }] }),
          leitner_item_id: 0,
          created_at: '2026-06-25',
          user_id: 1,
        })),
      },
      [LP_EXISTS_SELECT]: { get: jest.fn(() => ({ id: 'lp_existing' })) },
    };

    addNoteToLeitnerStudy(5, 'tok');

    expect(insertedRows).toHaveLength(0);
  });

  it('mirrors on re-add too (backfills notes that pre-date this mirror)', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 7,
          data: JSON.stringify({
            title: 'Old note',
            cards: [{ text: 'Front' }, { text: 'Back' }],
          }),
          leitner_item_id: 42, // already linked → re-add branch
          created_at: '2026-06-20',
          user_id: 1,
        })),
      },
      [LP_EXISTS_SELECT]: { get: jest.fn(() => undefined) },
    };

    const result = addNoteToLeitnerStudy(7, 'tok');

    expect(result).toMatchObject({ id: 42, wasAlreadyAdded: true });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].args[12]).toBe('7'); // source_id
  });

  it('mirror failure does not poison the return value', () => {
    sqlBehavior = {
      [NOTE_SELECT]: {
        get: jest.fn(() => ({
          id: 5,
          data: JSON.stringify({ title: 'x', cards: [{ text: 'x' }] }),
          leitner_item_id: 0,
          created_at: '2026-06-25',
          user_id: 1,
        })),
      },
      [LP_EXISTS_SELECT]: {
        get: jest.fn(() => {
          throw new Error('boom');
        }),
      },
    };

    const result = addNoteToLeitnerStudy(5, 'tok');

    expect(result).toMatchObject({ id: 77, wasAlreadyAdded: false });
    expect(insertedRows).toHaveLength(0);
  });
});

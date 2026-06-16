/**
 * Phase 8 Integration Tests — Spaced Re-reading + Organize + Production loops.
 *
 * Exercises each loop end-to-end against a REAL in-memory SQLite database
 * with the real `learning_point` schema. The bug we hit last week (missing
 * `learning_point` table) was invisible to the unit tests because they
 * mock dbManager; this file deliberately doesn't.
 *
 * What's mocked vs real:
 *   - electron       MOCK (app.getPath, ipcMain.handle stubs)
 *   - dbManager      REAL (better-sqlite3 :memory:)
 *   - LearningPoint  REAL (init runs on import, creates the table)
 *   - Notification   MOCK (captures payloads instead of touching IPC)
 *   - Services       REAL (RereadQueue, MoodBoardOrganizer, ProductionPrompt)
 *   - electron-store MOCK (in-memory key-value)
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test-userData') },
  ipcMain: { handle: jest.fn() },
}));

// In an Electron project, better-sqlite3 is normally compiled against
// Electron's Node ABI (via `npm run rebuild`). Jest runs in system Node
// with a different ABI, so loading the .node binary throws unless someone
// has done `npm rebuild better-sqlite3 --build-from-source` first.
// We probe in a way the jest.mock factory can survive: if the load fails,
// the mock returns a stub and the describe blocks below short-circuit.
let testDB = null;
let sqliteLoadError = null;
try {
  // eslint-disable-next-line global-require
  const Database = require('better-sqlite3');
  testDB = new Database(':memory:');
} catch (err) {
  sqliteLoadError = err;
}

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: testDB || { prepare: () => ({}), exec: () => {} },
  getUserIdFromToken: jest.fn((token) => {
    const sessionInfo = global?.shared?.store?.get?.('session_info');
    return sessionInfo?.token === token ? sessionInfo.id : -1;
  }),
  addUserIdCreatedAt: (obj, userId) => {
    obj.userId = userId;
    obj.createdAt = new Date().toISOString();
    return obj;
  },
  escapeString: (v) => {
    if (typeof v === 'string') return v.replace(/'/g, "''");
    if (typeof v === 'number') return v.toString();
    return v || '';
  },
}));

// Phase 8 services now read learning points via learningPointService.getAll
// (graph backend) after the SQLite → graph migration. To keep this
// integration test exercising the real learning_point schema, project
// the seeded SQLite rows back into the graph-shape items the service
// expects.
jest.mock('../../main/utils/LearningPointService', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(async () => {
      if (!testDB) return { items: [] };
      try {
        const rows = testDB
          .prepare(
            `SELECT id, title, front, back, domain_type AS domainType,
                    source_type AS sourceType, book_id AS bookId,
                    mastery_level AS masteryLevel,
                    review_count AS reviewCount,
                    last_reviewed_at AS lastReviewedAt,
                    created_at AS createdAt
               FROM learning_point
              WHERE user_id = 1 AND status = 'active'`,
          )
          .all();
        const items = rows.map((r) => ({
          ...r,
          // Graph stores sourceId as a stringified bookId for book-sourced
          // learning points; the service derives bookId from this.
          sourceId: r.bookId != null ? String(r.bookId) : null,
          // Graph adapter pre-parses JSON-stringified front/back.
          back: typeof r.back === 'string' ? safeParse(r.back) : r.back,
          front: r.front,
        }));
        return { items };
      } catch (_) {
        return { items: [] };
      }
    }),
  },
}));

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return s;
  }
}

// Capture notifications instead of hitting the renderer IPC bus.
const capturedNotifications = [];
jest.mock('../../main/db/NotificationManager', () => {
  let nextId = 1;
  return {
    createNotification: jest.fn((payload, token) => {
      const notif = { id: `notif_${nextId++}`, token, ...payload };
      capturedNotifications.push(notif);
      return notif;
    }),
    NOTIFICATION_TYPES: {
      PROGRESS: 'progress',
      STUDY_REMINDER: 'study_reminder',
      SYSTEM: 'system',
      STREAK: 'streak',
    },
    NOTIFICATION_PRIORITIES: { LOW: 'low', NORMAL: 'normal', HIGH: 'high' },
  };
});

// If better-sqlite3 didn't load we still want the file to import cleanly
// so Jest reports "skipped" instead of failing the whole suite. Wrap the
// SUT requires + lifecycle so they only fire when the DB is usable.
const describeIfDB = testDB ? describe : describe.skip;

let db;
let RereadQueueService;
let MoodBoardOrganizerService;
let ProductionPromptService;
if (testDB) {
  // Loading the manager runs initLearningPointTable() on the test DB.
  // eslint-disable-next-line global-require
  require('../../main/db/LearningPointManager');
  // eslint-disable-next-line global-require
  ({ default: db } = require('../../main/db/dbManager'));
  // eslint-disable-next-line global-require
  RereadQueueService = require('../../main/utils/RereadQueueService').default;
  // eslint-disable-next-line global-require
  MoodBoardOrganizerService = require('../../main/brain/MoodBoardOrganizerService');
  // eslint-disable-next-line global-require
  ProductionPromptService = require('../../main/brain/ProductionPromptService');
}

if (!testDB) {
  // eslint-disable-next-line no-console
  console.warn(
    `[phase8.integration] better-sqlite3 unavailable (${
      sqliteLoadError?.message || 'unknown'
    }); skipping all suites. ` +
      'Run `npm rebuild better-sqlite3 --build-from-source` to enable, ' +
      'then `npm run rebuild` to restore the Electron binary.',
  );
}

const SESSION_TOKEN = 'test-session-token';
const USER_ID = 1;

// =============================================================================
// Helpers
// =============================================================================

function makeStore() {
  const data = {};
  return {
    get: jest.fn((key, fallback) =>
      data[key] === undefined ? fallback : data[key],
    ),
    set: jest.fn((key, value) => {
      data[key] = value;
    }),
    _data: data,
  };
}

function seedLearningPoint(overrides = {}) {
  const id = overrides.id || `lp_${Math.random().toString(36).substr(2, 8)}`;
  const now = overrides.createdAt || new Date().toISOString();
  db.prepare(
    `
    INSERT INTO learning_point (
      id, user_id, title, front, back, status,
      domain_type, item_type, source_type, book_id,
      mastery_level, review_count, box, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    USER_ID,
    overrides.title || `concept-${id.slice(-4)}`,
    overrides.front || 'What is it?',
    overrides.back ||
      JSON.stringify({ text: 'A substantive explanation worth eliciting.' }),
    overrides.status || 'active',
    overrides.domainType || 'vocabulary',
    overrides.itemType || 'concept',
    overrides.sourceType || 'book',
    overrides.bookId == null ? 1 : overrides.bookId,
    overrides.masteryLevel || 0,
    overrides.reviewCount || 0,
    overrides.box || 1,
    now,
  );
  return id;
}

function ensureBookTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS book (
      id INTEGER PRIMARY KEY,
      name TEXT
    )
  `);
  db.prepare('INSERT OR IGNORE INTO book (id, name) VALUES (?, ?)').run(
    1,
    'Test Book',
  );
}

// =============================================================================
// Lifecycle
// =============================================================================

beforeAll(() => {
  if (!testDB) return;
  // Brain services look up the real session token via global.shared.store.
  global.shared = {
    store: {
      get: jest.fn((key) => {
        if (key === 'session_info') {
          return {
            id: USER_ID,
            token: SESSION_TOKEN,
            username: 'test',
            email: 'test@test.com',
          };
        }
        return null;
      }),
      set: jest.fn(),
    },
  };
  ensureBookTable();
});

beforeEach(() => {
  if (!testDB) return;
  capturedNotifications.length = 0;
  db.prepare('DELETE FROM learning_point').run();
});

// =============================================================================
// Happy-path walkthroughs — one per loop. The narrower per-rule edge cases
// (dedup, MIN_MASTERY, missing book, etc.) are covered in the per-service
// unit tests; this file confirms the loop actually runs end-to-end against
// real schema + service composition.
// =============================================================================

describeIfDB('Phase 8 integration — spaced re-reading happy path', () => {
  it('schedule -> getPending shows the item -> complete removes it', () => {
    const service = new RereadQueueService(makeStore());

    const scheduled = service.schedule({
      userId: USER_ID,
      bookId: 1,
      bookTitle: 'Test Book',
      chapterId: 'ch_1',
      chapterName: 'Chapter 1',
      gaps: ['concept-a', 'concept-b'],
      score: 35,
    });
    expect(scheduled.id).toBeTruthy();
    expect(scheduled.completedAt).toBeNull();

    const pending = service.getPending(USER_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0].chapterName).toBe('Chapter 1');
    expect(pending[0].gaps).toEqual(['concept-a', 'concept-b']);

    const completed = service.complete(scheduled.id);
    expect(completed.completedAt).toBeTruthy();
    expect(service.getPending(USER_ID)).toHaveLength(0);
  });
});

describeIfDB('Phase 8 integration — organize loop happy path', () => {
  it('cluster of 6 learning points -> notification fires -> episode records', async () => {
    for (let i = 0; i < 6; i += 1) {
      seedLearningPoint({ domainType: 'vocabulary', bookId: 1 });
    }

    const collector = { record: jest.fn() };
    const service = new MoodBoardOrganizerService({
      store: makeStore(),
      episodeCollector: collector,
    });

    const result = await service.suggestOrganize(USER_ID, SESSION_TOKEN);

    expect(result.created).toBe(1);
    expect(capturedNotifications).toHaveLength(1);
    expect(capturedNotifications[0].title).toContain('6 new vocabulary');
    expect(capturedNotifications[0].actionUrl).toBe(
      '/moodBoard?organize=1%3Avocabulary',
    );
    expect(collector.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ORGANIZE_SUGGESTED' }),
    );
  });
});

describeIfDB('Phase 8 integration — production loop happy path', () => {
  it('high-mastery point -> prompt notification fires -> episode records', async () => {
    seedLearningPoint({
      title: 'serendipity',
      masteryLevel: 80,
      reviewCount: 5,
      back: JSON.stringify({
        text: 'a happy accident or pleasant surprise found by chance',
      }),
    });

    const collector = { record: jest.fn() };
    const service = new ProductionPromptService({
      store: makeStore(),
      episodeCollector: collector,
    });

    const result = await service.schedulePrompt(USER_ID, SESSION_TOKEN);

    expect(result.created).toBe(1);
    expect(capturedNotifications).toHaveLength(1);
    expect(capturedNotifications[0].title).toContain('serendipity');
    expect(capturedNotifications[0].actionUrl).toMatch(
      /^\/knowledge\?produce=/,
    );
    expect(collector.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PRODUCTION_PROMPTED' }),
    );
  });
});

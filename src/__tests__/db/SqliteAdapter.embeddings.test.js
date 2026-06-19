/**
 * SqliteAdapter — Pass 2 embedding + chunk operations.
 *
 * Drives the adapter against a real :memory: better-sqlite3 instance with
 * the graph_embedding / graph_chunk tables created from db.sql. The cosine
 * similarity path runs JS-side so these tests cover the BLOB pack/unpack
 * round-trip and the JS-side ranking + filtering, not just SQL plumbing.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  getUserIdFromToken: (token) => (token === 'u1' ? 1 : token === 'u2' ? 2 : -1),
}));

const sqliteAdapter = require('../../main/utils/SqliteAdapter');

function reset() {
  testDb = new Database(':memory:');
  // Load the full schema; same pattern as the spine tests. Filtering out
  // sqlite_sequence references because better-sqlite3 errors on those.
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  testDb.exec(sql);
  // Adapter reads getDb() lazily, so just toggle the connected flag.
  sqliteAdapter.isConnected = true;
}

beforeEach(reset);
afterEach(() => testDb.close());

// Unit vector helper so cosineSimilarity returns deterministic values.
function unit(...components) {
  const len = Math.hypot(...components);
  return components.map((c) => c / len);
}

describe('SqliteAdapter — embeddings', () => {
  test('storeEmbedding then findSimilar returns the stored row with similarity 1.0', async () => {
    const emb = unit(1, 0, 0);
    await sqliteAdapter.storeEmbedding('note-a', 'Note', emb, 'test-model');

    const out = await sqliteAdapter.findSimilar(emb, ['Note'], 5, 0.99);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('note-a');
    expect(out[0].nodeType).toBe('Note');
    expect(out[0].similarity).toBeCloseTo(1.0, 5);
  });

  test('storeEmbedding is upsert on (node_type, node_id)', async () => {
    await sqliteAdapter.storeEmbedding('x', 'Note', unit(1, 0, 0), 'm');
    await sqliteAdapter.storeEmbedding('x', 'Note', unit(0, 1, 0), 'm2');
    const out = await sqliteAdapter.findSimilar(unit(0, 1, 0), ['Note'], 5, 0.5);
    expect(out).toHaveLength(1);
    expect(out[0].similarity).toBeCloseTo(1.0, 5);
  });

  test('findSimilar respects nodeTypes filter', async () => {
    await sqliteAdapter.storeEmbedding('note', 'Note', unit(1, 0, 0), 'm');
    await sqliteAdapter.storeEmbedding('bm', 'Bookmark', unit(1, 0, 0), 'm');
    const onlyNotes = await sqliteAdapter.findSimilar(
      unit(1, 0, 0), ['Note'], 10, 0,
    );
    expect(onlyNotes.map((r) => r.nodeType)).toEqual(['Note']);
  });

  test('findSimilar respects minSimilarity and orders desc', async () => {
    await sqliteAdapter.storeEmbedding('a', 'Note', unit(1, 0, 0), 'm');
    await sqliteAdapter.storeEmbedding('b', 'Note', unit(1, 1, 0), 'm'); // ~0.707
    await sqliteAdapter.storeEmbedding('c', 'Note', unit(0, 1, 0), 'm'); // 0
    const out = await sqliteAdapter.findSimilar(unit(1, 0, 0), ['Note'], 10, 0.6);
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
    expect(out[0].similarity).toBeGreaterThan(out[1].similarity);
  });
});

describe('SqliteAdapter — chunks', () => {
  test('batchCreateChunks then searchSimilarChunks returns matching chunks', async () => {
    const chunks = [
      { text: 'about cats', chunkIndex: 0, pageNum: 1 },
      { text: 'about dogs', chunkIndex: 1, pageNum: 1 },
    ];
    const embeddings = [unit(1, 0), unit(0, 1)];

    const created = await sqliteAdapter.batchCreateChunks(
      'book-1', chunks, embeddings, 'u1',
    );
    expect(created).toBe(2);

    const hits = await sqliteAdapter.searchSimilarChunks(
      unit(1, 0), { bookId: 'book-1' }, 5, 0.9,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].chunk.text).toBe('about cats');
    expect(hits[0].similarity).toBeCloseTo(1.0, 5);
  });

  test('searchSimilarChunks filters by bookId', async () => {
    await sqliteAdapter.batchCreateChunks(
      'book-1',
      [{ text: 'A', chunkIndex: 0 }],
      [unit(1, 0)],
      'u1',
    );
    await sqliteAdapter.batchCreateChunks(
      'book-2',
      [{ text: 'B', chunkIndex: 0 }],
      [unit(1, 0)],
      'u1',
    );
    const hits = await sqliteAdapter.searchSimilarChunks(
      unit(1, 0), { bookId: 'book-2' }, 10, 0,
    );
    expect(hits.map((r) => r.chunk.text)).toEqual(['B']);
  });

  test('getChunksByBook returns chunks ordered by chunkIndex', async () => {
    await sqliteAdapter.batchCreateChunks(
      'book-1',
      [
        { text: 'first', chunkIndex: 0 },
        { text: 'third', chunkIndex: 2 },
        { text: 'second', chunkIndex: 1 },
      ],
      [null, null, null],
      'u1',
    );
    const rows = await sqliteAdapter.getChunksByBook('book-1', 'u1');
    expect(rows.map((r) => r.text)).toEqual(['first', 'second', 'third']);
  });

  test('getChunksWithoutEmbeddings returns only un-embedded ones', async () => {
    await sqliteAdapter.batchCreateChunks(
      'book-1',
      [
        { text: 'has-emb', chunkIndex: 0 },
        { text: 'no-emb', chunkIndex: 1 },
      ],
      [unit(1, 0), null],
      'u1',
    );
    const rows = await sqliteAdapter.getChunksWithoutEmbeddings('book-1', 'u1');
    expect(rows.map((r) => r.text)).toEqual(['no-emb']);
  });

  test('updateChunkEmbedding swaps the embedding in place', async () => {
    await sqliteAdapter.batchCreateChunks(
      'book-1',
      [{ text: 'first', chunkIndex: 0 }],
      [null],
      'u1',
    );
    const [chunk] = await sqliteAdapter.getChunksWithoutEmbeddings('book-1', 'u1');
    await sqliteAdapter.updateChunkEmbedding(chunk.id, unit(0, 1), 'm');

    const hits = await sqliteAdapter.searchSimilarChunks(
      unit(0, 1), {}, 10, 0.9,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].similarity).toBeCloseTo(1.0, 5);
  });

  test('deleteChunksByBook removes them and returns the count', async () => {
    await sqliteAdapter.batchCreateChunks(
      'book-1',
      [{ text: 'x', chunkIndex: 0 }, { text: 'y', chunkIndex: 1 }],
      [null, null],
      'u1',
    );
    const n = await sqliteAdapter.deleteChunksByBook('book-1', 'u1');
    expect(n).toBe(2);
    expect(await sqliteAdapter.getChunksByBook('book-1', 'u1')).toEqual([]);
  });
});

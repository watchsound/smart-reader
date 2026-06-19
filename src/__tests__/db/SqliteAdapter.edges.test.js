/**
 * SqliteAdapter — Pass 3 relationship operations on graph_edge.
 *
 * Pins: createMentionsRelationship is idempotent (unique edge);
 * getBacklinks finds incoming edges; getOutgoingLinks finds outgoing;
 * syncNoteLinks replaces all LINKS_TO atomically.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  getUserIdFromToken: (token) => (token === 'u1' ? 1 : -1),
}));

const sqliteAdapter = require('../../main/utils/SqliteAdapter');

function reset() {
  testDb = new Database(':memory:');
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  testDb.exec(sql);
  sqliteAdapter.isConnected = true;
}

beforeEach(reset);
afterEach(() => testDb.close());

describe('SqliteAdapter — concept relationships', () => {
  test('createMentionsRelationship stores Note→Concept edge with props', async () => {
    await sqliteAdapter.createMentionsRelationship('note-1', 'concept-a', 3, 0.8);
    const row = testDb
      .prepare(`SELECT source_id, target_id, edge_type, props_json FROM graph_edge`)
      .get();
    expect(row.source_id).toBe('note-1');
    expect(row.target_id).toBe('concept-a');
    expect(row.edge_type).toBe('MENTIONS_CONCEPT');
    expect(JSON.parse(row.props_json)).toEqual({ frequency: 3, importance: 0.8 });
  });

  test('createMentionsRelationship is idempotent — second call updates props', async () => {
    await sqliteAdapter.createMentionsRelationship('n', 'c', 1, 0.5);
    await sqliteAdapter.createMentionsRelationship('n', 'c', 5, 0.9);
    const rows = testDb.prepare(`SELECT props_json FROM graph_edge`).all();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].props_json)).toEqual({ frequency: 5, importance: 0.9 });
  });
});

describe('SqliteAdapter — note links', () => {
  test('syncNoteLinks inserts new LINKS_TO edges', async () => {
    const result = await sqliteAdapter.syncNoteLinks(
      'note-1',
      [
        { targetType: 'Note', targetId: 'note-2', anchor: 'foo', position: 10 },
        { targetType: 'Vocabulary', targetId: 'vocab-3' },
      ],
      'u1',
    );
    expect(result).toEqual({ success: true, count: 2 });
    const outgoing = await sqliteAdapter.getOutgoingLinks('note-1', 'u1');
    expect(outgoing).toHaveLength(2);
    expect(outgoing.map((r) => r.targetType).sort()).toEqual(['Note', 'Vocabulary']);
  });

  test('syncNoteLinks replaces — old links go away', async () => {
    await sqliteAdapter.syncNoteLinks(
      'note-1',
      [{ targetType: 'Note', targetId: 'old' }],
      'u1',
    );
    await sqliteAdapter.syncNoteLinks(
      'note-1',
      [{ targetType: 'Note', targetId: 'new' }],
      'u1',
    );
    const out = await sqliteAdapter.getOutgoingLinks('note-1', 'u1');
    expect(out.map((r) => r.targetId)).toEqual(['new']);
  });

  test('getBacklinks finds inbound LINKS_TO + MENTIONS_CONCEPT', async () => {
    await sqliteAdapter.syncNoteLinks(
      'note-A',
      [{ targetType: 'Note', targetId: 'note-X' }],
      'u1',
    );
    await sqliteAdapter.syncNoteLinks(
      'note-B',
      [{ targetType: 'Note', targetId: 'note-X' }],
      'u1',
    );
    const back = await sqliteAdapter.getBacklinks('note-X', 'Note', 'u1');
    expect(back).toHaveLength(2);
    expect(back.map((b) => b.sourceId).sort()).toEqual(['note-A', 'note-B']);
  });

  test('getBacklinks props_json round-trips correctly', async () => {
    await sqliteAdapter.syncNoteLinks(
      'src',
      [{ targetType: 'Note', targetId: 'dst', anchor: 'a', position: 7 }],
      'u1',
    );
    const back = await sqliteAdapter.getBacklinks('dst', 'Note', 'u1');
    expect(back[0].props).toEqual({ anchor: 'a', position: 7 });
  });

  test('getBacklinks scoped by targetType', async () => {
    await sqliteAdapter.syncNoteLinks(
      'n',
      [
        { targetType: 'Note', targetId: 'x' },
        { targetType: 'Vocabulary', targetId: 'x' },
      ],
      'u1',
    );
    const noteBacks = await sqliteAdapter.getBacklinks('x', 'Note', 'u1');
    const vocabBacks = await sqliteAdapter.getBacklinks('x', 'Vocabulary', 'u1');
    expect(noteBacks).toHaveLength(1);
    expect(vocabBacks).toHaveLength(1);
  });

  test('empty links array clears all outgoing', async () => {
    await sqliteAdapter.syncNoteLinks(
      'n',
      [{ targetType: 'Note', targetId: 'x' }],
      'u1',
    );
    await sqliteAdapter.syncNoteLinks('n', [], 'u1');
    expect(await sqliteAdapter.getOutgoingLinks('n', 'u1')).toEqual([]);
  });
});

describe('SqliteAdapter — semantic similar notes', () => {
  function unit(...components) {
    const len = Math.hypot(...components);
    return components.map((c) => c / len);
  }

  test('findSemanticallySimilarNotes filters out the source note id', async () => {
    await sqliteAdapter.storeEmbedding('self', 'Note', unit(1, 0), 'm');
    await sqliteAdapter.storeEmbedding('other', 'Note', unit(1, 0), 'm');
    const out = await sqliteAdapter.findSemanticallySimilarNotes(
      'self', unit(1, 0), 0.5, 'u1',
    );
    expect(out.map((r) => r.id)).toEqual(['other']);
  });
});

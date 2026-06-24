import db, { getUserIdFromToken } from './dbManager';

export function saveMindmap({ title, query, data }, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;
  const createdAt = new Date().toISOString();
  try {
    const stmt = db.prepare(
      'INSERT INTO mindmap (title, query, data, created_at, user_id) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      title || '',
      query || '',
      JSON.stringify(data),
      createdAt,
      userId,
    );
    return { id: result.lastInsertRowid, title, query, createdAt };
  } catch (err) {
    console.error('[MindmapJsonManager.saveMindmap]', err);
    return null;
  }
}

export function listMindmaps(token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];
  try {
    const stmt = db.prepare(
      'SELECT id, title, query, created_at FROM mindmap WHERE user_id = ? ORDER BY created_at DESC',
    );
    return stmt.all(userId).map((row) => ({
      id: row.id,
      title: row.title,
      query: row.query,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[MindmapJsonManager.listMindmaps]', err);
    return [];
  }
}

export function getMindmap(id, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;
  try {
    const stmt = db.prepare(
      'SELECT * FROM mindmap WHERE id = ? AND user_id = ?',
    );
    const row = stmt.get(id, userId);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      query: row.query,
      data: JSON.parse(row.data),
      createdAt: row.created_at,
    };
  } catch (err) {
    console.error('[MindmapJsonManager.getMindmap]', err);
    return null;
  }
}

export function deleteMindmap(id, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return -1;
  try {
    db.prepare('DELETE FROM mindmap WHERE id = ? AND user_id = ?').run(id, userId);
    return 1;
  } catch (err) {
    console.error('[MindmapJsonManager.deleteMindmap]', err);
    return -1;
  }
}

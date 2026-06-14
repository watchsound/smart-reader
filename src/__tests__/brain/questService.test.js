const QuestService = require('../../main/utils/QuestService');

// In-memory electron-store double.
function makeStore(seed = {}) {
  const state = { ...seed };
  return {
    get: (key, def) => (key in state ? state[key] : def),
    set: (key, value) => {
      state[key] = value;
    },
    _state: state,
  };
}

describe('QuestService', () => {
  test('create — persists a quest with active status + timestamps', () => {
    const store = makeStore();
    const svc = new QuestService(store);
    const q = svc.create({ name: 'German B2', goal: 'Reach B2', userId: 1 });
    expect(q.id).toMatch(/^q_/);
    expect(q.status).toBe('active');
    expect(q.createdAt).toBe(q.updatedAt);
    expect(store._state['quests.items']).toHaveLength(1);
  });

  test('create — rejects missing name or goal', () => {
    const svc = new QuestService(makeStore());
    expect(svc.create({ goal: 'x' }).error).toBeTruthy();
    expect(svc.create({ name: 'x' }).error).toBeTruthy();
  });

  test('get / list — filters by userId and status', () => {
    const svc = new QuestService(makeStore());
    const q1 = svc.create({ name: 'A', goal: 'a', userId: 1 });
    const q2 = svc.create({ name: 'B', goal: 'b', userId: 2 });
    svc.archive(q2.id);
    expect(svc.get(q1.id).id).toBe(q1.id);
    expect(svc.list({ userId: 1 })).toHaveLength(1);
    expect(svc.list({ status: 'archived' })).toHaveLength(1);
    expect(svc.list({ status: 'active' })).toHaveLength(1);
  });

  test('update — mutates allowed fields and bumps updatedAt', async () => {
    const svc = new QuestService(makeStore());
    const q = svc.create({ name: 'A', goal: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    const u = svc.update(q.id, { name: 'A2', bookIds: [1, 2] });
    expect(u.name).toBe('A2');
    expect(u.bookIds).toEqual([1, 2]);
    expect(new Date(u.updatedAt).getTime()).toBeGreaterThan(
      new Date(q.updatedAt).getTime(),
    );
  });

  test('pause / resume / archive — set status and timestamps', () => {
    const svc = new QuestService(makeStore());
    const q = svc.create({ name: 'A', goal: 'a' });
    expect(svc.pause(q.id).status).toBe('paused');
    expect(svc.resume(q.id).status).toBe('active');
    const archived = svc.archive(q.id);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBe(archived.updatedAt);
  });
});

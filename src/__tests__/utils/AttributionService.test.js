jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});

const AttributionService = require('../../main/utils/AttributionService');

describe('AttributionService — contract', () => {
  it('exports a class with 3 async methods', () => {
    const svc = new AttributionService();
    expect(typeof svc.getBars).toBe('function');
    expect(typeof svc.getGroupDetail).toBe('function');
    expect(typeof svc.getDensityStrip).toBe('function');
  });
});

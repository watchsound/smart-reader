const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');

describe('PredictiveEngine contract', () => {
  const engine = new PredictiveEngine();

  test('predict throws not implemented', async () => {
    await expect(engine.predict({
      featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary',
    })).rejects.toThrow(/not implemented/);
  });

  test('rankCandidates throws not implemented', async () => {
    await expect(engine.rankCandidates([])).rejects.toThrow(/not implemented/);
  });

  test('refreshModel throws not implemented', async () => {
    await expect(engine.refreshModel({})).rejects.toThrow(/not implemented/);
  });

  test('calibrationReport throws not implemented', async () => {
    await expect(engine.calibrationReport({})).rejects.toThrow(/not implemented/);
  });
});

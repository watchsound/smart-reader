class PredictiveEngine {
  async predict(_args) { throw new Error('not implemented'); }

  async rankCandidates(_candidates) { throw new Error('not implemented'); }

  async refreshModel(_opts) { throw new Error('not implemented'); }

  async calibrationReport(_opts) { throw new Error('not implemented'); }
}

module.exports = PredictiveEngine;
module.exports.PredictiveEngine = PredictiveEngine;

const { KAPPA_0 } = require('./predictiveEnums');

function posteriorDelta(cell, parent) {
  const { n, sumDelta, sumDeltaSq } = cell;
  if (!n) {
    return { mean: parent.mean, std: Math.sqrt(parent.var) };
  }
  const sampleMean = sumDelta / n;
  const mean = (KAPPA_0 * parent.mean + n * sampleMean) / (KAPPA_0 + n);
  const sampleVar = Math.max(0, sumDeltaSq / n - sampleMean * sampleMean);
  const blendedVar = (KAPPA_0 * parent.var + n * sampleVar) / (KAPPA_0 + n);
  const std = Math.sqrt(blendedVar * (1 + 1 / (KAPPA_0 + n)));
  return { mean, std };
}

function posteriorPBoxUp(cell, parent) {
  const a = parent.alpha + (cell.s || 0);
  const b = parent.beta + ((cell.n || 0) - (cell.s || 0));
  return { mean: a / (a + b), alpha: a, beta: b };
}

module.exports = { posteriorDelta, posteriorPBoxUp };

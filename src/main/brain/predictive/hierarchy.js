function emptyAgg() { return { n: 0, sumDelta: 0, sumDeltaSq: 0, boxUpCount: 0 }; }

function sumAgg(target, row) {
  target.n += row.n;
  target.sumDelta += row.sumDelta;
  target.sumDeltaSq += row.sumDeltaSq;
  target.boxUpCount += row.boxUpCount;
  return target;
}

function buildHierarchy(cellAggregates) {
  const surfaceBox = new Map();
  const surface = new Map();
  const global = emptyAgg();
  for (const row of cellAggregates) {
    sumAgg(global, row);
    const sbKey = `${row.featureSurface}|${row.currentBox}`;
    if (!surfaceBox.has(sbKey)) surfaceBox.set(sbKey, emptyAgg());
    sumAgg(surfaceBox.get(sbKey), row);
    if (!surface.has(row.featureSurface)) surface.set(row.featureSurface, emptyAgg());
    sumAgg(surface.get(row.featureSurface), row);
  }
  return { surfaceBox, surface, global };
}

module.exports = { buildHierarchy, emptyAgg };

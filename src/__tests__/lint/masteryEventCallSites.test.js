// src/__tests__/lint/masteryEventCallSites.test.js
/**
 * Lint guard: every mastery_event write site in the main process must go
 * through masteryEventRecorder.recordWithProximateCall, not call
 * MasteryEventStore.record directly.
 *
 * Exceptions (allowed to mention .record directly):
 *   - masteryEventRecorder.js  (the helper itself)
 *   - MasteryEventStore.js     (the store definition)
 */
const fs = require('fs');
const path = require('path');

/**
 * Recursively collect all .js files under `dir`.
 */
function collectJsFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('lint: mastery_event write-site discipline', () => {
  it('no main-process file calls MasteryEventStore.record directly — must use masteryEventRecorder.recordWithProximateCall', () => {
    const mainDir = path.join(__dirname, '../../main');
    const files = collectJsFiles(mainDir);
    const violations = [];
    files.forEach((file) => {
      // The helper itself + the store itself are allowed to mention .record(
      if (file.endsWith('masteryEventRecorder.js')) return;
      if (file.endsWith('MasteryEventStore.js')) return;
      const src = fs.readFileSync(file, 'utf8');
      if (/MasteryEventStore\.record\s*\(/.test(src)) {
        violations.push(
          `${file}: direct MasteryEventStore.record call — use masteryEventRecorder.recordWithProximateCall instead`
        );
      }
    });
    expect(violations).toEqual([]);
  });
});

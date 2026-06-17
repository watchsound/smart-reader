// src/main/brain/spine/promptAssembler.js
/**
 * Assemble the final prompt string sent to the provider.
 * Order: [profile header] → [learner context block] → [user input].
 * Deterministic for the same inputs (used as cache key by brainCall).
 */
function assemble({ userInput, context, profileLabel }) {
  const parts = [];
  if (profileLabel) parts.push(`# ${profileLabel}\n`);
  const keys = Object.keys(context || {});
  if (keys.length > 0) {
    parts.push('## Learner Context');
    const sortedKeys = [...keys].sort();
    for (const k of sortedKeys) {
      parts.push(`### ${k}`);
      parts.push(JSON.stringify(context[k]));
    }
    parts.push('');
  }
  parts.push('## Task');
  parts.push(userInput);
  return parts.join('\n');
}

module.exports = assemble;

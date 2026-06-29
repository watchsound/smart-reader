export const RUNG_IDS = ['light', 'medium', 'hard'];

export function parseRecallLadder(input) {
  let obj = input;
  if (typeof obj === 'string') {
    obj = JSON.parse(obj);
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error(`parseRecallLadder: expected object, got ${typeof obj}`);
  }
  for (const rung of RUNG_IDS) {
    if (!(rung in obj)) {
      throw new Error(`parseRecallLadder: missing rung: ${rung}`);
    }
    if (typeof obj[rung] !== 'string') {
      throw new Error(`parseRecallLadder: rung "${rung}" must be a string`);
    }
  }
  return { light: obj.light, medium: obj.medium, hard: obj.hard };
}

export default { parseRecallLadder, RUNG_IDS };

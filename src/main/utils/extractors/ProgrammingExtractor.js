/* eslint-disable class-methods-use-this */
/**
 * ProgrammingExtractor — produces ProgrammingExtras (language, snippet,
 * expected output, variations, gotchas, runnable, versionContext).
 */

import BaseExtractor from './BaseExtractor';
import { createProgrammingExtractionPrompt } from '../../../commons/utils/AIPrompts';

const SCHEMA = {
  type: 'object',
  required: ['language', 'snippet'],
  properties: {
    language: { type: 'string' },
    snippet: { type: 'string' },
    expectedOutput: { type: 'string' },
    variations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          snippet: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
    gotchas: { type: 'array', items: { type: 'string' } },
    runnable: { type: 'boolean' },
    versionContext: { type: 'string' },
  },
};

export default class ProgrammingExtractor extends BaseExtractor {
  get domain() {
    return 'programming';
  }

  get schema() {
    return SCHEMA;
  }

  buildPrompt(text) {
    return createProgrammingExtractionPrompt(text);
  }

  postProcess(raw) {
    const extras = {
      language:
        typeof raw.language === 'string'
          ? raw.language.trim().toLowerCase()
          : '',
      snippet: typeof raw.snippet === 'string' ? raw.snippet : '',
    };
    if (typeof raw.expectedOutput === 'string' && raw.expectedOutput.trim()) {
      extras.expectedOutput = raw.expectedOutput;
    }
    if (Array.isArray(raw.variations)) {
      extras.variations = raw.variations
        .filter((v) => v && typeof v.snippet === 'string' && v.snippet.trim())
        .slice(0, 2)
        .map((v) => ({
          snippet: v.snippet,
          ...(typeof v.note === 'string' && v.note.trim()
            ? { note: v.note.trim() }
            : {}),
        }));
    }
    if (Array.isArray(raw.gotchas)) {
      extras.gotchas = raw.gotchas
        .filter((g) => typeof g === 'string' && g.trim())
        .slice(0, 3);
    }
    if (typeof raw.runnable === 'boolean') extras.runnable = raw.runnable;
    if (typeof raw.versionContext === 'string' && raw.versionContext.trim()) {
      extras.versionContext = raw.versionContext.trim();
    }
    return extras;
  }

  deriveCardFields(extras, text) {
    // Front: first line of code (or first 80 chars of source).
    const firstLine =
      (extras.snippet && extras.snippet.split('\n')[0]) || text.slice(0, 80);
    let back = '';
    if (extras.expectedOutput) {
      back = `→ ${extras.expectedOutput}`;
    } else if (extras.gotchas && extras.gotchas[0]) {
      [back] = extras.gotchas;
    }
    return { front: firstLine.slice(0, 100), back };
  }
}

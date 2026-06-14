/* eslint-disable import/prefer-default-export */
/* eslint-disable no-await-in-loop */
/**
 * Structured-output polyfill.
 *
 * Provides a single `getStructured(provider, prompt, options)` entry point
 * that returns parsed JSON regardless of the underlying provider's native
 * structured-output capability. Routes by the provider's capability flag:
 *
 *   structuredOutput: 'native'      → use provider.generateStructured()      [TODO — providers don't expose this yet]
 *   structuredOutput: 'json-mode'   → use provider.generateJsonMode()        [TODO — providers don't expose this yet]
 *   structuredOutput: 'prompt-only' → append schema instruction, parse with retry
 *
 * For now the native and json-mode branches fall through to the prompt-only
 * polyfill, so callers can adopt this API today and benefit automatically
 * when providers grow native methods later.
 *
 * This module is the long-term replacement for the ad-hoc
 * `AIProviderManager.generateContentWithJson` + `processResponseJsonData`
 * pattern used by ~33 call sites today. Migration of those callers is
 * Phase 0+ work — this module is additive and does not change them.
 *
 * The retry loop uses sequential awaits intentionally — each retry
 * depends on the previous attempt's failure.
 */

import { AIProviderManager } from '../AIProviderManager';

const PARSE_RETRY_INSTRUCTION =
  '\n\nIMPORTANT: Your previous response was not valid JSON. ' +
  'Return ONLY a single JSON object matching the schema, with no prose, no markdown fences, no commentary.';

/**
 * Build the schema-injection text appended to the user prompt when the
 * provider has no native structured-output support.
 */
function buildSchemaInstruction(schema, options = {}) {
  const { schemaName = 'response' } = options;
  const schemaJson =
    typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
  const nameClause = schemaName ? ` (the "${schemaName}" object)` : '';
  return `\n\nReturn your answer as a single JSON object${nameClause} matching this schema. Return ONLY the JSON, no prose, no markdown fences:\n${schemaJson}\n`;
}

/**
 * Get a structured (parsed JSON) response from a provider.
 *
 * @param {AIProviderInterface} provider — a provider instance (e.g. aiProviderManager.currentProvider)
 * @param {string} prompt — user prompt; schema instruction is appended automatically
 * @param {Object|string} schema — JSON-schema-like object (or pre-formatted string) describing the expected shape
 * @param {Object} [options]
 * @param {string} [options.schemaName] — optional name for the schema (used in the appended instruction)
 * @param {string} [options.startTag] — optional tag the response wraps the JSON in (forwarded to the parser)
 * @param {number} [options.maxRetries=1] — number of parse-failure retries
 * @returns {Promise<Object|''>} parsed JSON object on success, '' on parse failure
 */
export async function getStructured(provider, prompt, schema, options = {}) {
  if (!provider) {
    console.error('[polyfill:getStructured] no provider');
    return '';
  }
  const { startTag, maxRetries = 1 } = options;
  const level =
    typeof provider.supports === 'function'
      ? provider.capabilities().structuredOutput
      : 'prompt-only';

  // TODO native branch: once providers expose generateStructured(prompt, schema),
  // route here for guaranteed-parse responses (Anthropic tool_use, OpenAI response_format).
  // if (level === 'native' && typeof provider.generateStructured === 'function') {
  //   return provider.generateStructured(prompt, schema);
  // }

  // TODO json-mode branch: once providers expose generateJsonMode(prompt),
  // route here (Ollama format=json, OpenAI json_object, Qwen response_format).
  // if (level === 'json-mode' && typeof provider.generateJsonMode === 'function') {
  //   const raw = await provider.generateJsonMode(prompt + buildSchemaInstruction(schema, options));
  //   return AIProviderManager.processResponseJsonData(raw, startTag);
  // }

  // Prompt-only fallback path — works on any instruction-following model.
  // Reuses the existing multi-strategy JSON parser in AIProviderManager.
  const totalAttempts = maxRetries + 1;
  let fullPrompt = prompt + buildSchemaInstruction(schema, options);
  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const raw = await provider.generateContent(fullPrompt);
    if (!raw) return '';
    const parsed = AIProviderManager.processResponseJsonData(raw, startTag);
    if (parsed && typeof parsed === 'object') return parsed;
    // Retry with stricter instruction; prompt-only providers may need nudging
    fullPrompt = `${prompt}${buildSchemaInstruction(schema, options)}${PARSE_RETRY_INSTRUCTION}`;
  }
  console.warn(
    `[polyfill:getStructured] parse failed after retries on provider with structuredOutput=${level}`,
  );
  return '';
}

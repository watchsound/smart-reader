/**
 * PromptUtil.js - Re-exports from AIPrompts.js for backward compatibility
 *
 * NOTE: These prompts have been moved to src/commons/utils/AIPrompts.js
 * to allow sharing between renderer and main process (skills).
 *
 * This file is kept for backward compatibility with any code that imports from here.
 * New code should import directly from '../../../commons/utils/AIPrompts'.
 */

export {
  getNLPAnnotationPrompt,
  getTranslatePrompt,
  getVerbComparisonPrompt,
  getVerbExplainedPrompt,
} from '../../../commons/utils/AIPrompts';

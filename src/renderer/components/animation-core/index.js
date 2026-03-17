/**
 * Animation Core - Universal Animation System
 *
 * A modular animation system extracted from StudyEnhancer for use across
 * different views (EPUB, PDF, Notes, Browser).
 *
 * Main components:
 * - AnimationCore: Main controller class
 * - useAnimationCore: React hook
 * - WordWrapper: Wraps words in DOM elements
 * - AnimationEngine: Animation primitives (fly, fade, glow)
 * - CloneManager: Creates floating clones for animations
 * - PositionManager: Tracks positions and calculates layouts
 * - EffectRegistry: Plugin system for effects
 *
 * Built-in effects:
 * - HighlightEffect: Background color highlighting
 * - FadeInEffect: Sequential word fade-in
 * - GlowEffect: Text glow with pulse
 * - FlyingWordEffect: Fly words to target position
 *
 * Usage with hook:
 *   import { useAnimationCore } from '../components/animation-core';
 *
 *   function MyComponent() {
 *     const { highlight, glow, flyToSummary, removeAllEffects } = useAnimationCore();
 *
 *     const handleHighlight = async () => {
 *       await highlight(['important', 'words'], { color: '#ffd700' });
 *     };
 *
 *     return <button onClick={handleHighlight}>Highlight</button>;
 *   }
 *
 * Usage without hook:
 *   import { AnimationCore } from '../components/animation-core';
 *
 *   const core = new AnimationCore({ container: myElement });
 *   await core.highlightWords(['important', 'words']);
 *   // Later...
 *   await core.destroy();
 */

// Main exports
export { default as AnimationCore } from './AnimationCore';
export { default as useAnimationCore } from './useAnimationCore';

// Core components
export { default as WordWrapper } from './WordWrapper';
export { default as AnimationEngine } from './AnimationEngine';
export { default as CloneManager } from './CloneManager';
export { default as PositionManager } from './PositionManager';
export { default as EffectRegistry } from './EffectRegistry';

// Base effect class
export { default as BaseEffect } from './effects/BaseEffect';

// Built-in effects
export { default as HighlightEffect } from './effects/HighlightEffect';
export { default as FadeInEffect } from './effects/FadeInEffect';
export { default as GlowEffect } from './effects/GlowEffect';
export { default as FlyingWordEffect } from './effects/FlyingWordEffect';
export { default as LeitnerTransitionEffect } from './effects/LeitnerTransitionEffect';

// View-specific adapters
export {
  EPUBAdapter,
  PDFAdapter,
  NoteAdapter,
  useEPUBAnimations,
  usePDFAnimations,
  useNoteAnimations,
} from './adapters';

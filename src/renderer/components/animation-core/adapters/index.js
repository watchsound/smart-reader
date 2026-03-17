/**
 * Animation Adapters
 *
 * View-specific adapters that bridge AnimationCore with different rendering contexts:
 * - EPUBAdapter: For EPUB reader (react-reader / epub.js iframe)
 * - PDFAdapter: For PDF viewer (react-pdf-highlighter text layers)
 * - NoteAdapter: For Notes/Leitner views (direct DOM manipulation)
 */

// Adapters
export { default as EPUBAdapter } from './EPUBAdapter';
export { default as PDFAdapter } from './PDFAdapter';
export { default as NoteAdapter } from './NoteAdapter';

// React hooks
export { default as useEPUBAnimations } from './useEPUBAnimations';
export { default as usePDFAnimations } from './usePDFAnimations';
export { default as useNoteAnimations } from './useNoteAnimations';

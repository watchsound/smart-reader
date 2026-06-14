/* eslint-disable react/jsx-props-no-spreading */
/**
 * StudyCard — thin delegating wrapper around the per-domain card router
 * (Phase 3c).
 *
 * Behavior for callers is unchanged: the existing props
 *   { item, isFlipped, onFlip, hint, hintLevel, hintLoading, onPronounce,
 *     animationClass }
 * are forwarded verbatim to StudyCardRouter, which picks the right card
 * (VocabCard / MathCard / CodeCard / KnowledgeCard / GenericCard) based on
 * `item.domain`. Items without a recognized domain render via GenericCard,
 * which preserves the previous behavior exactly.
 *
 * The original 333-line render logic now lives in
 * src/renderer/views/study/components/cards/CardShell.js (shell chrome)
 * and GenericCard.js (default body), so this file stays a single-line
 * delegate.
 */

import React from 'react';
import StudyCardRouter from './cards/StudyCardRouter';

function StudyCard(props) {
  return <StudyCardRouter {...props} />;
}

export default StudyCard;

/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/**
 * StudyCardRouter — picks the per-domain card component based on the
 * learning_point's `domain` (a.k.a. domain_type) field.
 *
 * Routing table (mirrors Phase 3b extractor coverage):
 *   vocabulary                              → VocabCard
 *   math, physics, chemistry, biology       → MathCard
 *   programming                             → CodeCard
 *   knowledge, history, geography, reading  → KnowledgeCard
 *   anything else (language, skill, custom,
 *   missing, unknown)                       → GenericCard
 *
 * Forwards all incoming props (item, isFlipped, onFlip, hint, hintLevel,
 * hintLoading, onPronounce, animationClass, ...) to the chosen card.
 */

import React from 'react';
import GenericCard from './GenericCard';
import VocabCard from './VocabCard';
import MathCard from './MathCard';
import CodeCard from './CodeCard';
import KnowledgeCard from './KnowledgeCard';

const ROUTE = {
  vocabulary: VocabCard,
  math: MathCard,
  physics: MathCard,
  chemistry: MathCard,
  biology: MathCard,
  programming: CodeCard,
  knowledge: KnowledgeCard,
  history: KnowledgeCard,
  geography: KnowledgeCard,
  reading: KnowledgeCard,
};

export function pickCardComponent(domain) {
  return ROUTE[domain] || GenericCard;
}

function StudyCardRouter(props) {
  // The item may carry `domain` (new) or `domain_type` (some legacy paths) —
  // accept both with a graceful fallback.
  const { item } = props;
  const domain = item?.domain || item?.domainType || item?.domain_type;
  const Card = pickCardComponent(domain);
  return <Card {...props} />;
}

export default StudyCardRouter;

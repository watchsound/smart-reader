/**
 * Graph Integration Tests - Test Utilities
 *
 * This module provides test utilities and data factories for graph integration tests.
 *
 * Test Structure:
 * - GraphInterface.test.js - Tests the adapter pattern abstraction layer
 * - Neo4jAdapter.test.js - Tests the Neo4j database adapter implementation
 * - graphApi.test.js - Tests the renderer-side IPC API
 * - graphHandlers.test.js / graphHandlers.test.ts - Tests the main process IPC handlers
 * - GraphLearningFeatures.test.js - Tests advanced learning features
 * - components/ - UI component tests
 *   - KnowledgeGraphPanel.test.js
 *   - LearningPathPanel.test.js
 *   - WeakConceptsPanel.test.js
 */

// Placeholder test to satisfy Jest
describe('Graph Test Utilities', () => {
  it('should export test utilities', () => {
    expect(TEST_TOKEN).toBe('test-token');
    expect(createMockNote).toBeDefined();
    expect(createMockConcept).toBeDefined();
  });
});

// Export test utilities if needed
export const TEST_TOKEN = 'test-token';
export const VALID_TOKEN = 'valid-token';
export const INVALID_TOKEN = 'invalid-token';

// Sample test data factories
export const createMockNote = (overrides = {}) => ({
  id: '1',
  title: 'Test Note',
  content: 'Test content',
  sourceType: 'book',
  sourceKey: '123',
  cards: [],
  ...overrides,
});

export const createMockConcept = (overrides = {}) => ({
  id: 'concept1',
  name: 'Test Concept',
  description: 'A test concept',
  domain: 'testing',
  difficulty: 'intermediate',
  masteryLevel: 50,
  ...overrides,
});

export const createMockLearningPath = (overrides = {}) => ({
  targetConceptId: 'target1',
  path: [
    { id: 'c1', name: 'Step 1', mastery: 80, depth: 2 },
    { id: 'c2', name: 'Step 2', mastery: 50, depth: 1 },
    { id: 'target1', name: 'Target', mastery: 0, depth: 0 },
  ],
  conceptCount: 3,
  estimatedMinutes: 90,
  nextConcept: { id: 'c1', name: 'Step 1', mastery: 80 },
  ...overrides,
});

export const createMockWeakConcept = (overrides = {}) => ({
  id: 'weak1',
  name: 'Weak Concept',
  description: 'Needs improvement',
  mastery: 25,
  reviewCount: 3,
  lastReviewed: null,
  dependentCount: 2,
  weaknessScore: 100,
  reason: 'Very low mastery',
  ...overrides,
});

export const createMockKnowledgeGraph = () => ({
  nodes: [
    { id: 'n1', name: 'Concept A', mastery: 75, domain: 'AI' },
    { id: 'n2', name: 'Concept B', mastery: 50, domain: 'AI' },
    { id: 'n3', name: 'Concept C', mastery: 25, domain: 'Math' },
  ],
  edges: [
    { source: 'n1', target: 'n2', type: 'REQUIRES' },
    { source: 'n2', target: 'n3', type: 'RELATED_TO' },
  ],
});

// Mock event creator for IPC handler tests
export const createMockEvent = () => ({
  returnValue: null,
});

// Mock session creator for Neo4j tests
export const createMockSession = () => ({
  run: jest.fn(),
  close: jest.fn(),
});

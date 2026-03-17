# Neo4j :SUMMARIZES Relationships Implementation Plan

## Overview

Implement comprehensive `:SUMMARIZES` relationships in Neo4j to connect ConsolidatedMemory nodes with their source Episodes and target Concepts, creating a hierarchical learning memory structure.

## Current State Analysis

### What Exists

1. **ConsolidationService.js** (line 811-848): Basic `:SUMMARIZES` relationship
   - Creates `ConsolidatedMemory -[:SUMMARIZES]-> Concept` relationship
   - Only links to concepts, not episodes
   - No relationship properties (weight, confidence, etc.)
   - Only triggers when `conceptId` matches an existing Concept node

2. **EpisodeCollector.js**: Episode node creation
   - Creates Episode nodes with bi-temporal timestamps
   - Marks episodes as `processed=true` and `consolidatedInto=memoryId`
   - No graph relationship to ConsolidatedMemory

3. **Neo4jAdapter.js**: No ConsolidatedMemory or Episode methods
   - No indexes for ConsolidatedMemory or Episode nodes
   - No query methods for summarization relationships

4. **ConsolidatedMemoryManager.js**: SQLite-only storage
   - Stores consolidated memories in SQLite
   - `source_episodes` field stores episode IDs as JSON
   - No direct Neo4j integration

### What's Missing

1. **Neo4j Indexes**: No indexes for ConsolidatedMemory or Episode nodes
2. **Bidirectional Relationships**: Episodes don't link back to memories
3. **Relationship Properties**: No weight, confidence, or temporal metadata
4. **Multi-source Summarization**: A memory can summarize multiple concepts
5. **Query Methods**: No Neo4j methods for traversing summarization hierarchy
6. **Cross-concept Linking**: Cross-concept patterns need special relationships

## Architecture Design

### Node Schema

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEARNING MEMORY HIERARCHY                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │  Episode         │  (Raw learning events)                            │
│  │  - id            │                                                   │
│  │  - eventType     │                                                   │
│  │  - timestamp     │                                                   │
│  │  - payload       │                                                   │
│  │  - processed     │                                                   │
│  │  - t_valid       │  (bi-temporal)                                    │
│  │  - t_expired     │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ :CONSOLIDATED_INTO                                          │
│           │ {weight, position, contribution}                            │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ConsolidatedMemory│  (LLM-synthesized summaries)                      │
│  │  - id            │                                                   │
│  │  - memoryType    │  (concept_session, cross_concept, daily, weekly)  │
│  │  - summary       │                                                   │
│  │  - episodeCount  │                                                   │
│  │  - mastery       │                                                   │
│  │  - periodStart   │                                                   │
│  │  - periodEnd     │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           │ :SUMMARIZES                                                 │
│           │ {weight, confidence, primaryConcept, aspectsCovered}        │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │    Concept       │  (Knowledge graph entities)                       │
│  │  - id            │                                                   │
│  │  - name          │                                                   │
│  │  - description   │                                                   │
│  │  - mastery       │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
│  Additional Relationships:                                               │
│  ─────────────────────────                                               │
│  ConsolidatedMemory -[:RELATED_TO {type}]-> ConsolidatedMemory          │
│  LearnerProfile -[:HAS_MEMORY]-> ConsolidatedMemory                     │
│  User -[:HAS_MEMORY]-> ConsolidatedMemory                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Relationship Types

| Relationship | From | To | Properties |
|--------------|------|-----|------------|
| `:CONSOLIDATED_INTO` | Episode | ConsolidatedMemory | `weight`, `position`, `contribution`, `createdAt` |
| `:SUMMARIZES` | ConsolidatedMemory | Concept | `weight`, `confidence`, `isPrimary`, `aspectsCovered`, `createdAt` |
| `:MEMORY_RELATES` | ConsolidatedMemory | ConsolidatedMemory | `relationType`, `strength`, `createdAt` |
| `:HAS_MEMORY` | User | ConsolidatedMemory | `createdAt` |

### Relationship Properties

**`:CONSOLIDATED_INTO` Properties:**
```javascript
{
  weight: 0.0-1.0,        // Contribution weight to the summary
  position: 1-N,          // Order in the episode sequence
  contribution: 'primary' | 'supporting' | 'contextual',
  createdAt: datetime(),
}
```

**`:SUMMARIZES` Properties:**
```javascript
{
  weight: 0.0-1.0,        // How strongly this memory represents the concept
  confidence: 0.0-1.0,    // Confidence in the summarization
  isPrimary: boolean,     // Is this the primary concept for this memory?
  aspectsCovered: ['definition', 'examples', 'relationships', ...],
  masteryContribution: 'positive' | 'negative' | 'neutral',
  createdAt: datetime(),
}
```

**`:MEMORY_RELATES` Properties:**
```javascript
{
  relationType: 'prerequisite' | 'builds_on' | 'contrasts' | 'clusters_with',
  strength: 0.0-1.0,
  discoveredAt: datetime(),
}
```

## Implementation Steps

### Step 1: Add Neo4j Indexes and Constraints

**File:** `src/main/utils/Neo4jAdapter.js` (add to `createIndexes` method)

```javascript
// Add to existing createIndexes() method
const memoryIndexes = [
  // Unique constraints
  'CREATE CONSTRAINT memory_id_unique IF NOT EXISTS FOR (m:ConsolidatedMemory) REQUIRE m.id IS UNIQUE',
  'CREATE CONSTRAINT episode_id_unique IF NOT EXISTS FOR (e:Episode) REQUIRE e.id IS UNIQUE',

  // Performance indexes
  'CREATE INDEX memory_user IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.userId)',
  'CREATE INDEX memory_type IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.memoryType)',
  'CREATE INDEX memory_period IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.periodStart, m.periodEnd)',
  'CREATE INDEX memory_concept IF NOT EXISTS FOR (m:ConsolidatedMemory) ON (m.conceptId)',
  'CREATE INDEX episode_user IF NOT EXISTS FOR (e:Episode) ON (e.userId)',
  'CREATE INDEX episode_type IF NOT EXISTS FOR (e:Episode) ON (e.eventType)',
  'CREATE INDEX episode_timestamp IF NOT EXISTS FOR (e:Episode) ON (e.timestamp)',
  'CREATE INDEX episode_processed IF NOT EXISTS FOR (e:Episode) ON (e.processed)',
];
```

### Step 2: Create SummarizationGraphService

**New File:** `src/main/utils/SummarizationGraphService.js`

This service handles all summarization-related graph operations:

```javascript
/**
 * SummarizationGraphService.js
 *
 * Manages :SUMMARIZES relationships in Neo4j, connecting:
 * - Episodes → ConsolidatedMemory (via :CONSOLIDATED_INTO)
 * - ConsolidatedMemory → Concept (via :SUMMARIZES)
 * - ConsolidatedMemory → ConsolidatedMemory (via :MEMORY_RELATES)
 *
 * Features:
 * - Create/update/delete summarization relationships
 * - Query summarization hierarchies
 * - Calculate aggregated mastery from memories
 * - Find related memories across concepts
 */

class SummarizationGraphService {
  constructor(services = {}) {
    this.neo4jAdapter = services.neo4jAdapter;
    this.store = services.store;
  }

  // =========================================================================
  // MEMORY NODE OPERATIONS
  // =========================================================================

  /**
   * Create or update a ConsolidatedMemory node in Neo4j
   */
  async upsertConsolidatedMemory(memory, userId) { ... }

  /**
   * Delete a ConsolidatedMemory node and its relationships
   */
  async deleteConsolidatedMemory(memoryId) { ... }

  // =========================================================================
  // EPISODE → MEMORY RELATIONSHIPS (:CONSOLIDATED_INTO)
  // =========================================================================

  /**
   * Link episodes to their consolidated memory
   */
  async linkEpisodesToMemory(episodeIds, memoryId, options = {}) { ... }

  /**
   * Get all episodes that contributed to a memory
   */
  async getSourceEpisodes(memoryId, limit = 100) { ... }

  /**
   * Get the memory that an episode was consolidated into
   */
  async getMemoryForEpisode(episodeId) { ... }

  // =========================================================================
  // MEMORY → CONCEPT RELATIONSHIPS (:SUMMARIZES)
  // =========================================================================

  /**
   * Create :SUMMARIZES relationship with properties
   */
  async createSummarizesRelationship(memoryId, conceptId, properties = {}) { ... }

  /**
   * Link a memory to multiple concepts with weights
   */
  async linkMemoryToConcepts(memoryId, concepts) { ... }

  /**
   * Get all concepts summarized by a memory
   */
  async getConceptsForMemory(memoryId) { ... }

  /**
   * Get all memories that summarize a concept
   */
  async getMemoriesForConcept(conceptId, options = {}) { ... }

  /**
   * Calculate aggregated mastery for a concept from its memories
   */
  async calculateConceptMasteryFromMemories(conceptId) { ... }

  // =========================================================================
  // MEMORY → MEMORY RELATIONSHIPS (:MEMORY_RELATES)
  // =========================================================================

  /**
   * Create relationship between related memories
   */
  async linkRelatedMemories(memoryId1, memoryId2, relationType, strength) { ... }

  /**
   * Find memories related to a given memory
   */
  async getRelatedMemories(memoryId, relationType = null) { ... }

  /**
   * Find memory chains (prerequisite sequences)
   */
  async getMemoryChain(memoryId, direction = 'both', maxDepth = 5) { ... }

  // =========================================================================
  // HIERARCHICAL QUERIES
  // =========================================================================

  /**
   * Get full summarization hierarchy for a concept
   * Returns: concept → memories → episodes
   */
  async getSummarizationHierarchy(conceptId, options = {}) { ... }

  /**
   * Get learning timeline for a concept (ordered by period)
   */
  async getConceptLearningTimeline(conceptId, limit = 50) { ... }

  /**
   * Get cross-concept memory clusters
   */
  async getCrossConceptClusters(userId, limit = 10) { ... }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  /**
   * Get summarization statistics for a user
   */
  async getSummarizationStats(userId) { ... }

  /**
   * Get memory coverage analysis (which concepts have most/least memories)
   */
  async getMemoryCoverage(userId, limit = 20) { ... }

  /**
   * Find gaps in memory coverage (concepts without recent memories)
   */
  async findMemoryGaps(userId, daysSinceLastMemory = 30) { ... }
}
```

### Step 3: Update ConsolidationService

**File:** `src/main/utils/ConsolidationService.js`

Replace the simple `syncToNeo4j` method with comprehensive graph synchronization:

```javascript
// Add to constructor
this.summarizationGraph = new SummarizationGraphService({
  neo4jAdapter: this.neo4jAdapter,
  store: this.store,
});

/**
 * Enhanced syncToNeo4j with full relationship creation
 */
async syncToNeo4j(memory, userId) {
  if (!this.neo4jAdapter) return;

  try {
    // 1. Create/update ConsolidatedMemory node
    await this.summarizationGraph.upsertConsolidatedMemory(memory, userId);

    // 2. Link source episodes to memory
    if (memory.sourceEpisodes?.length > 0) {
      await this.summarizationGraph.linkEpisodesToMemory(
        memory.sourceEpisodes,
        memory.id,
        { calculateWeights: true }
      );
    }

    // 3. Create :SUMMARIZES relationships to concepts
    const concepts = this.extractConceptsFromMemory(memory);
    if (concepts.length > 0) {
      await this.summarizationGraph.linkMemoryToConcepts(memory.id, concepts);
    }

    // 4. Link to cross-concept patterns (for cross_concept type)
    if (memory.memoryType === 'cross_concept' && memory.patterns) {
      await this.linkCrossConceptPatterns(memory);
    }

    // 5. Link to user and update profile
    await this.linkMemoryToUser(memory.id, userId);

    console.log(`[ConsolidationService] Synced memory ${memory.id} to Neo4j`);
  } catch (err) {
    console.error('[ConsolidationService] Neo4j sync failed:', err);
    throw err;
  }
}

/**
 * Extract concepts from memory for linking
 */
extractConceptsFromMemory(memory) {
  const concepts = [];

  // Primary concept
  if (memory.conceptId) {
    concepts.push({
      id: memory.conceptId,
      name: memory.conceptName,
      isPrimary: true,
      weight: 1.0,
      confidence: 0.9,
    });
  }

  // From insights (mentioned concepts)
  if (memory.insights && Array.isArray(memory.insights)) {
    // Parse insights for concept mentions
    // ... extraction logic
  }

  return concepts;
}

/**
 * Link cross-concept pattern memories to related concepts
 */
async linkCrossConceptPatterns(memory) {
  const patterns = memory.patterns || {};

  // Prerequisites
  for (const prereq of patterns.crossConcept?.filter(p => p.type === 'PREREQUISITE') || []) {
    await this.summarizationGraph.linkMemoryToConcepts(memory.id, [
      { id: prereq.fromConceptId, name: prereq.fromConceptName, aspectsCovered: ['prerequisite'] },
      { id: prereq.toConceptId, name: prereq.toConceptName, aspectsCovered: ['dependent'] },
    ]);
  }

  // Clusters
  for (const cluster of patterns.crossConcept?.filter(p => p.type === 'CONCEPT_CLUSTER') || []) {
    await this.summarizationGraph.linkMemoryToConcepts(memory.id,
      cluster.conceptIds.map(id => ({
        id,
        aspectsCovered: ['cluster_member'],
        weight: 1.0 / cluster.conceptIds.length,
      }))
    );
  }
}
```

### Step 4: Add IPC Handlers

**File:** `src/main/ipc/brainHandlers.js` (add new handlers)

```javascript
// Summarization Graph Handlers

ipcMain.handle('graph-get-summarization-hierarchy', async (event, { conceptId, token, options }) => {
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getSummarizationHierarchy(conceptId, options);
});

ipcMain.handle('graph-get-memories-for-concept', async (event, { conceptId, token, options }) => {
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getMemoriesForConcept(conceptId, options);
});

ipcMain.handle('graph-get-concept-timeline', async (event, { conceptId, token, limit }) => {
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getConceptLearningTimeline(conceptId, limit);
});

ipcMain.handle('graph-get-related-memories', async (event, { memoryId, token, relationType }) => {
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getRelatedMemories(memoryId, relationType);
});

ipcMain.handle('graph-get-memory-chain', async (event, { memoryId, token, direction, maxDepth }) => {
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getMemoryChain(memoryId, direction, maxDepth);
});

ipcMain.handle('graph-get-cross-concept-clusters', async (event, { token, limit }) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { error: 'Invalid token' };
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getCrossConceptClusters(userId, limit);
});

ipcMain.handle('graph-get-summarization-stats', async (event, { token }) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { error: 'Invalid token' };
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getSummarizationStats(userId);
});

ipcMain.handle('graph-get-memory-coverage', async (event, { token, limit }) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { error: 'Invalid token' };
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.getMemoryCoverage(userId, limit);
});

ipcMain.handle('graph-find-memory-gaps', async (event, { token, daysSinceLastMemory }) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { error: 'Invalid token' };
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.findMemoryGaps(userId, daysSinceLastMemory);
});

ipcMain.handle('graph-calculate-concept-mastery', async (event, { conceptId, token }) => {
  if (!summarizationGraph) return { error: 'Service not initialized' };
  return summarizationGraph.calculateConceptMasteryFromMemories(conceptId);
});
```

### Step 5: Update Renderer API

**File:** `src/renderer/api/graphApi.js` (add new methods)

```javascript
// Summarization Graph API

/**
 * Get full summarization hierarchy for a concept
 */
getSummarizationHierarchy: (conceptId, options = {}) =>
  ipcRenderer.invoke('graph-get-summarization-hierarchy', {
    conceptId,
    token: getToken(),
    options,
  }),

/**
 * Get all memories that summarize a concept
 */
getMemoriesForConcept: (conceptId, options = {}) =>
  ipcRenderer.invoke('graph-get-memories-for-concept', {
    conceptId,
    token: getToken(),
    options,
  }),

/**
 * Get learning timeline for a concept
 */
getConceptTimeline: (conceptId, limit = 50) =>
  ipcRenderer.invoke('graph-get-concept-timeline', {
    conceptId,
    token: getToken(),
    limit,
  }),

/**
 * Get memories related to a specific memory
 */
getRelatedMemories: (memoryId, relationType = null) =>
  ipcRenderer.invoke('graph-get-related-memories', {
    memoryId,
    token: getToken(),
    relationType,
  }),

/**
 * Get memory chain (prerequisite sequences)
 */
getMemoryChain: (memoryId, direction = 'both', maxDepth = 5) =>
  ipcRenderer.invoke('graph-get-memory-chain', {
    memoryId,
    token: getToken(),
    direction,
    maxDepth,
  }),

/**
 * Get cross-concept memory clusters
 */
getCrossConceptClusters: (limit = 10) =>
  ipcRenderer.invoke('graph-get-cross-concept-clusters', {
    token: getToken(),
    limit,
  }),

/**
 * Get summarization statistics
 */
getSummarizationStats: () =>
  ipcRenderer.invoke('graph-get-summarization-stats', {
    token: getToken(),
  }),

/**
 * Get memory coverage analysis
 */
getMemoryCoverage: (limit = 20) =>
  ipcRenderer.invoke('graph-get-memory-coverage', {
    token: getToken(),
    limit,
  }),

/**
 * Find gaps in memory coverage
 */
findMemoryGaps: (daysSinceLastMemory = 30) =>
  ipcRenderer.invoke('graph-find-memory-gaps', {
    token: getToken(),
    daysSinceLastMemory,
  }),

/**
 * Calculate concept mastery from memories
 */
calculateConceptMastery: (conceptId) =>
  ipcRenderer.invoke('graph-calculate-concept-mastery', {
    conceptId,
    token: getToken(),
  }),
```

### Step 6: Create Tests

**New File:** `src/__tests__/brain/SummarizationGraphService.test.js`

Test coverage for:
1. Memory node CRUD operations
2. Episode → Memory linking
3. Memory → Concept relationships
4. Memory → Memory relationships
5. Hierarchy queries
6. Timeline queries
7. Cross-concept clusters
8. Analytics and statistics
9. Memory gap detection
10. Mastery aggregation

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/main/utils/Neo4jAdapter.js` | Modify | Add indexes for ConsolidatedMemory and Episode |
| `src/main/utils/SummarizationGraphService.js` | Create | New service for all summarization graph operations |
| `src/main/utils/ConsolidationService.js` | Modify | Replace simple syncToNeo4j with comprehensive linking |
| `src/main/ipc/brainHandlers.js` | Modify | Add 10 new IPC handlers for summarization queries |
| `src/renderer/api/graphApi.js` | Modify | Add 10 new client-side methods |
| `src/__tests__/brain/SummarizationGraphService.test.js` | Create | Comprehensive test suite |
| `src/__tests__/brain/ConsolidationServiceGraph.test.js` | Create | Tests for ConsolidationService graph integration |

## Cypher Query Examples

### Create :CONSOLIDATED_INTO Relationship
```cypher
MATCH (e:Episode {id: $episodeId})
MATCH (m:ConsolidatedMemory {id: $memoryId})
MERGE (e)-[r:CONSOLIDATED_INTO]->(m)
SET r.weight = $weight,
    r.position = $position,
    r.contribution = $contribution,
    r.createdAt = datetime()
RETURN r
```

### Create :SUMMARIZES Relationship
```cypher
MATCH (m:ConsolidatedMemory {id: $memoryId})
MATCH (c:Concept {id: $conceptId})
MERGE (m)-[r:SUMMARIZES]->(c)
SET r.weight = $weight,
    r.confidence = $confidence,
    r.isPrimary = $isPrimary,
    r.aspectsCovered = $aspectsCovered,
    r.masteryContribution = $masteryContribution,
    r.createdAt = datetime()
RETURN r
```

### Get Summarization Hierarchy
```cypher
MATCH (c:Concept {id: $conceptId})
OPTIONAL MATCH (m:ConsolidatedMemory)-[rs:SUMMARIZES]->(c)
OPTIONAL MATCH (e:Episode)-[rc:CONSOLIDATED_INTO]->(m)
RETURN c,
       collect(DISTINCT {
         memory: m,
         summarizes: rs,
         episodes: collect({episode: e, consolidated: rc})
       }) as hierarchy
ORDER BY m.periodEnd DESC
```

### Get Concept Learning Timeline
```cypher
MATCH (c:Concept {id: $conceptId})<-[r:SUMMARIZES]-(m:ConsolidatedMemory)
RETURN m, r
ORDER BY m.periodEnd DESC
LIMIT $limit
```

### Calculate Aggregated Mastery
```cypher
MATCH (c:Concept {id: $conceptId})<-[r:SUMMARIZES]-(m:ConsolidatedMemory)
WHERE m.masteryAssessment IS NOT NULL
WITH c, collect({
  mastery: m.masteryAssessment,
  weight: r.weight,
  confidence: r.confidence,
  periodEnd: m.periodEnd
}) AS memories
RETURN c.id,
       c.name,
       size(memories) AS memoryCount,
       // Weight recent memories more heavily
       reduce(s = 0.0, mem IN memories |
         s + CASE mem.mastery
           WHEN 'mastered' THEN 1.0 * mem.weight * mem.confidence
           WHEN 'proficient' THEN 0.75 * mem.weight * mem.confidence
           WHEN 'developing' THEN 0.5 * mem.weight * mem.confidence
           WHEN 'beginner' THEN 0.25 * mem.weight * mem.confidence
           ELSE 0.0
         END
       ) / reduce(w = 0.0, mem IN memories | w + mem.weight * mem.confidence)
       AS aggregatedMastery
```

### Find Memory Gaps
```cypher
MATCH (c:Concept)<-[:MENTIONS_CONCEPT]-(n:Note)
WHERE n.userId = $userId
WITH c, count(n) AS noteCount
OPTIONAL MATCH (m:ConsolidatedMemory)-[:SUMMARIZES]->(c)
WHERE m.userId = $userId AND m.periodEnd > datetime() - duration({days: $daysSince})
WITH c, noteCount, count(m) AS recentMemories
WHERE noteCount > 0 AND recentMemories = 0
RETURN c.id, c.name, noteCount, recentMemories
ORDER BY noteCount DESC
LIMIT $limit
```

## Integration Points

### 1. LearningBrainAgent Integration
The `runConsolidation()` method should call the enhanced sync:
```javascript
// In LearningBrainAgent.js runConsolidation()
const result = await this.consolidationService.consolidateEpisodes(userId, token, options);
// Graph sync happens automatically via enhanced syncToNeo4j
```

### 2. Knowledge Dashboard Integration
Add new components to display summarization data:
- Memory timeline for each concept
- Summarization coverage heat map
- Memory gap alerts

### 3. Study Session Integration
Use aggregated mastery in recommendations:
```javascript
const mastery = await graphApi.calculateConceptMastery(conceptId);
// Use in study scheduling
```

## Migration Strategy

For existing data:
1. Run a one-time migration script to sync existing consolidated memories to Neo4j
2. Create relationships for existing `source_episodes` data
3. Backfill :SUMMARIZES relationships based on `conceptId` fields

## Performance Considerations

1. **Batch Operations**: Use `UNWIND` for bulk episode linking
2. **Lazy Loading**: Don't load full episode details in hierarchy queries
3. **Caching**: Cache mastery calculations (TTL: 1 hour)
4. **Pagination**: Limit hierarchy depth and episode counts

## Future Enhancements

1. **Memory Versioning**: Track changes to memories over time
2. **Collaborative Memories**: Share memories between users
3. **Memory Embeddings**: Store embeddings for semantic search
4. **Memory Visualization**: Timeline and graph visualizations in UI

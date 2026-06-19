## Graph Database (Neo4j)

Neo4j integration provides knowledge graph features. Uses a hybrid architecture where SQLite remains the primary store and Neo4j provides graph-specific capabilities.

**Architecture:**
- SQLite (primary): All CRUD operations, categories, groups, user data, settings
- Neo4j (secondary): Knowledge graph, learning paths, concept relationships, semantic search

**Key Files in `src/main/utils/`:**
| File | Purpose |
|------|---------|
| `GraphInterface.js` | Abstraction layer, delegates to adapters |
| `Neo4jAdapter.js` | Neo4j implementation (~1500 lines) |
| `GraphEmbeddingManager.js` | Entity-level semantic search facade (the primary vector store; replaces ChromaDB) |
| `VectorManager.js` | Book-chunk embed + search (RAG) |
| `EmbeddingService.js` | Builds the provider-backed embedding function |
| `GraphLearningFeatures.js` | Learning paths, weak concepts, entity resolution |
| `SummarizationGraphService.js` | Memory consolidation graph patterns (~700 lines) |
| `ConsolidationService.js` | LLM-powered episode → memory consolidation |

**IPC Layer:**
- `src/main/ipc/graphHandlers.js` - All graph IPC handlers
- `src/renderer/api/graphApi.js` - Renderer-side API

**Neo4j-Exclusive Features:**
1. **Learning Paths**: Concept prerequisites, personalized learning routes
2. **Weak Concepts Detection**: Find concepts with low mastery or high error rates
3. **Entity Resolution**: Link related concepts across notes automatically
4. **Knowledge Graph Visualization**: Nodes and edges for graph visualization
5. **Mastery Tracking**: Track concept mastery over time with progress analytics
6. **Semantic Search**: Store embeddings in the graph store and query via the adapter's native vector index — Kùzu HNSW (`QUERY_VECTOR_INDEX`) or Neo4j cosine. This is the sole vector store; ChromaDB has been removed.
7. **Memory Consolidation Graph**: Episodes → ConsolidatedMemory → Concepts (see below)

**Configuration (electron-store):**
```javascript
{
  "graph": {
    "enabled": true,         // Toggle for development/troubleshooting
    "adapterType": "neo4j",  // or "graphiti" in future
    "connectionUri": "bolt://localhost:7687",
    "username": "neo4j",
    "password": "password"
  }
}
```

**Usage in Components:**
```javascript
import graphApi from '../api/graphApi';

// Learning paths
const path = await graphApi.getPersonalizedLearningPath('calculus_id', token);

// Weak concepts
const weak = await graphApi.detectWeakConcepts(10, token);

// Entity resolution
const related = await graphApi.resolveRelatedConcepts(token);

// Knowledge graph visualization
const graph = await graphApi.getKnowledgeGraphData(null, token);
```

**Requires Neo4j server:**
```bash
# Using Docker
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password neo4j:latest

# Or install Neo4j Desktop from https://neo4j.com/download/
```

**UI Components (`src/renderer/components/graph/`):**
| Component | Purpose |
|-----------|---------|
| `LearningPathPanel` | Displays learning path with prerequisites for target concept |
| `WeakConceptsPanel` | Shows concepts needing practice (low mastery, high errors) |
| `KnowledgeGraphPanel` | Interactive force-directed graph visualization |

**Auto-Sync:** Notes, books, bookmarks, and chats are automatically synced to Neo4j on create/update when enabled.

### Memory Consolidation Graph (SummarizationGraphService)

The Memory Consolidation Graph implements a three-tier architecture inspired by [Graphiti](https://github.com/getzep/graphiti) for summarizing learning episodes into higher-level memories.

**Node Types:**
| Node | Description |
|------|-------------|
| `Episode` | Raw learning events (reviews, sessions, book opens, etc.) |
| `ConsolidatedMemory` | LLM-synthesized summaries of episodes |
| `Concept` | Learning concepts linked to memories |
| `LearnerProfile` | User profile with learning patterns |

**Relationship Types:**
| Relationship | Description | Properties |
|--------------|-------------|------------|
| `:CONSOLIDATED_INTO` | Episode → ConsolidatedMemory | weight, contributionType, t_valid, t_created |
| `:SUMMARIZES` | ConsolidatedMemory → Concept | weight, isPrimary, aspectsCovered, masteryContribution |
| `:MEMORY_RELATES` | ConsolidatedMemory ↔ ConsolidatedMemory | relationType, strength, confidence |
| `:HAS_MEMORY` | LearnerProfile → ConsolidatedMemory | - |

**Contribution Types (Episode → Memory):**
- `primary`: Direct learning activity (reviews, quizzes)
- `supporting`: Context activity (book opens, notes)
- `contextual`: Background events (session start/end)

**Mastery Contribution Levels:**
- `high`: Strong positive impact (correct answers, box promotions)
- `medium`: Moderate impact (regular reviews)
- `low`: Minimal impact (hints used, incorrect answers)
- `negative`: Setbacks (demotions, repeated failures)

**Key Methods in SummarizationGraphService:**
```javascript
import SummarizationGraphService from '../utils/SummarizationGraphService';

const service = new SummarizationGraphService(neo4jAdapter);

// Get full hierarchy: Concept → Memories → Episodes
const hierarchy = await service.getSummarizationHierarchy(conceptId, userId, {
  includeEpisodes: true,
  maxMemories: 10,
  maxEpisodesPerMemory: 5,
});

// Get learning timeline for a concept
const timeline = await service.getConceptLearningTimeline(conceptId, userId, 50);

// Calculate mastery from memory data (with recency bias)
const mastery = await service.calculateConceptMasteryFromMemories(conceptId, userId);
// Returns: { aggregatedMastery: 0.75, masteryLevel: 'proficient', memoryCount: 5 }

// Find gaps in learning coverage
const gaps = await service.findMemoryGaps(userId, 30);
// Returns concepts not reviewed in last 30 days

// Get cross-concept pattern memories
const clusters = await service.getCrossConceptClusters(userId, 10);
```

**IPC Handlers for Summarization:**
| Handler | Type | Purpose |
|---------|------|---------|
| `graph-summarization-available` | sync | Check if service is available |
| `graph-get-summarization-hierarchy` | invoke | Get concept → memories → episodes |
| `graph-get-memories-for-concept` | invoke | Get memories linked to concept |
| `graph-get-concept-timeline` | invoke | Get learning timeline |
| `graph-get-related-memories` | invoke | Get memories by relationship type |
| `graph-get-memory-chain` | invoke | Traverse memory relationships |
| `graph-get-cross-concept-clusters` | invoke | Get cross-concept memories |
| `graph-get-summarization-stats` | invoke | Get memory statistics |
| `graph-get-memory-coverage` | invoke | Get coverage by concept |
| `graph-find-memory-gaps` | invoke | Find concepts needing review |
| `graph-calculate-concept-mastery` | invoke | Calculate mastery from memories |
| `graph-get-source-episodes` | invoke | Get episodes for a memory |
| `graph-get-concepts-for-memory` | invoke | Get concepts linked to memory |

**Renderer API:**
```javascript
import graphApi from '../api/graphApi';

// Check availability
const available = graphApi.isSummarizationAvailable();

// Get hierarchy for a concept
const hierarchy = await graphApi.getSummarizationHierarchy(conceptId, token, {
  includeEpisodes: true,
});

// Get timeline
const timeline = await graphApi.getConceptTimeline(conceptId, token, 50);

// Calculate mastery
const mastery = await graphApi.calculateConceptMastery(conceptId, token);

// Find memory gaps
const gaps = await graphApi.findMemoryGaps(token, 30);

// Get statistics
const stats = await graphApi.getSummarizationStats(token);
```

**Consolidation Flow:**
```
1. Episodes collected → EpisodeCollector.js
   (REVIEW_COMPLETED, SESSION_ENDED, etc.)

2. Heartbeat triggers → LearningBrainAgent.js
   runConsolidation()

3. Episodes grouped → ConsolidationService.js
   groupByConceptClusters() with context shift detection

4. LLM synthesis → AIProviderManager
   createMemoryConsolidationPrompt()

5. Graph sync → SummarizationGraphService
   - upsertConsolidatedMemory()
   - linkEpisodesToMemory()
   - linkMemoryToConcepts()
```

**Test Commands:**
```bash
# Run summarization graph tests (76 tests)
npm test -- --testPathPattern=brain/SummarizationGraphService
npm test -- --testPathPattern=brain/brainHandlersSummarization
```

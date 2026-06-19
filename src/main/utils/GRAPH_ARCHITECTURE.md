# Graph Database Architecture

## Hybrid Database Strategy

SmartReader uses a **hybrid database architecture** where SQLite remains the primary data store and Neo4j provides optional knowledge graph features.

### SQLite (Primary) - `src/main/db/`

Handles all basic CRUD operations:

| Entity | Manager | Purpose |
|--------|---------|---------|
| Users | DBManager | Authentication, profiles |
| Books | BookManager | Book metadata, storage keys |
| Notes | NoteJsonManager | Note content, created_at |
| Annotations | - | Highlights, underlines |
| Bookmarks | BookmarkManager | URL bookmarks |
| Bookmark Groups | BookmarkManager | Hierarchical categories |
| History | - | Browsing history |
| Chats | ChatManager | Chat sessions |
| Messages | MessageManager | Chat messages |
| Prompts | PromptManager | Saved prompts |
| Vocabulary | VocabularyManager | Word definitions |
| Vocabulary Sets | VocabularyManager | Word groupings |
| Leitner Items | VocabularyManager | Spaced repetition state |
| Quiz Problems | QuizProblemJsonManager | Quiz data |
| Mood Boards | MoodBoardJsonManager | Visual boards |
| Bookshelves | - | Book organization |

### Neo4j (Optional) - `src/main/utils/GraphInterface.js`

Provides **knowledge graph features** that SQLite can't efficiently handle:

| Feature | Description |
|---------|-------------|
| **Concept Graph** | Nodes for concepts, MENTIONS_CONCEPT relationships |
| **Learning Paths** | PREREQUISITE_OF relationships between concepts |
| **Semantic Search** | Embedding vectors, similarity queries |
| **Knowledge Timeline** | Bi-temporal queries (eventTime, systemTime) |
| **Cross-Entity Links** | Relationships like NOTE_REFERENCES_NOTE |
| **Learning Analytics** | Session tracking, focus patterns |

## Integration Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                        │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │ NoteJsonApi │   │   chatApi   │   │  graphApi   │       │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          │      IPC        │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐   │
│  │NoteJsonMgr  │   │ ChatManager │   │ GraphInterface  │   │
│  └──────┬──────┘   └──────┬──────┘   └────────┬────────┘   │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  ┌─────────────────────────────┐    ┌─────────────────┐    │
│  │         SQLite              │    │ Neo4jAdapter    │    │
│  │   (Primary - Always On)     │    │ (Optional)      │    │
│  └─────────────────────────────┘    └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Both databases are used together. Neo4j requires a running server:

```javascript
// In electron-store
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

When `graph.enabled` is false, the app works with SQLite only (useful for development without Neo4j server).

## Data Flow

### Creating a Note

1. **SQLite (always)**: `NoteJsonManager.createNoteFromJson(note, token)`
2. **Neo4j (if enabled)**: `graphApi.createNote(note, token)` - adds to knowledge graph

### Searching Notes

1. **Text Search**: Use SQLite LIKE queries (fast, local)
2. **Semantic Search** (if Neo4j enabled): Use `graphApi.findSimilar(embedding, ['Note'])`

### Spaced Repetition

1. **Leitner State**: Stored in SQLite `leitner_item` table
2. **Knowledge Graph** (if Neo4j enabled): Tracks REVIEWED relationships with timestamps

## Files

| File | Purpose |
|------|---------|
| `GraphInterface.js` | Abstraction layer, delegates to adapters |
| `Neo4jAdapter.js` | Neo4j implementation (~1500 lines) |
| `GraphEmbeddingManager.js` | Entity-level semantic search (primary vector store; ChromaDB removed) |
| `VectorManager.js` | Book-chunk embed + search (RAG over book content) |
| `EmbeddingService.js` | Builds the provider-backed embedding function |
| `GraphLearningFeatures.js` | Learning paths, weak concepts, entity resolution |
| `graphHandlers.js` | IPC handlers for all graph operations |
| `graphApi.js` | Renderer-side API for components |

## Learning Features (Neo4j Exclusive)

These features require Neo4j's graph capabilities:

### Learning Paths
```javascript
// Create a concept with prerequisites
await graphApi.createConceptWithPrereqs(
  { name: 'Calculus', domain: 'math', difficulty: 'advanced' },
  ['algebra_concept_id', 'trigonometry_concept_id'],
  token
);

// Get personalized learning path
const path = await graphApi.getPersonalizedLearningPath('calculus_id', token);
// Returns: { path: [...], estimatedMinutes: 120, nextConcept: {...} }
```

### Weak Concepts Detection
```javascript
// Find concepts that need more practice
const weakConcepts = await graphApi.detectWeakConcepts(10, token);
// Returns concepts with low mastery, high error rates, or blocking dependencies

// Get concepts where user makes frequent mistakes
const errorProne = await graphApi.getErrorProneTopics(30, token);
```

### Entity Resolution
```javascript
// Find related concepts across notes
const related = await graphApi.resolveRelatedConcepts(token);
// Returns pairs of concepts that appear together frequently

// Link concepts
await graphApi.linkConcepts(concept1Id, concept2Id, 'similar', 0.8);

// Extract concepts from text
const extracted = await graphApi.extractConceptsFromText(noteContent, token);
// Returns: { existing: [...], suggested: [...] }
```

### Knowledge Graph Visualization
```javascript
// Get full knowledge graph
const graph = await graphApi.getKnowledgeGraphData(null, token);
// Returns: { nodes: [...], edges: [...] }

// Get focused view around a concept
const focused = await graphApi.getKnowledgeGraphData('concept_id', token);
```

### Mastery Tracking
```javascript
// Update mastery after review
await graphApi.updateConceptMastery('concept_id', 'correct', token);

// Get progress over time
const progress = await graphApi.getMasteryProgress(30, token);
// Returns daily accuracy snapshots
```

## Usage in Components

```javascript
import graphApi from '../api/graphApi';
import customStorage from '../store/customStorage';

// Check if graph features are enabled
const graphEnabled = customStorage.getStoreValue('graph.enabled');

// Only call graph API if enabled
if (graphEnabled && graphApi.isConnected()) {
  await graphApi.createNote(note, token);
}
```

## Future: Graphiti Adapter

The `GraphInterface` abstraction allows swapping Neo4j for Graphiti:

```javascript
// In settings or initialization
const adapterType = store.get('graph.adapterType') || 'neo4j';
await graphInterface.initialize(adapterType, store);
```

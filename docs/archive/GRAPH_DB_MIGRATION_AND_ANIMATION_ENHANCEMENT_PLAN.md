# Hybrid Database Architecture & Animation Enhancement Plan
## SQLite + Neo4j + Universal Animation System

---

## Executive Summary

This document outlines a comprehensive plan to:

1. **Add Neo4j alongside SQLite** - SQLite remains primary for CRUD; Neo4j adds knowledge graph capabilities
2. **Extend animations beyond browser** - Bring StudyEnhancer capabilities to Notes, PDF, EPUB, and Quiz views
3. **Create a unified semantic layer** - Leverage graph relationships for intelligent learning features
4. **Enhance the learning experience** - New features enabled by graph structure and universal animations

---

## Part 1: Architecture Overview

### 1.1 Hybrid Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HYBRID DATABASE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │      SQLite         │  │    ChromaDB     │  │      Neo4j          │ │
│  │  (Primary Storage)  │  │ (Vector Search) │  │ (Knowledge Graph)   │ │
│  │                     │  │                 │  │                     │ │
│  │  - Notes (JSON)     │  │ - Embeddings    │  │ - Concepts          │ │
│  │  - Books            │  │ - Semantic      │  │ - Learning Paths    │ │
│  │  - Bookmarks        │  │   Search        │  │ - Relationships     │ │
│  │  - Messages         │  │                 │  │ - Mastery Tracking  │ │
│  │  - Vocabulary       │  │                 │  │ - Entity Resolution │ │
│  │  - Leitner Items    │  │                 │  │ - Graph Queries     │ │
│  │  - Quiz Problems    │  │                 │  │                     │ │
│  │  - MoodBoards       │  │                 │  │                     │ │
│  │  - User Settings    │  │                 │  │                     │ │
│  │  - Categories       │  │                 │  │                     │ │
│  └─────────────────────┘  └─────────────────┘  └─────────────────────┘ │
│           │                       │                      │              │
│           │      ALWAYS ON        │     OPTIONAL         │   OPTIONAL   │
│           ▼                       ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Application Layer                            │   │
│  │  - SQLite: All CRUD operations (required)                       │   │
│  │  - ChromaDB: Semantic search (optional, requires Python server) │   │
│  │  - Neo4j: Knowledge graph features (optional, enhances learning)│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Each Database Handles

| Feature | SQLite | ChromaDB | Neo4j |
|---------|--------|----------|-------|
| Store notes, books, bookmarks | ✓ Primary | - | Sync copy |
| Store categories, groups, settings | ✓ Primary | - | - |
| Store Leitner box state | ✓ Primary | - | - |
| Vector embeddings | - | ✓ | ✓ |
| Semantic text search | - | ✓ | ✓ |
| Concept extraction | - | - | ✓ |
| Learning paths | - | - | ✓ |
| Weak concept detection | - | - | ✓ |
| Entity resolution | - | - | ✓ |
| Knowledge graph visualization | - | - | ✓ |
| Mastery tracking over time | - | - | ✓ |
| Graph traversal queries | - | - | ✓ |

### 1.3 Data Flow

```
Creating a Note:
────────────────
1. SQLite (always): NoteJsonManager.createNoteFromJson(note, token)
2. ChromaDB (if enabled): chromaManager.addNodeToVecterDB(note, token)
3. Neo4j (if enabled): graphApi.createNote(note, token) → adds to knowledge graph

Searching Notes:
────────────────
1. Text search: SQLite LIKE query (fast, always available)
2. Semantic search: ChromaDB OR Neo4j (if enabled)
3. Graph-aware search: Neo4j (includes related concepts)

Leitner Review:
───────────────
1. SQLite: Primary source for box state, next review dates
2. Neo4j (if enabled): Tracks REVIEWED relationships, mastery analytics
```

---

## Part 2: Neo4j Knowledge Graph Schema

### 2.1 Node Types

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NEO4J KNOWLEDGE GRAPH                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  NODES (Entities):                                                       │
│  ─────────────────                                                       │
│  (:User {id, email, preferences})                                        │
│  (:Note {id, title, content, type, embedding[]})                        │
│  (:NoteCard {id, text, cardIndex, embedding[]})                         │
│  (:Book {id, title, author, format})                                    │
│  (:BookChunk {id, text, position, cfi, pageNum, embedding[]})           │
│  (:Bookmark {id, title, description, url, embedding[]})                 │
│  (:Vocabulary {id, word, definition, embedding[]})                      │
│  (:Message {id, content, role, embedding[]})                            │
│  (:Chat {id, description})                                               │
│  (:QuizProblem {id, question, answer, embedding[]})                     │
│  (:MoodBoard {id, name, layout})                                        │
│  (:LeitnerItem {id, box, nextReview, skips, flips})                     │
│  (:Concept {id, name, type, masteryLevel, embedding[]})  ← Graph-only   │
│  (:LearningSession {id, activityType, startTime, endTime}) ← Graph-only │
│                                                                          │
│  RELATIONSHIPS:                                                          │
│  ───────────────                                                         │
│  (:User)-[:OWNS]->(:Note|:Book|:Bookmark|:Vocabulary|:MoodBoard)        │
│  (:User)-[:STUDIES]->(:LeitnerItem)                                      │
│  (:User)-[:HAD_SESSION]->(:LearningSession)                             │
│                                                                          │
│  (:Note)-[:FROM_SOURCE {cfi, pageNum}]->(:Book|:Bookmark|:Chat)         │
│  (:Note)-[:HAS_CARD {index}]->(:NoteCard)                               │
│  (:Note)-[:MENTIONS_CONCEPT {count, importance}]->(:Concept)            │
│  (:Note)-[:SIMILAR_TO {score}]->(:Note)                                 │
│  (:Note)-[:RELATED_TO {reason}]->(:Note)                                │
│                                                                          │
│  (:Concept)-[:REQUIRES]->(:Concept)           ← Prerequisites           │
│  (:Concept)-[:RELATED_TO {type, strength}]->(:Concept)                  │
│                                                                          │
│  (:Vocabulary)-[:USED_IN]->(:Note|:BookChunk)                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 What Neo4j Enables (Graph-Only Features)

| Capability | SQLite | Neo4j |
|------------|--------|-------|
| Find notes about topic X | ✓ LIKE query | ✓ + related concepts |
| Related notes | ✗ | ✓ Via shared concepts, SIMILAR_TO |
| "Notes mentioning terms from this book" | ✗ | ✓ Graph traversal |
| "Vocabulary words used in my notes" | ✗ | ✓ USED_IN relationship |
| "Quiz problems for weak concepts" | ✗ | ✓ Concept mastery → Quiz |
| "Concepts I haven't mastered" | ✗ | ✓ masteryLevel < 70 |
| Learning path to concept | ✗ | ✓ REQUIRES traversal |
| Knowledge state at point in time | ✗ | ✓ Bi-temporal queries |

---

## Part 3: Implementation Status

### 3.1 Phase 1: Foundation ✅ COMPLETE

| Component | Status | Files |
|-----------|--------|-------|
| GraphInterface abstraction | ✅ Done | `GraphInterface.js` |
| Neo4jAdapter implementation | ✅ Done | `Neo4jAdapter.js` (~1500 lines) |
| GraphEmbeddingManager | ✅ Done | `GraphEmbeddingManager.js` |
| GraphLearningFeatures | ✅ Done | `GraphLearningFeatures.js` |
| IPC handlers | ✅ Done | `graphHandlers.js` (~860 lines) |
| Renderer API | ✅ Done | `graphApi.js` (~770 lines) |
| Settings in customStorage | ✅ Done | `customStorage.js` |
| Tests | ✅ Done | 240 tests passing |
| Documentation | ✅ Done | `CLAUDE.md`, `GRAPH_ARCHITECTURE.md` |

### 3.2 Phase 2: UI Integration (Next)

| Task | Status | Description |
|------|--------|-------------|
| Settings panel for Neo4j config | Pending | Add to SettingsPanel.js |
| Learning path UI component | Pending | Visualize concept prerequisites |
| Weak concepts dashboard | Pending | Show concepts needing practice |
| Knowledge graph visualization | Pending | Interactive node-edge graph |
| Auto-sync SQLite → Neo4j | Pending | Sync on note/book create |

### 3.3 Phase 3: Animation Integration (Future)

| Task | Status | Description |
|------|--------|-------------|
| AnimationCore module | Pending | Extract from StudyEnhancer |
| EPUBAdapter | Pending | Animation in EPUB reader |
| PDFAdapter | Pending | Animation in PDF reader |
| NoteAdapter | Pending | Animation in Notes view |
| LeitnerTransitionEffect | Pending | Box progression animation |

---

## Part 4: Configuration

### 4.1 Electron Store Settings

```javascript
{
  "graph": {
    "enabled": true,         // Master toggle
    "adapterType": "neo4j",  // or "graphiti" in future
    "connectionUri": "bolt://localhost:7687",
    "username": "neo4j",
    "password": "password"
  }
}
```

### 4.2 Runtime Requirements

| Service | Required | Notes |
|---------|----------|-------|
| SQLite | Always | Built into app via better-sqlite3 |
| ChromaDB | Optional | Python server: `chroma run --path chroma` |
| Neo4j | Optional | Docker or Neo4j Desktop |

**Starting Neo4j:**
```bash
# Docker (recommended for development)
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password neo4j:latest

# Or use Neo4j Desktop from https://neo4j.com/download/
```

---

## Part 5: API Reference

### 5.1 Graph-Powered Learning Features

```javascript
import graphApi from '../api/graphApi';

// Learning Paths
const concept = await graphApi.createConceptWithPrereqs(
  { name: 'Calculus', domain: 'math', difficulty: 'advanced' },
  ['algebra_id', 'trig_id'],
  token
);
const path = await graphApi.getPersonalizedLearningPath('calculus_id', token);
// Returns: { path: [...], estimatedMinutes: 120, nextConcept: {...} }

// Weak Concepts Detection
const weakConcepts = await graphApi.detectWeakConcepts(10, token);
const errorProne = await graphApi.getErrorProneTopics(30, token);

// Entity Resolution
const related = await graphApi.resolveRelatedConcepts(token);
await graphApi.linkConcepts(concept1Id, concept2Id, 'similar', 0.8);
const extracted = await graphApi.extractConceptsFromText(content, token);

// Knowledge Graph Visualization
const graph = await graphApi.getKnowledgeGraphData(null, token);
// Returns: { nodes: [...], edges: [...] }

// Mastery Tracking
await graphApi.updateConceptMastery('concept_id', 'correct', token);
const progress = await graphApi.getMasteryProgress(30, token);

// Semantic Search (mirrors ChromaDB)
const books = await graphApi.semanticSearchBooks(query, token);
const notes = await graphApi.semanticSearchNotes(query, token);
```

### 5.2 Usage Pattern in Components

```javascript
import graphApi from '../api/graphApi';
import customStorage from '../store/customStorage';

// Check if graph features are enabled before using
const graphEnabled = customStorage.getGraphEnabled();

if (graphEnabled && graphApi.isConnected()) {
  // Use graph features
  const weakConcepts = await graphApi.detectWeakConcepts(10, token);
} else {
  // Fallback to SQLite-only behavior
}
```

---

## Part 6: Future Animation System

### 6.1 Universal Animation Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL ANIMATION LAYER                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    AnimationCore (Future Module)                  │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │ WordManager │  │ CloneEngine │  │ PathEngine  │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                    EffectLibrary                             │ │   │
│  │  │  • WordConstellation (Smart Summary) - existing              │ │   │
│  │  │  • ConceptNetwork (Mind Map) - existing                      │ │   │
│  │  │  • LeitnerTransition (Box progression) - planned             │ │   │
│  │  │  • RelationshipPulse (Graph connections) - planned           │ │   │
│  │  │  • VocabularyHighlight (Cross-reference) - planned           │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ADAPTERS:                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │BrowserAdapter│ │ EPUBAdapter  │ │ PDFAdapter   │ │ NoteAdapter  │   │
│  │ (existing)   │ │ (planned)    │ │ (planned)    │ │ (planned)    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

This hybrid architecture provides:

1. **Reliability**: SQLite as primary store - app always works
2. **Optional enhancements**: Neo4j adds powerful features when available
3. **Graceful degradation**: App works without Neo4j, just without graph features
4. **Future-proof**: GraphInterface abstraction allows swapping to Graphiti or other backends

The Note system remains central, but when Neo4j is enabled, notes become **connected nodes in a knowledge graph** with relationships to concepts, learning paths, and other notes.

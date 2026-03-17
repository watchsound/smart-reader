# ChromaDB to Neo4j Migration Plan

## Goal

Consolidate vector storage from ChromaDB to Neo4j, eliminating the dual-system complexity while maintaining all existing functionality.

## Current State

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SQLite    │     │  ChromaDB   │     │    Neo4j    │
│  (primary)  │     │  (vectors)  │     │   (graph)   │
└─────────────┘     └─────────────┘     └─────────────┘
      ↑                   ↑                   ↑
  All CRUD            Embeddings          Concepts
  Book metadata       Book chunks         Relationships
  Notes, Vocab        Note vectors        Learning paths
  User data           Message vectors     (optional vectors)
```

## Target State

```
┌─────────────┐                         ┌─────────────┐
│   SQLite    │                         │    Neo4j    │
│  (primary)  │                         │  (vectors   │
│             │                         │  + graph)   │
└─────────────┘                         └─────────────┘
      ↑                                       ↑
  All CRUD                               Embeddings
  Book metadata                          Book chunks
  Notes, Vocab                           Concepts
  User data                              Relationships
                                         Learning paths
```

---

## Neo4j Schema for Vector Storage

### Node Types

```cypher
// Book chunks (replaces ChromaDB book storage)
(:Chunk {
  id: STRING,           // UUID
  bookId: STRING,       // Reference to SQLite book.id
  userId: INTEGER,      // Owner
  text: STRING,         // Chunk content (max ~500 tokens)
  chunkIndex: INTEGER,  // Order in book
  pageNum: INTEGER,     // Page number (for PDF)
  cfi: STRING,          // CFI location (for EPUB)
  embedding: LIST<FLOAT>, // Vector (1536 dim for OpenAI, 768 for others)
  embeddingModel: STRING, // Model used for embedding
  createdAt: DATETIME
})

// Note embeddings (replaces ChromaDB note storage)
(:NoteVector {
  id: STRING,
  noteId: STRING,       // Reference to SQLite note_json.id
  userId: INTEGER,
  text: STRING,         // Note content (for display)
  embedding: LIST<FLOAT>,
  embeddingModel: STRING,
  createdAt: DATETIME
})

// Message embeddings (replaces ChromaDB message storage)
(:MessageVector {
  id: STRING,
  messageId: STRING,    // Reference to SQLite message.id
  chatId: STRING,
  userId: INTEGER,
  text: STRING,
  embedding: LIST<FLOAT>,
  embeddingModel: STRING,
  createdAt: DATETIME
})

// Bookmark embeddings (already in Neo4j, enhance)
(:Bookmark {
  id: STRING,
  // ... existing fields ...
  embedding: LIST<FLOAT>,
  embeddingModel: STRING
})
```

### Indexes for Performance

```cypher
// Vector indexes (Neo4j 5.11+)
CREATE VECTOR INDEX chunk_embedding_index IF NOT EXISTS
FOR (c:Chunk) ON (c.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}};

CREATE VECTOR INDEX note_embedding_index IF NOT EXISTS
FOR (n:NoteVector) ON (n.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}};

CREATE VECTOR INDEX message_embedding_index IF NOT EXISTS
FOR (m:MessageVector) ON (m.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}};

// Regular indexes for filtering
CREATE INDEX chunk_book_index IF NOT EXISTS FOR (c:Chunk) ON (c.bookId);
CREATE INDEX chunk_user_index IF NOT EXISTS FOR (c:Chunk) ON (c.userId);
CREATE INDEX note_user_index IF NOT EXISTS FOR (n:NoteVector) ON (n.userId);
CREATE INDEX message_chat_index IF NOT EXISTS FOR (m:MessageVector) ON (m.chatId);
```

### Relationships

```cypher
// Book structure
(:Book)-[:HAS_CHUNK]->(:Chunk)
(:Chunk)-[:NEXT]->(:Chunk)  // Sequential order

// Learning connections (created on-demand)
(:Chunk)-[:MENTIONS]->(:Concept)
(:LearningPoint)-[:FROM_CHUNK]->(:Chunk)
```

---

## Migration Steps

### Phase 1: Extend Neo4jAdapter (No Breaking Changes)

**Files to modify:**
- `src/main/utils/Neo4jAdapter.js`
- `src/main/utils/GraphEmbeddingManager.js`

**New methods in Neo4jAdapter:**

```javascript
// Chunk operations
async createChunk(bookId, chunk, embedding, token)
async getChunksByBook(bookId, token)
async deleteChunksByBook(bookId, token)

// Vector search with native index
async vectorSearch(embedding, nodeType, filters, limit, token)

// Batch operations for migration
async batchCreateChunks(bookId, chunks, token)
```

**New methods in GraphEmbeddingManager:**

```javascript
// Replace ChromaManager.addBookToVecterDB
async addBookChunks(bookId, bookPath, format, maxChunkSize, token)

// Replace ChromaManager.getBookContentByQuery
async searchBookContent(query, bookId, limit, token)

// Replace ChromaManager.addNodeToVecterDB
async addNoteEmbedding(noteId, token)

// Replace ChromaManager.getMessageByQuery
async searchMessages(query, chatId, limit, token)
```

### Phase 2: Create Compatibility Layer

**New file:** `src/main/utils/VectorManager.js`

```javascript
/**
 * VectorManager - Unified interface for vector operations
 *
 * Abstracts the underlying storage (Neo4j or ChromaDB)
 * Allows gradual migration without breaking existing code
 */
class VectorManager {
  constructor() {
    this.useNeo4j = true;  // Feature flag
    this.graphEmbedding = null;
    this.chromaManager = null;
  }

  async setup(store, embeddingFunction) {
    if (this.useNeo4j) {
      this.graphEmbedding = new GraphEmbeddingManager();
      await this.graphEmbedding.setup(store, embeddingFunction);
    } else {
      // Fallback to ChromaDB
      this.chromaManager = chromaManager;
      await this.chromaManager.setupChroma(store);
    }
  }

  // Unified API - delegates to appropriate backend
  async addBookToVectorDB(store, mainWin, sender, book, token) {
    if (this.useNeo4j) {
      return this.graphEmbedding.addBookChunks(book.id, book.path, book.format, 500, token);
    }
    return this.chromaManager.addBookToVecterDB(store, mainWin, sender, book, token);
  }

  async searchBookContent(query, bookId, limit, token) {
    if (this.useNeo4j) {
      return this.graphEmbedding.searchBookContent(query, bookId, limit, token);
    }
    return this.chromaManager.getBookContentByQuery(...);
  }

  // ... other unified methods
}
```

### Phase 3: Update main.ts References

Replace direct `chromaManager` calls with `vectorManager`:

```javascript
// Before
import chromaManager from './utils/ChromaManager';
await chromaManager.addBookToVecterDB(store, mainWin, sender, book, token);

// After
import vectorManager from './utils/VectorManager';
await vectorManager.addBookToVectorDB(store, mainWin, sender, book, token);
```

### Phase 4: Data Migration Script

**New file:** `src/main/utils/migrateChromaToNeo4j.js`

```javascript
/**
 * One-time migration script to move existing ChromaDB data to Neo4j
 */
async function migrateChromaToNeo4j(store, token) {
  const chromaClient = new ChromaClient({ path: store.get('chroma_url') });
  const collection = await chromaClient.getCollection({ name: 'my_collection' });

  // Get all documents from ChromaDB
  const allDocs = await collection.get();

  let migrated = 0;
  for (let i = 0; i < allDocs.ids.length; i++) {
    const id = allDocs.ids[i];
    const metadata = allDocs.metadatas[i];
    const document = allDocs.documents[i];
    const embedding = allDocs.embeddings?.[i];

    // Determine type and migrate
    if (metadata.type === 'book_chunk') {
      await graphEmbedding.createChunk(metadata.bookId, {
        text: document,
        chunkIndex: metadata.chunkIndex,
        pageNum: metadata.pageNum,
      }, embedding, token);
    } else if (metadata.type === 'note') {
      await graphEmbedding.addNoteEmbedding(metadata.noteId, token);
    }
    // ... other types

    migrated++;
    if (migrated % 100 === 0) {
      console.log(`Migrated ${migrated}/${allDocs.ids.length}`);
    }
  }

  return { migrated, total: allDocs.ids.length };
}
```

### Phase 5: Remove ChromaDB Dependencies

After migration is complete and tested:

1. Remove `chromadb` from `package.json`
2. Delete `src/main/utils/ChromaManager.js`
3. Delete `src/main/utils/chromaUtil.js`
4. Update `VectorManager.js` to remove ChromaDB fallback
5. Update documentation

---

## Embedding Strategy

### When to Generate Embeddings

| Event | Generate Embedding? | Rationale |
|-------|---------------------|-----------|
| Book import | Optional (user setting) | Expensive for large books |
| Note creation | Yes | Small content, enables search |
| Message save | Yes | Enables chat history search |
| Bookmark create | Yes | Enables semantic bookmark search |
| Learning plan creation | Yes (for selected content) | Required for learning features |

### Lazy Embedding for Books

```javascript
async addBookChunks(bookId, bookPath, format, maxChunkSize, token) {
  const userId = getUserIdFromToken(token);
  const generateEmbeddings = this.store.get(`embedBooks_${userId}`) ?? false;

  // Parse book into chunks
  const chunks = await this.parseBook(bookPath, format, maxChunkSize);

  for (const chunk of chunks) {
    let embedding = null;

    // Only generate embeddings if user has enabled it
    if (generateEmbeddings && this.embeddingFunction) {
      embedding = await this.embeddingFunction(chunk.text);
    }

    await this.createChunkNode(bookId, chunk, embedding, token);
  }
}

// Generate embeddings later on-demand
async ensureBookEmbeddings(bookId, token) {
  const chunks = await this.getChunksWithoutEmbeddings(bookId, token);

  for (const chunk of chunks) {
    const embedding = await this.embeddingFunction(chunk.text);
    await this.updateChunkEmbedding(chunk.id, embedding, token);
  }
}
```

---

## Vector Search Queries

### Native Neo4j Vector Search (5.11+)

```cypher
// Search book chunks by similarity
CALL db.index.vector.queryNodes('chunk_embedding_index', $limit, $queryEmbedding)
YIELD node, score
WHERE node.bookId = $bookId AND node.userId = $userId
RETURN node.text AS text, node.chunkIndex AS chunkIndex, score
ORDER BY score DESC
```

### Fallback for Older Neo4j (Cypher-based)

```cypher
// Manual cosine similarity (slower but works on any version)
MATCH (c:Chunk {bookId: $bookId, userId: $userId})
WHERE c.embedding IS NOT NULL
WITH c,
  reduce(dot = 0.0, i IN range(0, size(c.embedding)-1) |
    dot + c.embedding[i] * $queryEmbedding[i]) /
  (sqrt(reduce(a = 0.0, i IN range(0, size(c.embedding)-1) |
    a + c.embedding[i] * c.embedding[i])) *
   sqrt(reduce(b = 0.0, i IN range(0, size($queryEmbedding)-1) |
    b + $queryEmbedding[i] * $queryEmbedding[i]))) AS similarity
WHERE similarity >= $minSimilarity
RETURN c.text AS text, c.chunkIndex AS chunkIndex, similarity
ORDER BY similarity DESC
LIMIT $limit
```

---

## Settings Changes

Add to Settings Panel:

```javascript
// Vector storage settings
{
  label: 'Vector Search',
  items: [
    {
      key: 'vector.enabled',
      label: 'Enable semantic search',
      type: 'switch',
      default: true
    },
    {
      key: 'vector.embedBooks',
      label: 'Generate embeddings for books',
      type: 'switch',
      default: false,
      description: 'Uses AI API to create searchable embeddings (costs apply)'
    },
    {
      key: 'vector.embeddingModel',
      label: 'Embedding model',
      type: 'select',
      options: ['openai', 'gemini', 'local'],
      default: 'openai'
    }
  ]
}
```

---

## Timeline & Priority

| Phase | Effort | Priority | Dependency |
|-------|--------|----------|------------|
| Phase 1: Extend Neo4jAdapter | 2 days | High | None |
| Phase 2: Compatibility Layer | 1 day | High | Phase 1 |
| Phase 3: Update main.ts | 1 day | High | Phase 2 |
| Phase 4: Migration Script | 1 day | Medium | Phase 1-3 |
| Phase 5: Remove ChromaDB | 0.5 day | Low | Phase 4 + testing |

**Total estimated effort: 5-6 days**

---

## Rollback Plan

If issues arise after migration:

1. `VectorManager.useNeo4j = false` reverts to ChromaDB
2. ChromaDB data preserved until Phase 5
3. Migration script can run incrementally (skip existing)

---

## Benefits After Migration

| Benefit | Description |
|---------|-------------|
| **Simpler deployment** | No Python ChromaDB server needed |
| **Unified queries** | Vector search + graph traversal in one query |
| **Better learning features** | Find similar chunks that teach related concepts |
| **Single backup** | Neo4j dump includes all vectors |
| **Consistent API** | One interface for all semantic operations |

# Migration Guide: Neo4j to Kùzu

This guide covers migrating SmartReader from Neo4j to Kùzu embedded graph database.

## Why Migrate?

| Aspect | Neo4j | Kùzu |
|--------|-------|------|
| **License** | GPL v3 (copyleft) | MIT (permissive) |
| **Bundling** | Cannot bundle in commercial product | Can freely bundle |
| **Deployment** | Requires external server | Embedded (no server) |
| **Vector Search** | Manual cosine calculation | Native HNSW index |
| **Query Language** | Cypher | Cypher (compatible) |

## Architecture Changes

### Before (Neo4j + ChromaDB)
```
┌─────────────────┐     ┌─────────────────┐
│    Neo4j        │     │    ChromaDB     │
│  (External)     │     │  (Python)       │
│  bolt://7687    │     │  localhost:8000 │
└────────┬────────┘     └────────┬────────┘
         │                       │
    Neo4jAdapter          ChromaManager
         │                       │
         └───────────┬───────────┘
                     │
              GraphInterface
```

### After (Kùzu Only)
```
┌─────────────────────────────────┐
│            Kùzu                 │
│  (Embedded in Electron)         │
│  - Cypher queries               │
│  - Native HNSW vector index     │
│  - Full-text search             │
│  - No external dependencies     │
└─────────────────────────────────┘
                │
           KuzuAdapter
                │
          GraphInterface
```

## Migration Steps

### Step 1: Install Kùzu Package

```bash
# Add to package.json dependencies
npm install kuzu

# Also add to release/app/package.json for production build
cd release/app
npm install kuzu
```

### Step 2: Update Configuration

In your electron-store settings:

```javascript
// Before (Neo4j)
{
  "graph": {
    "enabled": true,
    "adapterType": "neo4j",
    "connectionUri": "bolt://localhost:7687",
    "username": "neo4j",
    "password": "password"
  }
}

// After (Kùzu)
{
  "graph": {
    "enabled": true,
    "adapterType": "kuzu",
    // No connection URI needed - embedded database
    // Optional: custom database path
    "kuzu_db_path": "./kuzu_graph.db"
  }
}
```

### Step 3: Update main.ts Initialization

```typescript
// In src/main/main.ts

// Before
import graphInterface from './utils/GraphInterface';
await graphInterface.initialize('neo4j', store);

// After
import graphInterface from './utils/GraphInterface';
const adapterType = store.get('graph.adapterType') || 'kuzu';
await graphInterface.initialize(adapterType, store);
```

### Step 4: Data Migration

Export data from Neo4j and import to Kùzu:

```javascript
// Export from Neo4j (run once)
const neo4jAdapter = require('./Neo4jAdapter').default;
await neo4jAdapter.connect(store);

// Get all data
const users = await neo4jAdapter.query('MATCH (u:User) RETURN u');
const books = await neo4jAdapter.query('MATCH (b:Book) RETURN b');
const notes = await neo4jAdapter.query('MATCH (n:Note) RETURN n');
// ... export to JSON files

// Import to Kùzu
const kuzuAdapter = require('./KuzuAdapter').default;
await kuzuAdapter.connect(store);

// Import data
for (const user of users) {
  await kuzuAdapter.upsertUser(user);
}
// ... import other data
```

## Cypher Query Compatibility

Most Cypher queries work unchanged. Key differences:

### 1. Parameters

```cypher
-- Neo4j: Named parameters
MATCH (n:Note {id: $noteId}) RETURN n

-- Kùzu: Same syntax supported by KuzuAdapter
-- (Adapter handles conversion internally)
MATCH (n:Note {id: $noteId}) RETURN n
```

### 2. MERGE Statement

```cypher
-- Neo4j
MERGE (u:User {id: $id})
ON CREATE SET u.name = $name
ON MATCH SET u.updatedAt = datetime()

-- Kùzu: Use separate CREATE/UPDATE logic
-- KuzuAdapter handles this internally
```

### 3. Datetime Functions

```cypher
-- Neo4j
SET n.createdAt = datetime()

-- Kùzu: Use ISO strings
SET n.createdAt = $timestamp  -- Pass ISO string
```

### 4. Vector Search

```cypher
-- Neo4j (manual cosine similarity)
MATCH (n:Note)
WHERE n.embedding IS NOT NULL
WITH n,
  reduce(dot = 0.0, i IN range(0, size(n.embedding)-1) |
    dot + n.embedding[i] * $queryEmbedding[i]) /
  (sqrt(reduce(...)) * sqrt(reduce(...))) AS similarity
WHERE similarity >= 0.7
RETURN n, similarity
ORDER BY similarity DESC

-- Kùzu (native HNSW index)
CALL QUERY_VECTOR_INDEX('note_embedding_idx', $embedding, 10)
YIELD node, distance
WHERE 1 - distance >= 0.7
RETURN node, 1 - distance AS similarity
ORDER BY similarity DESC
```

## ChromaDB Removal

Kùzu's native vector search replaces ChromaDB:

### Before (ChromaManager.js)
```javascript
// Required separate Python ChromaDB server
// pip install chromadb
// chroma run --path chroma

import ChromaManager from './ChromaManager';
await chromaManager.addBookmark(doc, embedding);
const results = await chromaManager.searchBookmarks(query, embedding, 10);
```

### After (KuzuAdapter)
```javascript
// No external server needed
import kuzuAdapter from './KuzuAdapter';

// Store embedding
await kuzuAdapter.storeEmbedding(nodeId, 'Bookmark', embedding, 'text-embedding-3-small');

// Search using native HNSW
const results = await kuzuAdapter.findSimilar(queryEmbedding, ['Bookmark'], 10, 0.7, token);
```

## Files to Update

| File | Changes |
|------|---------|
| `package.json` | Add `kuzu` dependency |
| `release/app/package.json` | Add `kuzu` dependency |
| `src/main/main.ts` | Update initialization to use `kuzu` |
| `src/main/utils/GraphInterface.js` | Already updated with `kuzu` case |
| Settings UI | Add option to select adapter type |

## Files That Can Be Removed (After Full Migration)

| File | Reason |
|------|--------|
| `src/main/utils/Neo4jAdapter.js` | Replaced by KuzuAdapter |
| `src/main/utils/ChromaManager.js` | Replaced by Kùzu vector search |
| `src/main/utils/chromaUtil.js` | No longer needed |

## Configuration Reference

### KuzuAdapter Settings

```javascript
const DEFAULT_CONFIG = {
  // Database path (auto-set to app data directory)
  dbPath: null,

  // Buffer pool size (default 256MB)
  bufferPoolSize: 256 * 1024 * 1024,

  // Max threads
  maxNumThreads: 4,

  // Enable compression
  enableCompression: true,

  // Read-only mode
  readOnly: false,
};
```

### Vector Index Parameters

```javascript
// HNSW index configuration
{
  metric: 'cosine',  // Distance metric
  mu: 30,            // Max degree in upper layer
  ml: 60,            // Max degree in lower layer
  efc: 200,          // Construction efSearch
}
```

## Testing

After migration, run tests to verify:

```bash
# Run graph tests
npm test -- --testPathPattern=graph

# Test specific adapter
npm test -- --testPathPattern=KuzuAdapter
```

## Rollback Plan

If issues arise, rollback by:

1. Change `adapterType` back to `'neo4j'` in settings
2. Restart the app
3. Neo4j server must be running

## Performance Comparison

| Operation | Neo4j | Kùzu | Notes |
|-----------|-------|------|-------|
| Startup | 2-5s (connect) | <100ms (embedded) | No network latency |
| Simple query | 5-50ms | 1-10ms | In-process execution |
| Vector search (1000 items) | 100-500ms (O(n)) | 5-20ms (HNSW) | Native index |
| Memory usage | Separate process | Shared with app | More efficient |

## Support

For Kùzu-specific issues:
- [Kùzu Documentation](https://docs.kuzudb.com/)
- [Kùzu GitHub](https://github.com/kuzudb/kuzu)
- [Kùzu Discord](https://discord.gg/jw7xN2ZhJB)

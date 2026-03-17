# ChromaDB Implementation Review

## Executive Summary

This document provides a comprehensive analysis of how ChromaDB (vector database) is integrated into the SmartReader v2 application. The review covers architecture, data flows, entity mappings, and the relationship between ChromaDB and SQLite. This documentation serves as a reference for future migration to a graph database system.

---

## 1. Architecture Overview

### 1.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RENDERER PROCESS                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │   Views     │  │ customStorage│  │  AI Provider Manager            │ │
│  │  - Notes    │──│  (API layer) │──│  (Embedding configuration)      │ │
│  │  - Chat     │  │              │  │                                 │ │
│  │  - Browser  │  │              │  │                                 │ │
│  │  - LearnAbt │  │              │  │                                 │ │
│  └─────────────┘  └──────┬───────┘  └─────────────────────────────────┘ │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │ IPC (Electron)
┌──────────────────────────┼──────────────────────────────────────────────┐
│                      MAIN PROCESS                                        │
│  ┌───────────────────────┴───────────────────────────────────────────┐  │
│  │                        main.ts (~100+ IPC handlers)               │  │
│  │   - setupChroma() at user login                                   │  │
│  │   - Chroma-related IPC handlers for CRUD operations               │  │
│  └───────────────────────┬───────────────────────────────────────────┘  │
│                          │                                               │
│  ┌───────────────────────┴──────────────────┐  ┌──────────────────────┐ │
│  │         ChromaManager.js (Singleton)      │  │   SQLite Managers   │ │
│  │   - setupChroma()                         │  │   - NoteJsonManager │ │
│  │   - setupVectorDB()                       │  │   - BookManager     │ │
│  │   - addBookToVecterDB()                   │  │   - MessageManager  │ │
│  │   - addNodeToVecterDB()                   │  │   - BookmarkManager │ │
│  │   - AddBookmarkToVectorDB()               │  │                     │ │
│  │   - getBooksByQuery()                     │  │                     │ │
│  │   - getNotesByQuery()                     │  │                     │ │
│  │   - getMessageByQuery()                   │  │                     │ │
│  │   - addContentToInMemoryVectorDB()        │  │                     │ │
│  └───────────────────────┬──────────────────┘  └──────────────────────┘ │
│                          │                                               │
└──────────────────────────┼───────────────────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                      │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐│
│  │    ChromaDB Server      │  │          Embedding APIs                 ││
│  │  (Python, port 8000)    │  │   - OpenAI Embeddings                   ││
│  │                         │  │   - Google Generative AI Embeddings     ││
│  │  Collections:           │  │                                         ││
│  │  - my_collection        │  │                                         ││
│  │  - my_temp_collection   │  │                                         ││
│  └─────────────────────────┘  └─────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Files

| File | Location | Purpose |
|------|----------|---------|
| `ChromaManager.js` | `src/main/utils/` | Singleton managing all ChromaDB operations (442 lines) |
| `chromaUtil.js` | `src/main/utils/` | Server startup and health checks (142 lines) |
| `main.ts` | `src/main/` | IPC handlers connecting renderer to ChromaDB |
| `preload.ts` | `src/main/` | EPUB processing for vector embeddings |
| `customStorage.js` | `src/renderer/store/` | Renderer-side API wrapper |

---

## 2. Collections and Data Model

### 2.1 Collection Structure

ChromaDB uses **two collections**:

#### `my_collection` (Persistent)
- **Purpose**: Long-term storage for semantic search across all user content
- **Multi-tenant**: Uses `userId` in metadata for user isolation
- **Content Types**: Books (EPUB/PDF), Notes, Bookmarks, Messages

#### `my_temp_collection` (Ephemeral)
- **Purpose**: Session-specific context for "Learn About" and in-context chat
- **Lifecycle**: Cleared and recreated before each use
- **Use Case**: Loading article content for contextual Q&A

### 2.2 Entity Types Stored in ChromaDB

| Entity | Source Value | ID Format | Document Content | Metadata |
|--------|--------------|-----------|------------------|----------|
| EPUB Book | `'epub'` | `{bookId}\|{CFI}` | Accumulated paragraph text (~250 chars) | `source, sourceKey, cfi, userId` |
| PDF Book | `'pdf'` | `{bookId}\|{pageNum}\|{index}` | Page text content | `source, sourceKey, userId` |
| Note | `'note'` | `{noteId}` (string) | `title + cards[0-2].text` | `source, type, userId` |
| Bookmark | `{sourceKey}` | `{bookmarkId}` (string) | `title + description` | `source, type, userId` |
| Message | `'message'` | `{messageId}` (string) | Message content | `source, userId` |

### 2.3 ID Format Deep Dive

**EPUB IDs**: `bookId|cfi`
- Example: `42|epubcfi(/6/4!/4/2/1:0)`
- The CFI (Canonical Fragment Identifier) allows navigation back to exact position
- Parsing: Split by `|`, first part is book ID, rest is CFI

**PDF IDs**: `bookId|pageNumber|index`
- Example: `42|15|0`
- Page number enables jumping to specific page
- Index handles multiple chunks per page

**Simple IDs** (Notes, Bookmarks, Messages): Direct numeric ID as string
- Example: `"123"`
- Maps 1:1 with SQLite primary key

---

## 3. Embedding Configuration

### 3.1 Embedding Function Selection

Located in `ChromaManager.setupVectorDB()` (lines 41-76):

```javascript
async setupVectorDB(store, userId) {
  const apiKeyChatgpt = store.get(`openai_key_${userId}`);
  const apiKeyGemini = store.get(`gemini_key_${userId}`);

  // Priority: ChatGPT > Gemini > Default
  if (apiKeyChatgpt && aiProviderManager.currentProviderName === AIProvider.ChatGPT) {
    this.embedder = new OpenAIEmbeddingFunction({
      openai_api_key: apiKeyChatgpt,
    });
  } else if (apiKeyGemini && aiProviderManager.currentProviderName === AIProvider.Gemini) {
    this.embedder = new GoogleGenerativeAiEmbeddingFunction({
      googleApiKey: apiKeyGemini,
    });
  }

  // Create collection with or without custom embedder
  this.collection = await this.chromaClient.getOrCreateCollection({
    name: 'my_collection',
    embeddingFunction: this.embedder || undefined,
  });
}
```

### 3.2 Embedding Provider Matrix

| AI Provider | Embedding Function | API Key Store Key |
|-------------|-------------------|-------------------|
| ChatGPT | `OpenAIEmbeddingFunction` | `openai_key_{userId}` |
| Gemini | `GoogleGenerativeAiEmbeddingFunction` | `gemini_key_{userId}` |
| Others | ChromaDB default | N/A |

---

## 4. Data Flow: When Embeddings Are Created

### 4.1 Book Import Flow (EPUB)

```
User imports EPUB
        │
        ▼
┌─────────────────────────────────────────────────┐
│ main.ts: import-book-from-file IPC handler      │
│ Line 2268: chromaManager.addBookToVecterDB()    │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ ChromaManager.addBookToVecterDB()               │
│ Line 133-166: Sends 'process-book-for-vectordb' │
│               message to renderer               │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ preload.ts: addEPubToVecterDB()                 │
│ Line 1319-1390: Processes EPUB sections         │
│   - Uses epubjs to parse                        │
│   - Extracts paragraphs with CFI references     │
│   - Accumulates text to ~250 char chunks        │
│   - Returns array of {ids, metadatas, documents}│
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ main.ts: 'book-for-vectordb-processed' handler  │
│ Line 154-161: Iterates results, calls           │
│               collection.add() for each chunk   │
└─────────────────────────────────────────────────┘
```

### 4.2 Book Import Flow (PDF)

```
User imports PDF
        │
        ▼
┌─────────────────────────────────────────────────┐
│ ChromaManager.addPDFToVecterDB()                │
│ Line 197-264: Direct processing in main process │
│   - Uses pdf-parse library                      │
│   - Processes page by page                      │
│   - Preserves Y-coordinates for text flow       │
│   - Calls collection.add() per page             │
└─────────────────────────────────────────────────┘
```

### 4.3 Note Creation Flow

```
User creates note
        │
        ▼
┌─────────────────────────────────────────────────┐
│ main.ts: createNote IPC handler                 │
│ Line 1791-1798                                  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ Check: store.get(`useChroma_${userId}`)         │
│ If enabled:                                     │
│   chromaManager.addNodeToVecterDB(store, note)  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ ChromaManager.addNodeToVecterDB()               │
│ Line 168-195:                                   │
│   - Concatenates: title + cards[0-2].text       │
│   - Requires doc.length >= 10                   │
│   - collection.add({                            │
│       ids: [noteId],                            │
│       metadatas: [{source:'note',type,userId}], │
│       documents: [doc]                          │
│     })                                          │
└─────────────────────────────────────────────────┘
```

### 4.4 Bookmark Creation Flow

```
User creates bookmark (via Browser.js context menu)
        │
        ▼
┌─────────────────────────────────────────────────┐
│ main.ts: createBookmark IPC handler             │
│ Line 1688-1699                                  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ Check: bookmark.title && bookmark.description   │
│ If both exist:                                  │
│   chromaManager.AddBookmarkToVectorDB()         │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ ChromaManager.AddBookmarkToVectorDB()           │
│ Line 108-131:                                   │
│   - Concatenates: title + description           │
│   - Requires doc.length >= 10                   │
│   - Uses bookmark.sourceKey as source metadata  │
│   - collection.add({                            │
│       ids: [bookmarkId],                        │
│       metadatas: [{source:sourceKey,type}],     │
│       documents: [doc]                          │
│     })                                          │
└─────────────────────────────────────────────────┘
```

### 4.5 Upsert to Leitner Study Flow

```
User adds note to Leitner study
        │
        ▼
┌─────────────────────────────────────────────────┐
│ main.ts: upSertCollectionInStore IPC            │
│ Line 556-589                                    │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ Check: collectionName === 'note'                │
│ If true:                                        │
│   chromaManager.addNodeToVecterDB()             │
│   (Embeds/re-embeds the note)                   │
└─────────────────────────────────────────────────┘
```

---

## 5. Data Flow: Semantic Search Queries

### 5.1 Generic Semantic Query

**IPC Handler**: `semanticQuery` (main.ts lines 2020-2043)

```javascript
ipcMain.on('semanticQuery', async (_, query, nResults, condition) => {
  if (!chromaManager.collection) {
    _.returnValue = { ids: [], documents: [], metadatas: [], distances: [] };
    return;
  }

  if (condition) {
    const r = await chromaManager.collection.query({
      nResults: nResults || 10,
      where: condition,
      queryTexts: [query],
    });
    _.returnValue = r;
  } else {
    const r = await chromaManager.collection.query({
      nResults: nResults || 10,
      queryTexts: [query],
    });
    _.returnValue = r;
  }
});
```

**Return Structure**:
```typescript
{
  ids: string[][],        // Array of ID arrays
  documents: string[][],  // Array of document arrays
  metadatas: object[][],  // Array of metadata arrays
  distances: number[][]   // Array of distance arrays (similarity scores)
}
```

### 5.2 Specialized Query Methods

#### getBooksByQuery (Lines 267-306)
```javascript
// Queries both EPUB and PDF separately
// Returns Book objects from SQLite

// EPUB query
where: {
  $and: [
    { source: { $eq: 'epub' } },
    { userId: { $eq: String(userId) } },
  ]
}

// PDF query
where: {
  $and: [
    { source: { $eq: 'pdf' } },
    { userId: { $eq: String(userId) } }
  ]
}
```

#### getBookContentByQuery (Lines 308-390)
```javascript
// Returns reading positions within a book
// Only triggers for multi-word queries (query.indexOf(' ') > 0)

where: {
  $or: [
    { source: { $eq: bookType } },
    { sourceKey: { $eq: String(bookKey) } },
    { userId: { $eq: String(userId) } },
  ]
}

// Returns hit objects with navigation info:
// EPUB: { bookKey, cfi, excerpt, type }
// PDF: { id, position: {boundingRect, rects, pageNumber}, content: {text} }
```

#### getNotesByQuery (Lines 414-434)
```javascript
// Augments SQL search with semantic results
where: {
  $and: [
    { source: { $eq: 'note' } },
    { userId: { $eq: String(userId) } },
  ]
}
// Fetches full Note objects from SQLite using returned IDs
```

#### getMessageByQuery (Lines 392-412)
```javascript
// Searches chat message history
where: {
  $and: [
    { source: { $eq: 'message' } },
    { userId: { $eq: String(userId) } },
  ]
}
```

### 5.3 In-Memory Vector DB Queries

**Purpose**: Session-specific context for "Learn About" feature and in-context chat

**Add Content** (Lines 78-106):
```javascript
async addContentToInMemoryVectorDB(content) {
  // Delete and recreate collection (fresh start)
  await this.chromaClient.deleteCollection({ name: 'my_temp_collection' });
  this.inMemoryVectorDB = await this.chromaClient.getOrCreateCollection({...});

  // Chunk content to 500 chars
  const chunks = splitTextIntoChunks(content, 500);
  const ids = chunks.map((_, i) => i.toString()); // "0", "1", "2", ...

  this.inMemoryVectorDB.add({ ids, documents: chunks });
}
```

**Query** (main.ts lines 1590-1601):
```javascript
ipcMain.on('queryInMemoryVectorDB', async (_, { content }) => {
  const r = await chromaManager.inMemoryVectorDB.query({
    nResults: 3,
    queryTexts: [content],
  });
  // Returns just documents array
});
```

---

## 6. SQLite to ChromaDB Mapping

### 6.1 Design Pattern

ChromaDB stores **lightweight pointers** to SQLite records. The pattern:

1. **Write**: Create entity in SQLite, then add embedding to ChromaDB with SQLite ID
2. **Search**: Query ChromaDB for semantic matches → get IDs → fetch full objects from SQLite
3. **Read**: Always fetch complete data from SQLite (ChromaDB only stores searchable text)

### 6.2 Entity Mapping Table

| SQLite Table | Primary Key | ChromaDB ID | Embedded Fields |
|--------------|-------------|-------------|-----------------|
| `note` | `id` (INTEGER) | `String(id)` | `data.title + data.cards[0-2].text` |
| `bookmark` | `id` (INTEGER) | `String(id)` | `title + description` |
| `message` | `id` (INTEGER) | `String(id)` | `content` |
| `book` | `id` (INTEGER) | `id\|position` | Page/section text chunks |

### 6.3 ID Parsing Examples

```javascript
// EPUB: Extract book ID from compound key
const chromaId = "42|epubcfi(/6/4!/4/2/1:0)";
const pos = chromaId.indexOf('|');
const bookId = chromaId.substring(0, pos); // "42"
const cfi = chromaId.substring(pos + 1);   // "epubcfi(/6/4!/4/2/1:0)"

// PDF: Extract book ID and page number
const chromaId = "42|15|0";
const parts = chromaId.split('|');
const bookId = parts[0];      // "42"
const pageNumber = parts[1];  // "15"
const index = parts[2];       // "0"

// Simple entities: Direct mapping
const noteId = "123";  // Same as SQLite ID
```

---

## 7. UI Integration Points

### 7.1 Settings Panel

**File**: `src/renderer/views/settings/SettingsPanel.js`

| Setting | Store Key | IPC Call |
|---------|-----------|----------|
| Enable/Disable ChromaDB | `useChroma_{userId}` | `setUseChroma(flag, token)` |
| ChromaDB Server URL | `chroma_url` | `setChromaUrl(url)` |

### 7.2 Notes Search

**File**: `src/renderer/views/notes/NotesUI.js` (Line 61)

```javascript
// Only use semantic search for multi-word queries
if (filterKey.indexOf(' ') > 0) {
  const r = await customStorage.semanticQuery(filterKey, 10, undefined);
  // Process ChromaDB results, fetch full notes from SQLite
}
```

### 7.3 Chat Context Retrieval

**File**: `src/renderer/views/chat/ChatDetailPanel.js` (Line 251)

```javascript
const r = await customStorage.semanticQuery(query, 5, undefined);
// Used to provide context for AI conversations
```

### 7.4 Learn About Feature

**File**: `src/renderer/views/learnabout/LearnAboutDetailPanel.js` (Line 229)

```javascript
const r = await customStorage.semanticQuery(query, 5, undefined);
// Retrieves relevant content for exploratory learning sessions
```

### 7.5 In-Context Chat (Browser/Reader)

**File**: `src/renderer/components/chat/InContextChatPanel.js` (Line 324)

```javascript
const r = await customStorage.queryInMemoryVectorDB(query);
// Queries temporary collection with current page content
```

---

## 8. Configuration and Feature Flags

### 8.1 User-Level Settings

| Setting | Store Key | Default | Purpose |
|---------|-----------|---------|---------|
| Enable ChromaDB | `useChroma_{userId}` | `true` | Toggle embedding creation |
| ChromaDB URL | `chroma_url` | `http://127.0.0.1:8000` | Server location |

### 8.2 Hardcoded Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| Collection Name | `'my_collection'` | ChromaManager.js:61 | Persistent collection |
| Temp Collection | `'my_temp_collection'` | ChromaManager.js:65 | Session collection |
| EPUB Chunk Size | 250 chars | ChromaManager.js:140 | Text accumulation threshold |
| Temp Chunk Size | 500 chars | ChromaManager.js:92 | In-memory chunking |
| Default Query Results | 10 | Various | nResults parameter |
| Min Document Length | 10 chars | ChromaManager.js:115,181 | Skip short content |

### 8.3 Query Heuristics

```javascript
// Multi-word requirement for semantic search
if (query.indexOf(' ') > 0) {
  // Use ChromaDB semantic search
} else {
  // Fall back to SQL keyword search
}
```

---

## 9. Server Management

### 9.1 Startup Flow

**File**: `chromaUtil.js`

```javascript
async function ensureChromaIsRunning(store) {
  const urlpath = store.get('chroma_url') || 'http://127.0.0.1:8000';

  // Health check via HTTP GET
  const isRunning = await checkIfChromaIsRunning(urlpath);

  if (!isRunning) {
    // Start ChromaDB server
    const dataPath = store.get('storageLocation') || global.shared.storageLocation;
    const outPath = path.join(dataPath, 'chroma-data');

    spawn('chroma', ['run', '--path', outPath], { stdio: 'inherit' });
  }
}
```

### 9.2 Requirements

- **Python**: ChromaDB is a Python library
- **Command**: `chroma run --path {dataPath}`
- **Default Port**: 8000
- **Data Location**: `{storageLocation}/chroma-data`

---

## 10. Error Handling and Graceful Degradation

### 10.1 Null Collection Checks

All query methods check for null collection:

```javascript
async getBooksByQuery(store, query, token) {
  if (!this.collection) return []; // Graceful degradation
  // ...
}
```

### 10.2 User Feature Toggle

```javascript
const key = store.get(`useChroma_${userId}`);
if (!key) return; // Skip if user disabled ChromaDB
```

### 10.3 Minimum Content Validation

```javascript
if (doc.length < 10) return; // Skip very short documents
```

---

## 11. Considerations for Graph Database Migration

### 11.1 Current Semantic Model

```
User ──owns──> Note ──has──> Cards (embedded text)
     ──owns──> Book ──contains──> Chunks (by CFI/page)
     ──owns──> Bookmark ──references──> URL/Book
     ──owns──> Message ──belongs_to──> Chat
```

### 11.2 Key Relationships to Model

| Relationship | From | To | Attributes |
|--------------|------|-----|------------|
| `OWNS` | User | Note, Book, Bookmark, Message | userId (implicit in current) |
| `CONTAINS` | Book | Chunk | position (CFI or page#) |
| `REFERENCES` | Bookmark | Book/URL | sourceKey, sourceType |
| `BELONGS_TO` | Message | Chat | chatId |
| `SIMILAR_TO` | Any | Any | similarity_score (from embeddings) |

### 11.3 Migration Considerations

1. **Embedding Storage**: Graph DBs like Neo4j support vector indexes - can store embeddings as node properties
2. **ID Mapping**: Current compound IDs (bookId|cfi) should become separate nodes with relationships
3. **Multi-tenancy**: Move from metadata filtering to explicit User-OWNS→Entity relationships
4. **Query Patterns**: Replace ChromaDB's `query()` with graph traversal + vector similarity

### 11.4 Recommended Graph Schema

```cypher
// Nodes
(:User {id, email})
(:Book {id, title, format, path})
(:BookChunk {id, text, position, cfi, pageNumber})
(:Note {id, title, type})
(:NoteCard {id, text, index})
(:Bookmark {id, title, description, sourceKey, sourceType})
(:Message {id, content, role})
(:Chat {id, description})

// Relationships
(:User)-[:OWNS]->(:Book)
(:User)-[:OWNS]->(:Note)
(:User)-[:OWNS]->(:Bookmark)
(:User)-[:OWNS]->(:Chat)
(:Chat)-[:CONTAINS]->(:Message)
(:Book)-[:HAS_CHUNK]->(:BookChunk)
(:Note)-[:HAS_CARD]->(:NoteCard)
(:Bookmark)-[:REFERENCES]->(:Book|:URL)

// Vector similarity (computed at query time)
(:BookChunk)-[:SIMILAR {score}]->(:BookChunk)
(:Note)-[:SIMILAR {score}]->(:Note)
```

---

## 12. API Reference Summary

### 12.1 Main Process (ChromaManager methods)

| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `setupChroma(store)` | electron-store | void | Initialize ChromaDB client |
| `setupVectorDB(store, userId)` | store, userId | void | Create collections with embeddings |
| `addBookToVecterDB(store, mainWin, sender, book, token)` | ... | void | Index book content |
| `addNodeToVecterDB(store, noteObj, token)` | ... | void | Index note content |
| `AddBookmarkToVectorDB(store, bookmark, token)` | ... | void | Index bookmark |
| `addContentToInMemoryVectorDB(content)` | content string | boolean | Populate temp collection |
| `getBooksByQuery(store, query, token)` | ... | Book[] | Semantic book search |
| `getBookContentByQuery(store, bookKey, bookType, query, token)` | ... | Hit[] | Search within book |
| `getNotesByQuery(store, query, tag, star, page, limit, token)` | ... | Note[] | Semantic note search |
| `getMessageByQuery(store, query, token)` | ... | Message[] | Semantic message search |

### 12.2 IPC Handlers (main.ts)

| Handler | Type | Parameters | Purpose |
|---------|------|------------|---------|
| `semanticQuery` | sendSync | query, nResults, condition | Generic vector search |
| `query-vectordb` | handle | query, nResults, condition | Promise-based search |
| `add-data-to-vectordb` | handle | id, source, doc | Manual embedding |
| `addContentToInMemoryVectorDB` | sendSync | content | Populate temp DB |
| `queryInMemoryVectorDB` | sendSync | content | Query temp DB |
| `getUseChroma` | sendSync | token | Get user preference |
| `setUseChroma` | sendSync | key, token | Set user preference |
| `getChromaUrl` | sendSync | - | Get server URL |
| `setChromaUrl` | sendSync | url | Set server URL |

### 12.3 Renderer API (customStorage.js)

| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `semanticQuery(query, nResults, condition)` | ... | ChromaDB result | Generic search |
| `queryInMemoryVectorDB(description)` | ... | documents[] | Temp collection search |
| `addContentToInMemoryVectorDB(description)` | ... | boolean | Populate temp collection |
| `getChromaUrl()` | - | string | Get server URL |
| `setChromaUrl(url)` | url | void | Set server URL |
| `getUseChroma()` | - | boolean | Get user preference |
| `setUseChroma(flag)` | flag | void | Set user preference |

---

## 13. Known Limitations and Technical Debt

1. **Bookmark Metadata Inconsistency**: Uses `sourceKey` as `source` instead of `'bookmark'`
2. **PDF Processing Context Leak**: The `render_page` function references `this.collection` but loses context
3. **No Embedding Updates**: No mechanism to re-embed when notes/bookmarks are edited
4. **No Deletion Sync**: When entities are deleted from SQLite, ChromaDB entries remain (orphaned)
5. **Single-word Query Fallback**: Hardcoded heuristic may miss valid single-word semantic queries
6. **No Batch Operations**: Each embedding is added individually (performance impact)
7. **Embedding Function Lock-in**: Changing AI provider doesn't update existing embeddings

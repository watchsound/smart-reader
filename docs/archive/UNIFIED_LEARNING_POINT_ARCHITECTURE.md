# Unified Learning Point Architecture

## Overview

This document describes the architecture for a **unified learning content system** where:
- **Neo4j (or Cypher-compatible Graph DB) is the PRIMARY storage**
- **SQLite is SECONDARY** (user auth, settings, offline queue only)
- **GraphInterface abstraction** enables future graph DB swaps

## Design Principles

1. **Graph DB as Source of Truth**: All learning content lives in Neo4j
2. **Adapter Pattern**: GraphInterface abstracts DB-specific code
3. **Cypher Compatibility**: Support Neo4j, Memgraph, FalkorDB, Neptune
4. **Unified Content Model**: Single `LearningPoint` node replaces Note + Vocabulary
5. **Embedded Spaced Repetition**: Leitner state stored on nodes, not separate table

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                             │
├─────────────────────────────────────────────────────────────────────┤
│  learningPointApi.js                                                 │
│  └── IPC calls: lp-create, lp-get-due, lp-process-review, etc.      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ IPC
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                                 │
├─────────────────────────────────────────────────────────────────────┤
│  learningPointHandlers.js                                            │
│  └── IPC handlers                                                    │
│          │                                                           │
│          ▼                                                           │
│  LearningPointService.js  (NEW - Business Logic)                    │
│  └── Spaced repetition logic, validation, transformations           │
│          │                                                           │
│          ▼                                                           │
│  GraphInterface.js  (EXISTING - Abstraction Layer)                  │
│  └── Adapter-agnostic API                                           │
│          │                                                           │
│          ├──────────────────────────────────────────────────────┐   │
│          ▼                                                      ▼   │
│  Neo4jAdapter.js          MemgraphAdapter.js (future)               │
│  └── Neo4j-specific       └── Memgraph-specific                     │
│      Cypher queries           Cypher queries                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GRAPH DATABASE                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Neo4j / Memgraph / FalkorDB / Amazon Neptune                       │
│                                                                      │
│  Nodes:                                                              │
│  ├── (:User)                                                         │
│  ├── (:LearningPoint)  ← UNIFIED (replaces Note + Vocabulary)       │
│  ├── (:Concept)                                                      │
│  ├── (:Book)                                                         │
│  ├── (:Episode)                                                      │
│  └── (:ConsolidatedMemory)                                          │
│                                                                      │
│  Relationships:                                                      │
│  ├── (:User)-[:OWNS]->(:LearningPoint)                              │
│  ├── (:LearningPoint)-[:FROM_SOURCE]->(:Book|:URL)                  │
│  ├── (:LearningPoint)-[:MENTIONS]->(:Concept)                       │
│  ├── (:Episode)-[:REVIEWS]->(:LearningPoint)                        │
│  └── (:ConsolidatedMemory)-[:SUMMARIZES]->(:LearningPoint)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Unified LearningPoint Node Schema

```cypher
// Node: LearningPoint
// Replaces: Note, Vocabulary, and new learning_point SQLite table

(:LearningPoint {
  // === Identity ===
  id: STRING,                    // UUID
  userId: INTEGER,               // Owner

  // === Type Discriminator ===
  itemType: STRING,              // 'word', 'concept', 'note', 'formula', 'pdf_annotation'
  domainType: STRING,            // 'vocabulary', 'knowledge', 'math', 'reading', 'language'

  // === Content (schema varies by itemType) ===
  title: STRING,                 // Display title
  front: STRING,                 // JSON: question/term/card front
  back: STRING,                  // JSON: answer/definition/card back
  extras: STRING,                // JSON: type-specific data

  // === Source Reference ===
  sourceType: STRING,            // 'book', 'url', 'chat', 'manual', 'import'
  sourceId: STRING,              // FK to Book/URL node

  // === Location (for book/PDF notes) ===
  cfi: STRING,                   // EPUB CFI location
  chapter: STRING,               // Chapter name
  chapterIndex: INTEGER,         // Chapter index
  pageNumber: INTEGER,           // PDF page
  percentage: FLOAT,             // Position percentage

  // === Metadata ===
  tags: LIST<STRING>,            // Tags for filtering
  difficulty: STRING,            // 'beginner', 'intermediate', 'advanced'

  // === Spaced Repetition (Leitner) ===
  box: INTEGER,                  // 1-5 Leitner box
  nextReview: DATETIME,          // Next review date
  lastReviewedAt: DATETIME,      // Last review timestamp
  reviewCount: INTEGER,          // Total reviews
  correctStreak: INTEGER,        // Consecutive correct
  totalCorrect: INTEGER,         // Lifetime correct
  totalIncorrect: INTEGER,       // Lifetime incorrect
  easeFactor: FLOAT,             // 2.5 default, adjusted per review
  fullyLearned: BOOLEAN,         // Mastered flag
  masteryLevel: INTEGER,         // 0-100 mastery score

  // === Response Time Analytics ===
  avgResponseTimeMs: INTEGER,    // Average response time
  lastResponseTimeMs: INTEGER,   // Last response time

  // === Embeddings (for semantic search) ===
  embedding: LIST<FLOAT>,        // Vector embedding
  embeddingModel: STRING,        // Model used

  // === Bi-temporal Tracking ===
  eventTime: DATETIME,           // When learning occurred
  recordTime: DATETIME,          // When stored
  validFrom: DATETIME,           // Version start
  validTo: DATETIME,             // Version end (null = current)

  // === Timestamps ===
  createdAt: DATETIME,
  updatedAt: DATETIME
})
```

---

## Content Schema by itemType

The `front`, `back`, and `extras` fields contain JSON with different schemas based on `itemType`:

### itemType: 'word' (Vocabulary)

```json
{
  "front": "ephemeral",
  "back": "lasting for a very short time",
  "extras": {
    "pronunciation": "/ɪˈfem(ə)rəl/",
    "partOfSpeech": "adjective",
    "example": "The ephemeral nature of fashion trends.",
    "relatedWords": ["transient", "fleeting", "momentary"],
    "etymology": "Greek ephēmeros 'lasting only a day'"
  }
}
```

### itemType: 'concept' (Knowledge Point)

```json
{
  "front": {
    "text": "What is the Pythagorean theorem?",
    "html": "<p>What is the <strong>Pythagorean theorem</strong>?</p>"
  },
  "back": {
    "text": "a² + b² = c²",
    "html": "<p>a² + b² = c²</p>",
    "latex": "a^2 + b^2 = c^2"
  },
  "extras": {
    "mindmap": { "nodes": [], "edges": [] },
    "quiz": { "questions": [] }
  }
}
```

### itemType: 'note' (EPUB/Text Note)

```json
{
  "front": {
    "cards": [
      { "id": 1, "text": "Highlight text", "html": "<mark>Highlight text</mark>", "type": "normal" }
    ]
  },
  "back": {
    "cards": [
      { "id": 2, "text": "My annotation", "html": "<p>My annotation</p>", "type": "normal" }
    ]
  },
  "extras": {
    "color": "#FFE082",
    "emoji": "💡",
    "highlightType": "highlight",
    "highlightOnly": false,
    "hasQuiz": false,
    "range": "..."
  }
}
```

### itemType: 'pdf_annotation' (PDF Note)

```json
{
  "front": {
    "cards": [
      { "id": 1, "text": "Selected PDF text", "image": "base64..." }
    ]
  },
  "back": {
    "cards": [
      { "id": 2, "text": "My comment" }
    ]
  },
  "extras": {
    "position": [
      { "x1": 100, "y1": 200, "x2": 300, "y2": 250, "width": 612, "height": 792, "pageNumber": 1 }
    ],
    "color": "#FFEB3B",
    "highlightType": "area"
  }
}
```

### itemType: 'formula' (Math/Science)

```json
{
  "front": {
    "latex": "E = mc^2",
    "text": "Mass-energy equivalence"
  },
  "back": {
    "text": "Energy equals mass times the speed of light squared",
    "derivation": "From special relativity..."
  },
  "extras": {
    "domain": "physics",
    "variables": {
      "E": "Energy (Joules)",
      "m": "Mass (kg)",
      "c": "Speed of light (m/s)"
    }
  }
}
```

---

## GraphInterface Extensions

Add these methods to `GraphInterface.js`:

```javascript
// ===========================================================================
// LEARNING POINT OPERATIONS (Unified)
// ===========================================================================

/**
 * Create a learning point
 * @param {Object} point - Learning point data
 * @param {string} token - User token
 * @returns {Promise<Object|null>}
 */
async createLearningPoint(point, token) {
  this._ensureAdapter();
  return this.adapter.createLearningPoint(point, token);
}

/**
 * Get learning point by ID
 */
async getLearningPointById(id, token) {
  this._ensureAdapter();
  return this.adapter.getLearningPointById(id, token);
}

/**
 * Update learning point
 */
async updateLearningPoint(id, updates, token) {
  this._ensureAdapter();
  return this.adapter.updateLearningPoint(id, updates, token);
}

/**
 * Delete learning point (soft delete - set validTo)
 */
async deleteLearningPoint(id, token, hard = false) {
  this._ensureAdapter();
  return this.adapter.deleteLearningPoint(id, token, hard);
}

/**
 * Get items due for review
 * @param {Object} options - { token, date, limit, itemTypes, domainTypes, tags, planId }
 */
async getDueForReview(options) {
  this._ensureAdapter();
  return this.adapter.getDueForReview(options);
}

/**
 * Process review and update spaced repetition state
 * @param {string} id - Learning point ID
 * @param {number} rating - 1=Again, 2=Hard, 3=Good, 4=Easy
 * @param {number} responseTimeMs - Response time in ms
 * @param {string} token - User token
 */
async processReview(id, rating, responseTimeMs, token) {
  this._ensureAdapter();
  return this.adapter.processReview(id, rating, responseTimeMs, token);
}

/**
 * Get learning points by source
 */
async getLearningPointsBySource(sourceType, sourceId, token) {
  this._ensureAdapter();
  return this.adapter.getLearningPointsBySource(sourceType, sourceId, token);
}

/**
 * Search learning points
 */
async searchLearningPoints(query, token, options = {}) {
  this._ensureAdapter();
  return this.adapter.searchLearningPoints(query, token, options);
}

/**
 * Get statistics
 */
async getLearningPointStats(token, options = {}) {
  this._ensureAdapter();
  return this.adapter.getLearningPointStats(token, options);
}

/**
 * Get daily forecast
 */
async getDailyForecast(token, days = 14) {
  this._ensureAdapter();
  return this.adapter.getDailyForecast(token, days);
}

/**
 * Batch create learning points
 */
async createLearningPointsBatch(points, token) {
  this._ensureAdapter();
  return this.adapter.createLearningPointsBatch(points, token);
}

/**
 * Reset learning point to box 1
 */
async resetLearningPoint(id, token) {
  this._ensureAdapter();
  return this.adapter.resetLearningPoint(id, token);
}
```

---

## Neo4jAdapter Extensions

Add these Cypher queries to `Neo4jAdapter.js`:

```javascript
/**
 * Create a learning point node
 */
async createLearningPoint(point, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;

  const session = this.getSession();
  const now = new Date().toISOString();
  const id = point.id || `lp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})
      CREATE (lp:LearningPoint {
        id: $id,
        userId: $userId,
        itemType: $itemType,
        domainType: $domainType,
        title: $title,
        front: $front,
        back: $back,
        extras: $extras,
        sourceType: $sourceType,
        sourceId: $sourceId,
        cfi: $cfi,
        chapter: $chapter,
        chapterIndex: $chapterIndex,
        pageNumber: $pageNumber,
        percentage: $percentage,
        tags: $tags,
        difficulty: $difficulty,
        box: 1,
        nextReview: date($nextReview),
        lastReviewedAt: null,
        reviewCount: 0,
        correctStreak: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        easeFactor: 2.5,
        fullyLearned: false,
        masteryLevel: 0,
        avgResponseTimeMs: 0,
        lastResponseTimeMs: 0,
        embedding: null,
        embeddingModel: null,
        eventTime: datetime($eventTime),
        recordTime: datetime(),
        validFrom: datetime(),
        validTo: null,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      CREATE (u)-[:OWNS {createdAt: datetime()}]->(lp)
      WITH lp
      OPTIONAL MATCH (source) WHERE
        ($sourceType = 'book' AND source:Book AND source.id = $sourceId) OR
        ($sourceType = 'url' AND source:URL AND source.id = $sourceId)
      FOREACH (s IN CASE WHEN source IS NOT NULL THEN [source] ELSE [] END |
        CREATE (lp)-[:FROM_SOURCE {createdAt: datetime()}]->(s)
      )
      RETURN lp
      `,
      {
        userId: String(userId),
        id,
        itemType: point.itemType || 'concept',
        domainType: point.domainType || 'knowledge',
        title: point.title || '',
        front: JSON.stringify(point.front || ''),
        back: JSON.stringify(point.back || ''),
        extras: point.extras ? JSON.stringify(point.extras) : null,
        sourceType: point.sourceType || null,
        sourceId: point.sourceId || null,
        cfi: point.cfi || null,
        chapter: point.chapter || null,
        chapterIndex: point.chapterIndex || null,
        pageNumber: point.pageNumber || null,
        percentage: point.percentage || null,
        tags: point.tags || [],
        difficulty: point.difficulty || 'intermediate',
        nextReview: now.split('T')[0], // Today
        eventTime: now,
      }
    );

    return this._parseNode(result.records[0]?.get('lp'));
  } finally {
    await session.close();
  }
}

/**
 * Get items due for review
 */
async getDueForReview(options = {}) {
  const { token, date, limit = 50, itemTypes, domainTypes, tags, planId } = options;
  const userId = getUserIdFromToken(token);
  if (userId < 0) return [];

  const session = this.getSession();
  const asOfDate = date || new Date().toISOString().split('T')[0];

  try {
    let query = `
      MATCH (u:User {id: $userId})-[:OWNS]->(lp:LearningPoint)
      WHERE lp.fullyLearned = false
        AND lp.validTo IS NULL
        AND (lp.nextReview IS NULL OR lp.nextReview <= date($asOfDate))
    `;

    if (itemTypes?.length) {
      query += ` AND lp.itemType IN $itemTypes`;
    }
    if (domainTypes?.length) {
      query += ` AND lp.domainType IN $domainTypes`;
    }
    if (tags?.length) {
      query += ` AND ANY(tag IN lp.tags WHERE tag IN $tags)`;
    }

    query += `
      RETURN lp
      ORDER BY lp.nextReview ASC, lp.box ASC
      LIMIT $limit
    `;

    const result = await session.run(query, {
      userId: String(userId),
      asOfDate,
      limit: neo4j.int(limit),
      itemTypes: itemTypes || [],
      domainTypes: domainTypes || [],
      tags: tags || [],
    });

    return result.records.map(r => this._parseNode(r.get('lp')));
  } finally {
    await session.close();
  }
}

/**
 * Process review - update Leitner state
 */
async processReview(id, rating, responseTimeMs, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return { error: 'Invalid session' };

  const session = this.getSession();
  const now = new Date().toISOString();

  // Leitner box intervals (days)
  const BOX_INTERVALS = [1, 2, 4, 7, 14];

  try {
    // First get current state
    const current = await session.run(
      `MATCH (lp:LearningPoint {id: $id, userId: $userId}) RETURN lp`,
      { id, userId: String(userId) }
    );

    if (!current.records.length) {
      return { error: 'Learning point not found' };
    }

    const lp = current.records[0].get('lp').properties;
    const currentBox = lp.box?.toNumber?.() || lp.box || 1;
    const currentEase = lp.easeFactor || 2.5;

    // Calculate new box and ease based on rating
    let newBox = currentBox;
    let newEase = currentEase;
    let isCorrect = false;

    switch (rating) {
      case 1: // Again - back to box 1
        newBox = 1;
        newEase = Math.max(1.3, currentEase - 0.2);
        isCorrect = false;
        break;
      case 2: // Hard - stay, reduce ease
        newBox = currentBox;
        newEase = Math.max(1.3, currentEase - 0.15);
        isCorrect = false;
        break;
      case 3: // Good - advance 1 box
        newBox = Math.min(5, currentBox + 1);
        isCorrect = true;
        break;
      case 4: // Easy - advance 2 boxes, increase ease
        newBox = Math.min(5, currentBox + 2);
        newEase = currentEase + 0.15;
        isCorrect = true;
        break;
    }

    // Calculate next review date
    const intervalDays = BOX_INTERVALS[newBox - 1] || 14;
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
    const nextReview = nextReviewDate.toISOString().split('T')[0];

    // Check if fully learned (box 5 + correct streak >= 3)
    const newStreak = isCorrect ? (lp.correctStreak || 0) + 1 : 0;
    const fullyLearned = newBox === 5 && newStreak >= 3;

    // Update mastery level (0-100)
    const masteryLevel = Math.min(100, Math.round((newBox / 5) * 70 + (newStreak / 5) * 30));

    // Update the node
    const updateResult = await session.run(
      `
      MATCH (lp:LearningPoint {id: $id, userId: $userId})
      SET lp.box = $newBox,
          lp.nextReview = date($nextReview),
          lp.lastReviewedAt = datetime($now),
          lp.reviewCount = lp.reviewCount + 1,
          lp.correctStreak = $newStreak,
          lp.totalCorrect = lp.totalCorrect + $correctInc,
          lp.totalIncorrect = lp.totalIncorrect + $incorrectInc,
          lp.easeFactor = $newEase,
          lp.fullyLearned = $fullyLearned,
          lp.masteryLevel = $masteryLevel,
          lp.lastResponseTimeMs = $responseTimeMs,
          lp.avgResponseTimeMs = CASE
            WHEN lp.reviewCount = 0 THEN $responseTimeMs
            ELSE (lp.avgResponseTimeMs * lp.reviewCount + $responseTimeMs) / (lp.reviewCount + 1)
          END,
          lp.updatedAt = datetime()
      RETURN lp
      `,
      {
        id,
        userId: String(userId),
        newBox: neo4j.int(newBox),
        nextReview,
        now,
        newStreak: neo4j.int(newStreak),
        correctInc: neo4j.int(isCorrect ? 1 : 0),
        incorrectInc: neo4j.int(isCorrect ? 0 : 1),
        newEase,
        fullyLearned,
        masteryLevel: neo4j.int(masteryLevel),
        responseTimeMs: neo4j.int(responseTimeMs),
      }
    );

    return {
      success: true,
      newBox,
      nextReview,
      masteryLevel,
      correctStreak: newStreak,
      reviewCount: (lp.reviewCount || 0) + 1,
      fullyLearned,
    };
  } finally {
    await session.close();
  }
}
```

---

## Migration Strategy

### Phase 1: Add LearningPoint Support (Non-Breaking)

1. Add `LearningPoint` node type to Neo4j
2. Extend `GraphInterface` with new methods
3. Extend `Neo4jAdapter` with Cypher queries
4. Create `LearningPointService.js` for business logic
5. Update IPC handlers to use GraphInterface

### Phase 2: Migrate Existing Data

1. Migrate `Note` nodes → `LearningPoint` (itemType='note')
2. Migrate `Vocabulary` nodes → `LearningPoint` (itemType='word')
3. Keep old nodes with `validTo` set (for rollback)

### Phase 3: Remove SQLite Duplication

1. Remove `learning_point` SQLite table
2. Remove `note` table (keep `note` for offline queue only)
3. Remove `vocabulary` table
4. Remove `leitner_item` table

### Phase 4: Add Adapter Support

1. Create `MemgraphAdapter.js` (Cypher-compatible)
2. Create `FalkorDBAdapter.js` (Cypher-compatible)
3. Test with each adapter

---

## SQLite Minimal Schema (After Migration)

```sql
-- User authentication only
CREATE TABLE "user" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT UNIQUE NOT NULL,
  "password_hash" TEXT,
  "status" INTEGER
);

-- Session tokens
CREATE TABLE "session" (
  "token" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "created_at" TEXT,
  "expires_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

-- Offline queue (sync to Neo4j when online)
CREATE TABLE "offline_queue" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "operation" TEXT NOT NULL,  -- 'CREATE', 'UPDATE', 'DELETE'
  "node_type" TEXT NOT NULL,  -- 'LearningPoint', 'Episode', etc.
  "data" TEXT NOT NULL,       -- JSON payload
  "created_at" TEXT NOT NULL,
  "synced_at" TEXT,
  "error" TEXT
);
```

---

## Test Strategy

1. **Unit Tests**: Mock GraphInterface, test LearningPointService logic
2. **Integration Tests**: Real Neo4j container, full flow testing
3. **Adapter Tests**: Each adapter implementation against same test suite
4. **Migration Tests**: Verify data integrity after migration

---

## Questions Resolved

| Question | Decision |
|----------|----------|
| Primary storage | Neo4j (or Cypher-compatible) |
| SQLite role | Auth + offline queue only |
| Note vs LearningPoint | Unified into LearningPoint |
| Leitner state | Embedded in LearningPoint node |
| Future DB swap | GraphInterface abstraction |
| Offline support | Queue in SQLite, sync to Neo4j |

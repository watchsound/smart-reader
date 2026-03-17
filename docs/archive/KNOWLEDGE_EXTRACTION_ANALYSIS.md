# Knowledge Extraction Cost Analysis

## The Challenge

We want to build a knowledge map from books, but:
- Full concept extraction per chunk is expensive
- We still want meaningful structure for learning
- Embeddings are cheap, summaries are moderate, relationships are expensive

---

## Cost Breakdown (Using GPT-4o-mini as baseline)

| Operation | Input | Cost per Unit | 1000 Chunks |
|-----------|-------|---------------|-------------|
| **Embedding** | Chunk text (~500 tokens) | ~$0.00001 | **$0.01** |
| **Summary** | Chunk → 50 words | ~$0.0005 | **$0.50** |
| **Concept list** | Chunk → 5 concepts | ~$0.001 | **$1.00** |
| **Full extraction** | Chunk → concepts + relations | ~$0.01 | **$10.00** |

**Key insight**: There's a 1000x cost difference between embedding and full extraction.

---

## Strategy Options

### Option A: Concept-Guided Summarization (Your Idea)

```
Step 1: Extract key concepts from book metadata/TOC (ONE call)
        Book title + TOC + first/last paragraphs → 20-50 key concepts
        Cost: ~$0.01-0.05 (single call)

Step 2: Use concepts to guide chunk summarization
        Each chunk → summary mentioning which key concepts appear
        Cost: ~$0.50-1.00 (per 1000 chunks)

Total: ~$0.51-1.05 per book
```

**Prompt for Step 1:**
```
Given this book information:
Title: "Introduction to Algorithms"
TOC: [Chapter titles...]
Description: [Book description...]

Extract 20-50 key concepts that this book covers.
Return as JSON: { "concepts": ["algorithm", "complexity", "sorting", ...] }
```

**Prompt for Step 2:**
```
Summarize this text chunk in 50 words.
Mention which of these concepts appear: [algorithm, complexity, sorting, ...]
Return: { "summary": "...", "concepts_found": ["sorting", "complexity"] }
```

**Pros:**
- 10-20x cheaper than full extraction
- Concepts are consistent across book (same vocabulary)
- Summaries are useful for learning cards
- Concept co-occurrence in chunks gives implicit relationships

**Cons:**
- No explicit relationships between concepts
- May miss concepts not in initial extraction
- Requires two-stage pipeline

---

### Option B: Embedding Clustering + Label Generation

```
Step 1: Chunk book and generate embeddings (cheap)
        Cost: ~$0.01 per book

Step 2: Cluster embeddings locally (free)
        K-means or hierarchical clustering
        Group similar chunks together

Step 3: Generate label for each cluster (moderate)
        "What concept does this group of chunks discuss?"
        Cost: ~$0.01-0.05 (one call per cluster, ~10-30 clusters)

Total: ~$0.02-0.06 per book
```

**Pros:**
- Extremely cheap
- Discovers structure from data (not predefined)
- Clusters become natural "learning units"

**Cons:**
- Cluster boundaries may not match conceptual boundaries
- Labels may be inconsistent
- No relationships between clusters

---

### Option C: Hierarchical Summarization (Map-Reduce)

```
Level 0: Raw chunks (1000 chunks)
         ↓ (embed only, no AI)
Level 1: Group 10 chunks → 1 summary (100 summaries)
         Cost: ~$0.05
Level 2: Group 10 summaries → 1 section summary (10 summaries)
         Cost: ~$0.005
Level 3: All sections → book overview + concept list
         Cost: ~$0.01

Total: ~$0.065 per book
```

**Pros:**
- Very cheap
- Natural hierarchy matches book structure
- Each level provides different granularity

**Cons:**
- Loses detail at higher levels
- Concepts extracted only at top level
- May not capture cross-chapter relationships

---

### Option D: Hybrid - Your Proposal Refined

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Book Ingestion (Always, Fast, Cheap)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Book → Parse → Chunks → Embeddings → Neo4j                │
│                    ↓                                        │
│              (~$0.01/book)                                  │
│                                                             │
│  Also: Extract key concepts from TOC/metadata (~$0.01)     │
│        Store as (:Book)-[:HAS_CONCEPT]->(:Concept)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (User creates learning plan)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Learning Plan Creation (On-Demand, Selective)     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User selects chapters/topics to learn                     │
│        ↓                                                    │
│  For selected chunks only:                                 │
│    - Generate concept-guided summary                        │
│    - Tag with matching concepts from Phase 1                │
│    - Cost: ~$0.001/chunk × selected chunks                 │
│                                                             │
│  Result: Learning cards linked to concepts                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (User studies over time)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: Knowledge Map Evolution (Incremental, Organic)    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  As user reviews cards:                                    │
│    - Track which concepts co-occur in successful reviews   │
│    - Detect patterns: "User always struggles with X after Y"│
│    - Build relationships from USAGE, not extraction         │
│                                                             │
│  Relationships emerge from:                                │
│    1. Concept co-occurrence in chunks                      │
│    2. User review patterns                                 │
│    3. Embedding similarity between concept clusters         │
│                                                             │
│  Cost: $0 (derived from existing data)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Concept Relationships Without LLM Extraction

**Key Insight**: We don't need LLM to extract relationships. We can DERIVE them.

### Method 1: Co-occurrence in Chunks

```
If concepts A and B appear in same chunk frequently:
  → They are related

Strength = count(chunks with both A and B) / count(chunks with A or B)
```

```cypher
// Find related concepts by co-occurrence
MATCH (c1:Concept)<-[:MENTIONS]-(chunk:Chunk)-[:MENTIONS]->(c2:Concept)
WHERE c1.id < c2.id  // Avoid duplicates
WITH c1, c2, count(chunk) AS cooccurrence
WHERE cooccurrence >= 3
MERGE (c1)-[r:RELATED_TO]->(c2)
SET r.strength = cooccurrence
```

### Method 2: Embedding Similarity Between Concepts

```
Concept embedding = average of all chunk embeddings that mention it

If embedding(concept A) is similar to embedding(concept B):
  → They are semantically related
```

```javascript
async function computeConceptEmbedding(conceptId) {
  const chunks = await getChunksMentioningConcept(conceptId);
  const embeddings = chunks.map(c => c.embedding);
  return averageVectors(embeddings);
}

async function findRelatedConcepts(conceptId, threshold = 0.8) {
  const embedding = await computeConceptEmbedding(conceptId);
  return await vectorSearch(embedding, 'Concept', threshold);
}
```

### Method 3: Sequential Proximity

```
If concept A appears in chunk N, and concept B appears in chunk N+1:
  → A may be prerequisite of B (or related)

This captures the author's intended learning sequence.
```

```cypher
// Find sequential concept pairs
MATCH (c1:Concept)<-[:MENTIONS]-(chunk1:Chunk)-[:NEXT]->(chunk2:Chunk)-[:MENTIONS]->(c2:Concept)
WHERE c1 <> c2
WITH c1, c2, count(*) AS sequence_count
WHERE sequence_count >= 2
MERGE (c1)-[r:PRECEDES]->(c2)
SET r.count = sequence_count
```

### Method 4: Learning Path from User Behavior

```
If user masters concept A before successfully learning concept B:
  → A might be prerequisite of B

Track over many users to find patterns.
```

---

## Revised Cost Model

| Phase | Trigger | Cost | What We Get |
|-------|---------|------|-------------|
| **Import** | Book added | ~$0.02 | Chunks + embeddings + key concepts |
| **Plan** | User creates plan | ~$0.10-0.50 | Summaries for selected content |
| **Learn** | User reviews cards | $0 | Relationships from behavior |

**Total per book**: ~$0.02 (import) + ~$0.10-0.50 (if used for learning)

Compare to: ~$10-50 for full concept+relationship extraction

**Savings: 100-500x**

---

## Implementation Recommendation

### Book Import Pipeline

```javascript
async function importBook(bookPath, format, token) {
  // 1. Parse into chunks (free)
  const chunks = await parseBook(bookPath, format, 500);

  // 2. Extract key concepts from metadata (cheap, one call)
  const metadata = await extractBookMetadata(bookPath, format);
  const keyConcepts = await extractKeyConceptsFromMetadata(metadata);
  // Cost: ~$0.01

  // 3. Generate embeddings for all chunks (cheap)
  const embeddings = await batchGenerateEmbeddings(chunks.map(c => c.text));
  // Cost: ~$0.01

  // 4. Store in Neo4j
  const bookNode = await createBookNode(bookPath, metadata, token);
  await batchCreateChunks(bookNode.id, chunks, embeddings, token);
  await createConceptNodes(bookNode.id, keyConcepts, token);

  // 5. Tag chunks with concepts (local, using embeddings)
  await tagChunksWithConcepts(bookNode.id, keyConcepts, token);
  // This uses embedding similarity, not LLM

  return bookNode;
}
```

### Concept Tagging Without LLM

```javascript
async function tagChunksWithConcepts(bookId, concepts, token) {
  // Generate embeddings for concept names
  const conceptEmbeddings = await batchGenerateEmbeddings(
    concepts.map(c => c.name + ': ' + c.description)
  );

  // For each chunk, find matching concepts by similarity
  const chunks = await getChunksForBook(bookId, token);

  for (const chunk of chunks) {
    const matches = [];
    for (let i = 0; i < concepts.length; i++) {
      const similarity = cosineSimilarity(chunk.embedding, conceptEmbeddings[i]);
      if (similarity > 0.75) {
        matches.push({ concept: concepts[i], similarity });
      }
    }

    // Create MENTIONS relationships for top matches
    for (const match of matches.slice(0, 5)) {
      await createMentionsRelationship(chunk.id, match.concept.id, match.similarity);
    }
  }
}
```

**Cost**: Only embedding for concept names (~$0.001 for 50 concepts)
**Result**: Every chunk tagged with relevant concepts, relationships derivable

---

## Summary: The Cheap Knowledge Map

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   Book → Chunks → Embeddings     (~$0.01, always)           │
│            ↓                                                 │
│   Metadata → Key Concepts        (~$0.01, always)           │
│            ↓                                                 │
│   Embedding similarity → Chunk-Concept links  ($0, local)   │
│            ↓                                                 │
│   Co-occurrence → Concept relationships       ($0, derived)  │
│            ↓                                                 │
│   User learning → Prerequisite detection      ($0, behavioral)│
│                                                              │
└──────────────────────────────────────────────────────────────┘

Total cost: ~$0.02 per book
Knowledge gained: Concepts, chunk-concept links, concept relationships
```

**The key insight**:
- Use LLM for what it's good at: understanding metadata, generating summaries
- Use embeddings for similarity (cheap)
- Use graph queries for relationships (free)
- Use user behavior for prerequisites (organic)

No need to ask LLM "what are the relationships between concepts" when we can DERIVE them from data.

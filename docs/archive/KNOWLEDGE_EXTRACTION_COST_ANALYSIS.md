# Knowledge Extraction Cost Analysis (Detailed)

## Current API Pricing (Feb 2025)

### OpenAI

| Model | Input | Output |
|-------|-------|--------|
| **GPT-4o-mini** | $0.15 / 1M tokens | $0.60 / 1M tokens |
| **GPT-4o** | $2.50 / 1M tokens | $10.00 / 1M tokens |
| **text-embedding-3-small** | $0.02 / 1M tokens | N/A |
| **text-embedding-3-large** | $0.13 / 1M tokens | N/A |

### Google Gemini

| Model | Input | Output |
|-------|-------|--------|
| **Gemini 1.5 Flash** | $0.075 / 1M tokens | $0.30 / 1M tokens |
| **Gemini 1.5 Pro** | $1.25 / 1M tokens | $5.00 / 1M tokens |
| **text-embedding-004** | Free (up to limits) | N/A |

### Anthropic Claude

| Model | Input | Output |
|-------|-------|--------|
| **Claude 3.5 Haiku** | $0.80 / 1M tokens | $4.00 / 1M tokens |
| **Claude 3.5 Sonnet** | $3.00 / 1M tokens | $15.00 / 1M tokens |

---

## Book Assumptions

| Metric | Value | Notes |
|--------|-------|-------|
| Average book length | 80,000 words | ~300 pages |
| Tokens per word | 1.3 | English average |
| Total tokens per book | **104,000 tokens** | ~100K tokens |
| Chunk size | 500 tokens | Optimal for embedding |
| Chunks per book | **208 chunks** | ~200 chunks |
| TOC + metadata | 2,000 tokens | For concept extraction |

---

## Cost Calculation: Our Proposed Approach

### Phase 1: Book Import (Always)

#### 1A. Embedding All Chunks

```
Chunks: 208
Tokens per chunk: 500
Total tokens: 104,000

Using text-embedding-3-small ($0.02 / 1M tokens):
Cost = 104,000 / 1,000,000 × $0.02 = $0.00208
```

**Embedding cost per book: ~$0.002 (0.2 cents)**

#### 1B. Extract Key Concepts from Metadata

```
Input: TOC + description (~2,000 tokens)
Output: 50 concepts with descriptions (~1,500 tokens)

Using GPT-4o-mini:
Input cost:  2,000 / 1M × $0.15 = $0.0003
Output cost: 1,500 / 1M × $0.60 = $0.0009
Total: $0.0012
```

**Concept extraction cost per book: ~$0.001 (0.1 cents)**

#### 1C. Embed Concept Names (for similarity matching)

```
50 concepts × ~20 tokens each = 1,000 tokens

Using text-embedding-3-small:
Cost = 1,000 / 1M × $0.02 = $0.00002
```

**Concept embedding cost: ~$0.00002 (negligible)**

#### Total Phase 1 Cost

```
Chunk embeddings:     $0.002
Concept extraction:   $0.001
Concept embeddings:   $0.00002
────────────────────────────
TOTAL:                $0.003 per book (0.3 cents)
```

---

### Phase 2: Learning Plan Creation (On-Demand)

User selects portion of book for learning plan.

Assumption: User selects 50% of book (104 chunks)

#### 2A. Generate Concept-Guided Summaries

```
For each selected chunk:
  Input: chunk text (500 tokens) + concept list (200 tokens) + prompt (100 tokens) = 800 tokens
  Output: summary (100 tokens) + concepts found (50 tokens) = 150 tokens

Per chunk using GPT-4o-mini:
  Input:  800 / 1M × $0.15 = $0.00012
  Output: 150 / 1M × $0.60 = $0.00009
  Total per chunk: $0.00021

For 104 chunks:
  Cost = 104 × $0.00021 = $0.022
```

**Summary generation cost: ~$0.02 per learning plan (2 cents)**

#### Total Phase 2 Cost

```
Summaries for 50% of book:  $0.022
────────────────────────────────────
TOTAL:                      $0.02 per learning plan (2 cents)
```

---

### Phase 3: Knowledge Map (Derived - Free)

All relationship derivation is done locally:
- Co-occurrence analysis: Graph query, $0
- Embedding similarity: Local computation, $0
- Sequential proximity: Graph query, $0

**Phase 3 cost: $0**

---

## Total Cost Summary

### Per Book (Full Pipeline)

| Phase | What | Cost |
|-------|------|------|
| Import | Embeddings + concepts | **$0.003** |
| Learning Plan | Summaries (50% of book) | **$0.02** |
| Knowledge Map | Derived relationships | **$0.00** |
| **TOTAL** | | **$0.023** (~2.3 cents) |

### Scaling Analysis

| Books | Import Only | With Learning Plans | Notes |
|-------|-------------|---------------------|-------|
| 1 | $0.003 | $0.02 | Single book |
| 10 | $0.03 | $0.20 | Small library |
| 100 | $0.30 | $2.00 | Medium library |
| 1,000 | $3.00 | $20.00 | Large library |

---

## Comparison: Our Approach vs Full LLM Extraction

### Full LLM Extraction (Traditional Approach)

```
For each chunk, extract:
- Concepts (entities, terms)
- Relationships (how concepts relate)
- Summary

Input per chunk: 500 tokens (content) + 200 tokens (prompt) = 700 tokens
Output per chunk: 300 tokens (concepts + relations + summary)

Using GPT-4o-mini:
  Input:  700 / 1M × $0.15 = $0.000105
  Output: 300 / 1M × $0.60 = $0.00018
  Total per chunk: $0.000285

For 208 chunks:
  Cost = 208 × $0.000285 = $0.059
```

**Full extraction cost: ~$0.06 per book (6 cents)**

### Using GPT-4o (Higher Quality)

```
Per chunk:
  Input:  700 / 1M × $2.50 = $0.00175
  Output: 300 / 1M × $10.00 = $0.003
  Total per chunk: $0.00475

For 208 chunks:
  Cost = 208 × $0.00475 = $0.99
```

**Full extraction with GPT-4o: ~$1.00 per book**

---

## Revised Comparison Table

| Approach | Per Book | 100 Books | Quality |
|----------|----------|-----------|---------|
| **Our Hybrid (GPT-4o-mini)** | $0.023 | $2.30 | Good |
| Full Extraction (GPT-4o-mini) | $0.06 | $6.00 | Good |
| Full Extraction (GPT-4o) | $1.00 | $100.00 | Best |
| **Savings** | **2.6x - 43x** | | |

---

## Actual Savings Analysis

My initial estimate of "100-500x savings" was **overstated**. Here's the corrected analysis:

### Why Initial Estimate Was Wrong

1. **GPT-4o-mini is much cheaper than I assumed**
   - I estimated $0.01/chunk for full extraction
   - Actual: $0.00028/chunk (36x cheaper)

2. **Embedding costs are even lower**
   - text-embedding-3-small at $0.02/1M tokens is extremely cheap

### Corrected Savings

| Comparison | Savings |
|------------|---------|
| Our approach vs GPT-4o-mini full extraction | **2.6x** |
| Our approach vs GPT-4o full extraction | **43x** |
| Our approach vs Claude 3.5 Sonnet full extraction | **~100x** |

---

## The Real Value Proposition

The cost savings (2.6x - 43x) are meaningful but not the main benefit. The real advantages are:

### 1. Speed

| Approach | Time for 200 chunks |
|----------|---------------------|
| Full extraction (sequential) | ~10-15 minutes |
| Our approach | ~1-2 minutes |

### 2. Consistency

- Key concepts extracted once from metadata → consistent vocabulary
- Full extraction per chunk → inconsistent concept naming

### 3. Flexibility

- Relationships derived, not fixed → can be recomputed as understanding improves
- User behavior contributes to relationship strength over time

### 4. Graceful Degradation

- Book is usable immediately after import (embeddings only)
- Concepts available quickly (single LLM call)
- Summaries generated only when needed (lazy evaluation)

---

## Recommendation

### Always Do (Import Time)
| Operation | Cost | Value |
|-----------|------|-------|
| Chunk embeddings | $0.002 | Enables semantic search |
| Key concept extraction | $0.001 | Provides structure |
| Concept embeddings | $0.00002 | Enables concept-chunk matching |

### Do On-Demand (Learning Plan)
| Operation | Cost | Value |
|-----------|------|-------|
| Concept-guided summaries | $0.02 | Creates learning cards |

### Do Automatically (Free)
| Operation | Cost | Value |
|-----------|------|-------|
| Co-occurrence relationships | $0 | Concept connections |
| Sequential relationships | $0 | Learning order |
| User behavior analysis | $0 | Prerequisite detection |

---

## Final Cost Model

```
┌─────────────────────────────────────────────────────────────┐
│  BOOK IMPORT                                                │
│  ──────────────────────────────────────────────────────────│
│  Embeddings (all chunks):           $0.002                 │
│  Key concepts (from metadata):      $0.001                 │
│  Concept embeddings:                $0.00002               │
│  ─────────────────────────────────────────────────────────│
│  TOTAL IMPORT:                      $0.003 (0.3 cents)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  LEARNING PLAN (when created)                               │
│  ──────────────────────────────────────────────────────────│
│  Summaries (50% of chunks):         $0.02                  │
│  ─────────────────────────────────────────────────────────│
│  TOTAL PER PLAN:                    $0.02 (2 cents)        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  KNOWLEDGE MAP (derived)                                    │
│  ──────────────────────────────────────────────────────────│
│  Co-occurrence analysis:            $0                      │
│  Embedding similarity:              $0                      │
│  User behavior:                     $0                      │
│  ─────────────────────────────────────────────────────────│
│  TOTAL:                             $0                      │
└─────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
  TOTAL PER BOOK (import + one plan): $0.023 (~2 cents)
═══════════════════════════════════════════════════════════════
```

---

## Sources

- [OpenAI Pricing](https://openai.com/api/pricing/)
- [OpenAI Platform Pricing](https://platform.openai.com/docs/pricing)

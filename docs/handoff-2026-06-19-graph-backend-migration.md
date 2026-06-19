# Session handoff — 2026-06-19

Long session: 15 commits across two major arcs (ChromaDB drop + Kùzu → SQLite
migration) plus several Phase 14/15 follow-ups. This note exists so future-you
can pick the thread up cold.

## The big picture

Two concrete questions from the user drove the session:

1. **"Do we use Chroma or Neo4j?"** → Chroma dropped end-to-end. Semantic
   search now lives in the graph store (book chunks, entity embeddings,
   JS-side cosine).
2. **"Right now our app depends on Neo4j installed in the computer — remove
   this dependency."** → `KuzuAdapter` retired; `SqliteAdapter` is the default.
   Neo4j stays as an opt-in for users who want their own server.

App boots without Neo4j now. Smoke green, 2 388 brain/graph/skill tests pass.

## Commits, in landing order

```
dfbce34 chore(graph): drop Kùzu — adapter, dep, docs, smoke-suppression (Pass 4)
622d382 feat(graph): SqliteAdapter wires concept + note-link edges (Pass 3)
057dee6 feat(graph): SqliteAdapter implements embeddings + chunks (Pass 2)
08fca53 feat(graph): introduce SqliteAdapter as default; Kùzu/Neo4j stay opt-in (Pass 1)
f63b2bb feat(brain): extend cross-provider failover to the JSON path
c6cb584 feat(brain): activate cross-provider failover chain in meteredCall
8c8bf47 fix(brain): align DEFAULT_CHAIN with AIProvider enum
f5134fc fix(brain): record canonical provider name in the Call Ledger
7741d9a test(brain): cover HealthTab anomaly rendering + actions
39758d8 perf(brain): memoize predictive model cache + index cells
c09f49d test(brain): cover QuestPacingService.computePacing orchestration
b0d2737 feat(import): show book-indexing progress as toasts
ae6113c chore: remove dead createBook IPC chain
582e695 fix(import): auto-index EPUB/PDF chunks on book import
07fc16a refactor: drop ChromaDB; semantic search lives in the graph store
```

## Important diagnostic finding (don't re-learn this)

`require('kuzu')` **hard-crashes** Electron on win32-x64 — process dies
*during* `dlopen`, **no JS error caught**. Confirmed by inserting
`console.error` before the require and seeing nothing after. The Kùzu prebuilt
binary is Node-ABI only; cmake-js source-compile is blocked by the
[non-ASCII path constraint](CLAUDE.md) (`我的AI项目`). The `IGNORE_PATTERNS`
in [`.erb/scripts/test-smoke.js`](.erb/scripts/test-smoke.js) were the team's
real workaround, not stale legacy — they suppressed the graceful-fallback
warning so the smoke test would pass while Kùzu silently didn't load.

Why this matters: I initially treated those patterns as legacy and tried to
"fix" them by linking kuzu into `src/node_modules`. That made the smoke test
fail because the binary actually segfaulted Electron. **Don't try to wire
Kùzu back in. It doesn't work on this Windows host.**

## Architecture (post-D3)

- **Graph layer in SQLite.** Three new tables in [`db.sql`](db.sql) carry the
  graph state that previously lived in Kùzu/Neo4j:
  - `graph_embedding` — vector embeddings keyed on `(node_type, node_id)`
  - `graph_chunk` — book content chunks for RAG, with inline embedding
  - `graph_edge` — typed relationships (Note→Concept, Note→Note, …)
- **Embeddings**: BLOB-packed `Float32Array.buffer`. ~3 KB per 768-dim vector,
  about ⅓ the JSON size, no stringify cost on the hot path.
- **Similarity**: JS-side cosine, O(n). Fine to ~10k vectors per user. If you
  grow past that, swap to `sqlite-vec` extension — same Windows native-module
  risk applies.
- **GraphInterface contract**: 62 methods. SqliteAdapter implements the ~20
  truly graph-only ones (embeddings, chunks, edges, semantically-similar
  notes) and stubs the rest with safe defaults (`null` / `[]` / `0`). Entity
  managers ([`NoteJsonManager`](src/main/db/NoteJsonManager.js), etc.) own the
  CRUD on note/vocab/bookmark/message tables — SqliteAdapter doesn't duplicate
  that work.

## What's working (no Neo4j needed)

- RAG semantic search over book chunks
- Entity-level `findSimilar` across Note / Bookmark / Message / Concept
- Concept tracking — `createMentionsRelationship` writes Note→Concept edges
  with idempotent upsert
- Wiki-link Knowledge Web — `syncNoteLinks` / `getBacklinks` /
  `getOutgoingLinks` via `graph_edge`
- `findSemanticallySimilarNotes` for the related-notes panel
- Cross-provider failover for both `meteredCall` (text) and `meteredCallJson`
  (structured output)
- Auto-indexing of EPUB/PDF chunks on book import with toast progress

## Known unfinished

1. **Packaged production build crashes within seconds.** Surfaced in test B′
   (the verify-prod step). Stderr is empty — packaged Electron on Windows
   doesn't pipe to bash. Even **without** Kùzu, the prod build dies. Needs
   its own investigation; SqliteAdapter doesn't fix it. **Don't ship until
   this is solved.**
2. **SqliteAdapter stubs that aren't load-bearing yet:** `getDueForReview`,
   `recordReview`, `getLearningPath`, learning-point CRUD, session lifecycle.
   None on critical paths today (entity managers cover the equivalent). Wire
   when a real consumer appears, not pre-emptively.
3. **Settings UI still surfaces a "use Graph" toggle implying Neo4j.** Should
   become "Knowledge Graph: SQLite (embedded, default) / Neo4j (advanced)".
   ~30 min, low risk.
4. **Backfill** — embeddings for notes/bookmarks/messages that existed
   pre-Phase-15. No customers yet, so deferred (no data to repair).

## Files of note

- [`src/main/utils/SqliteAdapter.js`](src/main/utils/SqliteAdapter.js) — the
  new adapter (~530 lines)
- [`db.sql`](db.sql) — three new tables at the end (`graph_embedding`,
  `graph_chunk`, `graph_edge`)
- [`src/main/utils/GraphInterface.js`](src/main/utils/GraphInterface.js) —
  `DEFAULT_ADAPTER_TYPE = 'sqlite'`; `case 'kuzu'` arm deleted
- [`src/__tests__/db/SqliteAdapter.embeddings.test.js`](src/__tests__/db/SqliteAdapter.embeddings.test.js)
  — 10 tests for embeddings + chunks
- [`src/__tests__/db/SqliteAdapter.edges.test.js`](src/__tests__/db/SqliteAdapter.edges.test.js)
  — 8 tests for relationships
- [`CLAUDE.md`](CLAUDE.md) — updated to describe SQLite as the default graph
  backend and call out why Kùzu went away

## Working tree at end of session

Clean except for two pre-existing modified files that were already dirty when
the session started and that I deliberately never touched:

- `src/renderer/views/writing/MultilineTextField.js`
- `src/renderer/views/writing/WritingView.js`

## Next thread, when you come back

In priority order:

1. **Production crash investigation.** App that doesn't ship is bad. Empty
   stderr makes this slow — likely 1–2 hours of bisecting recent commits, or
   diving into Windows event log / Sysinternals Procmon.
2. **Settings UI polish.** Surface the SQLite default explicitly so users
   stop thinking they need Neo4j.
3. **Wire SqliteAdapter stubs** only as real consumers appear.

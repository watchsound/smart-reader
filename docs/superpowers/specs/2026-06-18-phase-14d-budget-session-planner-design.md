# Phase 14d — Budget Session Planner

**Status:** Draft — awaiting user review before plan
**Date:** 2026-06-18
**Predecessor:** 14a (engine), 14b (queue rank), 14c (concept ETA), 14e (Quest pacing)
**Successor:** none in the 14-family (14f folds in here)

---

## 1. Premise

The 14-family's last surface. User opens a "Plan" tab, sets a time budget (5/15/30/60 min) and dollar budget ($0.05/$0.10/$0.30/$1.00), and gets a ranked checklist of (surface, concept) actions selected to maximize predicted mastery delta within budget.

Replaces the implicit "what should I do now?" question with an explicit plan you can work through.

Subsumes 14f (Next-Best-Action) — budget=1 yields a single recommendation.

---

## 2. Decisions locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | Input controls | Two sliders — time (5/15/30/60 min) and dollars ($0.05/$0.10/$0.30/$1.00). Defaults 15 min, $0.30. |
| 2 | Output shape | Ranked checklist of items. Header summary: total Δmastery, total time, total cost, predicted ROI. |
| 3 | Time-per-event | Hardcoded `TIME_PER_EVENT_SEC` map in `predictiveEnums.js`. |
| 4 | Cost-per-event | `predict().expectedCost`. |
| 5 | Selection | Greedy by ROI desc, stop when time OR cost budget exhausts. |
| 6 | Candidate pool | (FSRS due) ∪ (lps in active Quest scope below mastery 80). Capped at top-100 by `updated_at desc`. One candidate per applicable surface. |
| 7 | Placement | New "Plan" tab in `BrainDashboardPanel`, between Predictions and Visibility. |
| 8 | Action wiring | Each item shows "Start" → relevant surface (production-prompt → ProductionPromptPanel, director → SessionRunner, microcard → reading view at lp's book/chapter). Otherwise "Mark done". |

---

## 3. Architecture

### 3.1 Backend

`src/main/utils/BudgetSessionPlanner.js`:

```js
async function computePlan({ timeBudgetMin, dollarBudget, userId = 1 }) {
  // 1. Build candidate pool
  const candidates = collectCandidates(userId);  // top-100 lps × applicable surfaces
  // 2. Score each via engine
  const scored = await Promise.all(candidates.map(scoreCandidate));
  // 3. Greedy fill
  scored.sort((a, b) => b.roi - a.roi);
  const chosen = [];
  let timeSpent = 0;
  let costSpent = 0;
  for (const c of scored) {
    if (timeSpent + c.timeMin > timeBudgetMin) continue;
    if (costSpent + c.expectedCost > dollarBudget) continue;
    chosen.push(c);
    timeSpent += c.timeMin;
    costSpent += c.expectedCost;
  }
  return { items: chosen, totals: { timeMin: timeSpent, cost: costSpent,
    deltaMastery: chosen.reduce((s, c) => s + c.expectedDelta, 0) } };
}
```

`collectCandidates`:
- Union of:
  - `learning_point` where `next_review <= now` AND `user_id = ?` (FSRS-due)
  - `learning_point` where `book_id IN (active quest bookIds)` AND `mastery_level < 80`
- Order by `updated_at DESC`, cap 100
- For each lp, generate candidates for surfaces where the lp has ≥1 recent mastery_event (last 30d), fallback to `director-session` if none

`scoreCandidate`:
- `predict({surface, currentBox: lp.box, domain: lp.domain})` → cost + delta + n + shrinkage
- `time = TIME_PER_EVENT_SEC[surface] / 60`
- `roi = expectedDelta / max(expectedCost, ε)`
- `actionTarget`: enum determining renderer navigation

### 3.2 Time constants

In `predictiveEnums.js`:

```js
const TIME_PER_EVENT_SEC = Object.freeze({
  'production-prompt': 180,
  'comprehension': 120,
  'pre-reading-diagnostic': 60,
  'director-session': 30,
  'reading-microcard': 10,
});
```

### 3.3 IPC

New channel: `budget-plan` → returns `{ items, totals }`. Renderer client: `predictiveApi.plan(args)` (added to existing `predictiveApi`).

Item shape:

```ts
{
  learningPointId: string,
  title: string,
  surface: string,
  domain: string,
  currentBox: number,
  expectedDelta: number,
  expectedCost: number,
  timeMin: number,
  roi: number,
  shrinkageLevel: string,
  n: number,
  actionTarget: 'production-prompt' | 'director-session' | 'reading' | null,
  actionPayload: { bookId?: number, chapterId?: number, learningPointId?: string },
}
```

### 3.4 UI

`src/renderer/components/brainShell/plan/PlanTab.jsx`:
- Two MUI sliders or chip-buttons for budgets
- "Plan now" button triggers fetch
- Header summary card with totals + ROI
- List of items, each row: title, `+ΔM`, `$cost`, `~Nmin`, surface chip, "Start" button
- Action button:
  - `production-prompt` → navigate to `/knowledge?tab=production`
  - `director-session` → navigate to `/study?session=lpId` (existing convention)
  - `reading` → navigate to `/reading/<bookId>` with optional chapter scroll
  - else → "Mark done" toggle

### 3.5 Files

```
src/main/utils/BudgetSessionPlanner.js
src/main/ipc/predictiveHandlers.js          (extend with budget-plan)
src/renderer/api/predictiveApi.js           (add plan method)
src/renderer/components/brainShell/plan/PlanTab.jsx
src/renderer/components/brainShell/BrainDashboardPanel.jsx  (slot tab)
src/main/brain/predictive/predictiveEnums.js  (TIME_PER_EVENT_SEC)
src/__tests__/main/BudgetSessionPlanner.test.js   (greedy fill, budget caps)
```

---

## 4. Success criteria

**Unit (pure-fn extract):**

- Greedy fill stops at time budget when cost slack remains.
- Greedy fill stops at cost budget when time slack remains.
- Empty candidate pool → empty plan, zero totals.
- Items sorted by ROI; ties broken by Δmastery.

**Manual:**

Open Plan tab with seeded data. Set budgets. "Plan now" returns checklist. Start button navigates correctly. Reset budgets re-plans.

**Regression:** All prior 14-family + Phase 9–13 tests pass.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Empty plan when budget too low / no candidates | UI shows "no items fit your budget — try raising it." |
| Candidate pool dominated by one surface (e.g. all production-prompt) → monotonous plan | v1 accepts this; v2 can add surface diversity constraint. |
| Time constants drift from reality | Surfaces them in the spec; review quarterly; replace with measured-from-session in 14g if needed. |
| User starts an action then abandons → no feedback into the model | Out of scope; Phase 9 ledger already records actual events that the engine learns from on next refresh. |

---

## 6. Out of scope

- Measured time-per-event from session history.
- Surface diversity constraint.
- "Re-plan as I go" live updates.
- Persisting plan across sessions.
- 14f as a separate feature — folded in here (budget=1).

---

## 7. Open questions

None.

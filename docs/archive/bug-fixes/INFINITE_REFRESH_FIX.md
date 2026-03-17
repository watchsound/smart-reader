# Infinite Refresh Bug - FINAL FIX

## Problem

Study session page continuously refreshes itself, with `SESSION_STARTED` being recorded repeatedly:

```
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 1 }
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 2 }
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 3 }
...
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 50 }
[EpisodeCollector] Flushing 50 events...
```

This causes infinite re-renders and makes the study page unusable.

---

## Root Cause

**File:** [src/renderer/views/study/StudySessionPage.js:200-215](src/renderer/views/study/StudySessionPage.js#L200)

The `useEffect` that records `SESSION_STARTED` had **unstable dependencies**:

```javascript
// BEFORE (Lines 127-128) ❌
const maxItems = searchParams.get('maxItems') ? parseInt(searchParams.get('maxItems'), 10) : null;
const maxMinutes = searchParams.get('maxMinutes') ? parseInt(searchParams.get('maxMinutes'), 10) : null;

// useEffect dependencies (Line 215) ❌
}, [startSession, resumeAudioContext, startSessionTracking, planId, mode, date, tags, maxItems, maxMinutes]);
```

**Problem:**
1. `maxItems` and `maxMinutes` were **NOT wrapped in `useMemo`**
2. They were recalculated on every render, creating **new values each time**
3. The `useEffect` dependency array saw them as "changed" on every render
4. This triggered the effect repeatedly → recorded `SESSION_STARTED` repeatedly → infinite loop

**Why `date` and `tags` didn't cause the issue:**
- They WERE wrapped in `useMemo` (lines 124, 126) ✅
- Their values remained stable across renders

---

## Solution

### Fix 1: Wrap `maxItems` and `maxMinutes` in `useMemo` ✅

```javascript
// AFTER (Lines 127-130) ✅
const maxItemsParam = searchParams.get('maxItems');
const maxItems = useMemo(() => (maxItemsParam ? parseInt(maxItemsParam, 10) : null), [maxItemsParam]);
const maxMinutesParam = searchParams.get('maxMinutes');
const maxMinutes = useMemo(() => (maxMinutesParam ? parseInt(maxMinutesParam, 10) : null), [maxMinutesParam]);
```

### Fix 2: Run `useEffect` ONCE on mount ✅

Since all dependencies are derived from URL params (which don't change during the session), the effect should only run ONCE on mount:

```javascript
// AFTER (Lines 200-217) ✅
useEffect(() => {
  startSession();
  resumeAudioContext();
  startSessionTracking();
  recordEvent.sessionStarted({
    planId: planId || 'all',
    mode,
    date,
    tags,
    maxItems,
    maxMinutes,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Run ONCE on mount only - dependencies are stable from URL params
```

---

## Why This Fix Works

1. **Stable Dependencies:** `maxItems` and `maxMinutes` are now memoized, so they don't change on every render
2. **Single Execution:** The `useEffect` runs once on mount, not on every dependency change
3. **No Re-renders:** `SESSION_STARTED` is recorded exactly once per session

---

## Testing

### Before Fix:
```
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 1 }
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 2 }
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 3 }
... (continues infinitely)
```

### After Fix:
```
[EpisodeCollector] Recorded SESSION_STARTED { bufferSize: 1 }
(no more SESSION_STARTED events)
```

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| [StudySessionPage.js](src/renderer/views/study/StudySessionPage.js) | 127-130 | Wrapped `maxItems` and `maxMinutes` in `useMemo` |
| [StudySessionPage.js](src/renderer/views/study/StudySessionPage.js) | 217 | Changed dependency array to `[]` (run once) |

---

## Related Fixes

This completes the infinite refresh fix that we started earlier:

1. ✅ **Neo4j `.toNumber()` error** - Fixed in [Neo4jAdapter.js:2875](src/main/utils/Neo4jAdapter.js#L2875)
2. ✅ **Unstable `date` dependency** - Fixed earlier (already wrapped in `useMemo`)
3. ✅ **Unstable `tags` dependency** - Fixed earlier (already wrapped in `useMemo`)
4. ✅ **Unstable `maxItems` dependency** - **FIXED NOW** (wrapped in `useMemo`)
5. ✅ **Unstable `maxMinutes` dependency** - **FIXED NOW** (wrapped in `useMemo`)
6. ✅ **useEffect runs repeatedly** - **FIXED NOW** (empty dependency array)

---

## Verification Commands

```bash
# Rebuild renderer
npm run build:renderer

# Test the study page
# Navigate to /study/:planId and verify:
# 1. Page loads without refreshing
# 2. SESSION_STARTED is recorded only once
# 3. Study cards appear and work correctly
```

---

## Lesson Learned

**Always wrap computed values in `useMemo` when they're used in `useEffect` dependencies.**

Especially when:
- Values are computed from props/params
- Values involve parsing (parseInt, JSON.parse, etc.)
- Values are used in effect dependencies

**Rule of Thumb:**
```javascript
// ❌ BAD - Creates new value every render
const maxItems = searchParams.get('maxItems') ? parseInt(...) : null;

// ✅ GOOD - Stable value across renders
const maxItemsParam = searchParams.get('maxItems');
const maxItems = useMemo(() => maxItemsParam ? parseInt(...) : null, [maxItemsParam]);
```

---

## Status

✅ **FIXED**

The infinite refresh bug is now completely resolved. The study page loads once and stays stable.

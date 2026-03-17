# Sound File Missing Error - FIXED

## Problem

Study session page shows error when trying to play sound effects:
```
GET http://localhost:1212/flip.mp3 404 (Not Found)
Error playing sound flip: DOMException: Failed to load because no supported source was found.
```

This error occurred for all sound types: flip, correct, incorrect, streak, complete, levelUp.

---

## Root Cause

**File:** [src/main/ipc/studyEnhancementHandlers.js:310-336](src/main/ipc/studyEnhancementHandlers.js#L310)

The default sound configuration referenced `.mp3` files that don't exist in the project:

```javascript
sounds: {
  flip: {
    enabled: true,
    volume: 0.4,
    file: 'flip.mp3',      // ❌ File doesn't exist
  },
  correct: {
    enabled: true,
    volume: 0.6,
    file: 'correct.mp3',   // ❌ File doesn't exist
  },
  // ... more sounds referencing missing files
}
```

**Why this caused 404 errors:**
1. `useStudySounds` hook (line 179-188) tries to play custom audio files using `new Audio(soundConfig.file)`
2. The path is relative, so it tries to load from `http://localhost:1212/flip.mp3`
3. These files don't exist in the project

---

## Solution

Changed all sound file references from `.mp3` filenames to `'default'`, which triggers the **Web Audio API fallback**.

**File:** [src/main/ipc/studyEnhancementHandlers.js:310-336](src/main/ipc/studyEnhancementHandlers.js#L310)

```javascript
// BEFORE ❌
sounds: {
  flip: {
    enabled: true,
    volume: 0.4,
    file: 'flip.mp3',
  },
  // ...
}

// AFTER ✅
sounds: {
  flip: {
    enabled: true,
    volume: 0.4,
    file: 'default',  // Use Web Audio API generated sound
  },
  // ...
}
```

---

## How It Works Now

When `file: 'default'`, the `useStudySounds` hook falls back to Web Audio API-generated tones:

**File:** [src/renderer/views/study/hooks/useStudySounds.js:191-195](src/renderer/views/study/hooks/useStudySounds.js#L191)

```javascript
// Use Web Audio API for built-in sounds
const pattern = SOUND_PATTERNS[soundType];
if (pattern && audioContextRef.current) {
  await playMelody(audioContextRef.current, pattern, volume);
}
```

**Sound Patterns (Lines 79-112):**

| Sound | Pattern |
|-------|---------|
| `flip` | Quick 800Hz beep (0.05s) |
| `correct` | C5-E5-G5 ascending melody (pleasant ding) |
| `incorrect` | Low 200-180Hz descending buzz |
| `streak` | C5-E5-G5-C6 celebration melody |
| `complete` | Full C5-E5-G5-C6 fanfare with pause |
| `levelUp` | G4-C5-E5-G5 ascending triangle wave |

These are generated using Web Audio API oscillators - no external files needed!

---

## Why Web Audio API is Better

1. **No file dependencies** - Works immediately without bundling audio files
2. **Small footprint** - No large .mp3 files to bundle
3. **Customizable** - Can adjust frequency, duration, volume programmatically
4. **Fast** - No network requests, instant playback
5. **Cross-platform** - Works on all browsers with Web Audio support

---

## Future Enhancement (Optional)

Users can still provide custom .mp3 files if they want. The system supports:

1. **Default mode** (`file: 'default'`) - Web Audio API generated sounds ✅ CURRENT
2. **Custom files** (`file: '/path/to/custom.mp3'`) - User-provided audio files
3. **System sounds** (future) - Native OS notification sounds

To add custom sounds, users would:
1. Place .mp3 files in a specific directory (e.g., `userData/sounds/`)
2. Update settings to use custom file paths
3. Sounds would play via `<audio>` element instead of Web Audio API

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| [src/main/ipc/studyEnhancementHandlers.js](src/main/ipc/studyEnhancementHandlers.js) | 310-336 | Changed all `file: '*.mp3'` to `file: 'default'` |

---

## Verification

After rebuild:
1. Navigate to study session page
2. Flip a card → Should hear short beep
3. Answer correctly → Should hear pleasant ascending melody (C-E-G)
4. Answer incorrectly → Should hear low buzz
5. No more 404 errors in console

---

## Build Command

```bash
npm run build:main
```

---

## Status

✅ **FIXED**

The sound file error is resolved. Study session sounds now use Web Audio API-generated tones instead of missing .mp3 files.

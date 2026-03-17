# Database Table Initialization Fixes

## Summary

Fixed missing table initialization for new AI Learning and Spaced Repetition features. All new tables now have `CREATE TABLE IF NOT EXISTS` initialization code that runs when their respective manager/service modules are loaded.

## Problem

When implementing the Agentic AI and Learning Plan features, several new tables were added to `db.sql`, but the existing `sqlite_tables.db` file didn't have these tables. This caused runtime errors when trying to use these features.

## Solution

Added `initializeTables()` functions to all manager/service files that use the new tables. These functions:
- Create tables with `CREATE TABLE IF NOT EXISTS` (safe to run multiple times)
- Create indexes with `CREATE INDEX IF NOT EXISTS`
- Run automatically when the module is imported (on app startup)
- Include proper foreign key constraints
- Handle errors gracefully with console logging

## Files Modified

### 1. LearningSessionManager.js ✅
**Tables Created:**
- `learning_session` - Tracks study sessions
- `learning_item_performance` - Tracks individual item reviews

**Changes:**
- Added `initializeTables()` function with table and index creation
- Called on module load

### 2. LearnerProfileManager.js ✅
**Tables Created:**
- `learner_profile` - Global learner characteristics
- `learner_domain_profile` - Domain-specific profiles

**Changes:**
- Added `initializeTables()` function
- Includes UNIQUE constraint on `(user_id, domain_type)`
- Called on module load

### 3. LearningTopicManager.js ✅
**Tables Created:**
- `learning_topic` - Learning topics/subjects

**Changes:**
- Added `initializeTables()` function
- Includes user/status index
- Called on module load

### 4. NotificationManager.js ✅
**Tables Created:**
- `learning_notification` - Learning reminders and notifications

**Changes:**
- Added `initializeTables()` function
- Includes multiple indexes for efficient queries
- Called on module load

### 5. SpacedRepetitionService.js ✅
**Tables Created:**
- `sr_item` - FSRS spaced repetition items
- `sr_review_history` - Review history for analytics
- `sr_user_parameters` - Personalized FSRS parameters

**Changes:**
- Added `initializeTables()` function
- Creates all 3 SR tables and 5 indexes
- Called on module load

## Already Had Initialization ✅

These managers already had proper table initialization:
- `AICacheManager.js` - AI response caching
- `ConsolidatedMemoryManager.js` - Memory consolidation
- `LearningPlanManager.js` - Learning plans
- `SessionAnalyticsManager.js` - Session analytics

## Testing

All tables will be created automatically on next app start. To verify:

1. Delete `sqlite_tables.db` (optional - for clean test)
2. Start the app
3. Tables should be created automatically
4. Check console for any initialization errors

## Table Dependencies

```
user (core table)
  ├─ learner_profile
  ├─ learner_domain_profile
  ├─ learning_topic
  │   ├─ learning_plan (via topic_id)
  │   ├─ learning_session (via topic_id)
  │   ├─ sr_item (via topic_id)
  │   └─ learning_notification (via topic_id)
  ├─ learning_notification
  ├─ sr_item
  ├─ sr_review_history
  └─ sr_user_parameters

learning_plan
  ├─ learning_session (via plan_id)
  └─ learning_notification (via plan_id)

learning_session
  └─ learning_item_performance (via session_id)
```

## Migration Notes

- All initialization is **idempotent** - safe to run multiple times
- Existing data is preserved (tables only created if they don't exist)
- No manual migration needed
- Works for both new and existing installations

## Related Issues Fixed

1. **Issue:** `SqliteError: no such table: learning_session` when starting study session
   - **Fix:** LearningSessionManager now creates table on load

2. **Issue:** Missing learner_profile tables when using AI brain features
   - **Fix:** LearnerProfileManager now creates tables on load

3. **Issue:** Missing notification tables when enabling reminders
   - **Fix:** NotificationManager now creates tables on load

4. **Issue:** Missing SR tables when using FSRS algorithm
   - **Fix:** SpacedRepetitionService now creates tables on load

5. **Issue:** Missing learning_topic table for topic-based learning
   - **Fix:** LearningTopicManager now creates tables on load

DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS "sqlite_sequence";
DROP TABLE IF EXISTS "note";
DROP TABLE IF EXISTS "annotation";
DROP TABLE IF EXISTS "image";
DROP TABLE IF EXISTS "bookmark_group";
DROP TABLE IF EXISTS "bookmark";
DROP TABLE IF EXISTS "history_group";
DROP TABLE IF EXISTS "history";
DROP TABLE IF EXISTS "bookshelf";
DROP TABLE IF EXISTS "book";
DROP TABLE IF EXISTS "prompt";
DROP TABLE IF EXISTS "chat";
DROP TABLE IF EXISTS "message";
DROP TABLE IF EXISTS "quiz_problem";
DROP TABLE IF EXISTS "mood_board";
DROP TABLE IF EXISTS "vocabulary";
DROP TABLE IF EXISTS "vocabulary_set";
DROP TABLE IF EXISTS "leitner_item";
DROP TABLE IF EXISTS "learning_point";
DROP TABLE IF EXISTS "learning_topic";
DROP TABLE IF EXISTS "learning_plan";
DROP TABLE IF EXISTS "learning_session";
DROP TABLE IF EXISTS "learning_item_performance";
DROP TABLE IF EXISTS "learner_profile";
DROP TABLE IF EXISTS "learner_domain_profile";
DROP TABLE IF EXISTS "learning_notification";
DROP TABLE IF EXISTS "sr_item";
DROP TABLE IF EXISTS "sr_review_history";
DROP TABLE IF EXISTS "sr_user_parameters";
DROP TABLE IF EXISTS "ai_cache";
DROP TABLE IF EXISTS "session_analytics";
DROP TABLE IF EXISTS "learning_velocity";
DROP TABLE IF EXISTS "consolidated_memory";
DROP TABLE IF EXISTS "brain_call_ledger";
DROP TABLE IF EXISTS "ai_session_trace";
DROP TABLE IF EXISTS "ai_sessions";
DROP TABLE IF EXISTS "mastery_event";

CREATE TABLE IF NOT EXISTS "user" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "username"  TEXT,
  "email"  TEXT UNIQUE,
  "password_hash" TEXT,
  "status"  INTEGER
);

CREATE TABLE IF NOT EXISTS "note" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "data" TEXT,
  "leitner_item_id"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "annotation" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "data" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE image (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "data" TEXT,
  "hashcode" INTEGER
);

CREATE TABLE IF NOT EXISTS "bookmark_group" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_name" TEXT NOT NULL,
  "parent_group_id" INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER,
  FOREIGN KEY ("parent_group_id") REFERENCES "bookmark_group"("id")
);

CREATE TABLE IF NOT EXISTS "bookmark" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "source_key"  TEXT,
  "source_type" TEXT,
  "cfi"  TEXT,
  "title" TEXT,
  "description" TEXT,
  "image" TEXT,
  "percentage" INTEGER ,
  "used_times" INTEGER ,
  "star" INTEGER ,
  "created_at" TEXT,
  "user_id"  INTEGER,
  "group_id" INTEGER,
  FOREIGN KEY ("group_id") REFERENCES "bookmark_group"("id")
);

CREATE TABLE IF NOT EXISTS "history_group" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_name" TEXT NOT NULL,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "history" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "source_key"  TEXT,
  "source_type" TEXT,
  "description" TEXT,
  "favicon" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER,
  "group_id" INTEGER
);

CREATE TABLE IF NOT EXISTS "bookshelf" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "book" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "key_in_storage" TEXT,
  "id_from_server" INTEGER,
  "name"  TEXT,
  "subtitle" TEXT,
  "author"  TEXT,
  "description" TEXT,
  "cover"  TEXT,
  "format" TEXT,
  "publisher"  TEXT,
  "category" TEXT,
  "from_library" INTEGER,
  "size" INTEGER,
  "path" TEXT,
  "charset"  TEXT,
  "favorite"  INTEGER,
  "bookshelf_id"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "prompt" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "title"  INTEGER,
  "content"  TEXT,
  "source" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "chat" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "description"  TEXT,
  "total_tokens"  INTEGER,
  "learn_about"  INTEGER,
  "pinned" INTEGER,
  "auto_delete" INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "message" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "chat_id"  INTEGER,
  "role"  TEXT,
  "type", TEXT,
  "content" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "quiz_problem" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "data" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "mood_board" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"  TEXT,
  "description"  TEXT,
  "react_grid_layout"   TEXT,
  "react_diagram" TEXT,
  "pinned"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "vocabulary" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "word"  TEXT,
  "definition"  TEXT,
  "related_words"  TEXT,
  "example" TEXT,
  "set_id" INTEGER,
  "leitner_item_id"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE IF NOT EXISTS "leitner_item" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" INTEGER,
  "box" INTEGER,
  "skips" INTEGER,
  "flips" INTEGER,
  "next_review" TEXT,
  "fully_learned" INTEGER,
  "score"  INTEGER
);

CREATE TABLE IF NOT EXISTS "vocabulary_set" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"  TEXT,
  "score"  INTEGER,
  "last_time_at" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

-- ============================================
-- Unified Learning Point Table
-- ============================================
-- Single table for all learning content types:
-- vocabulary, notes, formulas, problems, etc.
-- with embedded Leitner spaced repetition

CREATE TABLE IF NOT EXISTS "learning_point" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,

  -- Content (JSON format for flexibility)
  "title" TEXT NOT NULL,
  "front" TEXT NOT NULL,           -- JSON: { text, html?, image?, latex?, code? }
  "back" TEXT NOT NULL,            -- JSON: { text, html?, image?, latex?, code? }
  "extras" TEXT,                   -- JSON: quiz, mindmap, variables, solution, domain-specific

  -- Classification
  "item_type" TEXT DEFAULT 'concept',       -- word, concept, formula, rule, fact, problem, technique, pattern
  "domain_type" TEXT DEFAULT 'knowledge',   -- vocabulary, math, physics, chemistry, language, knowledge, skill
  "difficulty" TEXT DEFAULT 'intermediate', -- beginner, elementary, intermediate, advanced, expert
  "format" TEXT DEFAULT 'card',             -- card, mindmap, quiz, image, code

  -- Metadata
  "tags" TEXT,                     -- JSON array of strings
  "source_type" TEXT,              -- vocabulary, note, book, url, chat, plan, manual
  "source_id" TEXT,                -- Original ID for migration tracking
  "plan_id" TEXT,                  -- FK to learning_plan if part of a plan
  "book_id" INTEGER,               -- FK to book if extracted from a book

  -- Spaced Repetition (Leitner 5-box embedded)
  "box" INTEGER DEFAULT 1,                  -- 1-5 (Leitner box number)
  "next_review" TEXT,                       -- ISO date for next scheduled review
  "last_reviewed_at" TEXT,                  -- ISO date of last review
  "review_count" INTEGER DEFAULT 0,         -- Total times reviewed
  "correct_streak" INTEGER DEFAULT 0,       -- Current consecutive correct answers
  "total_correct" INTEGER DEFAULT 0,        -- Total correct answers
  "total_incorrect" INTEGER DEFAULT 0,      -- Total incorrect answers
  "fully_learned" INTEGER DEFAULT 0,        -- 1 if graduated (box 5 + stable)

  -- FSRS (optional advanced algorithm)
  "sr_item_id" INTEGER,            -- FK to sr_item for FSRS tracking

  -- Learning Status
  "status" TEXT DEFAULT 'active',           -- active, suspended, archived, deleted
  "mastery_level" INTEGER DEFAULT 0,        -- 0-100 mastery percentage
  "ease_factor" REAL DEFAULT 2.5,           -- Difficulty multiplier for intervals
  "interval_days" INTEGER DEFAULT 1,        -- Current interval in days

  -- Response Metrics
  "avg_response_time_ms" INTEGER,           -- Average response time
  "last_response_time_ms" INTEGER,          -- Most recent response time

  -- Timestamps
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,

  -- Foreign Keys
  FOREIGN KEY ("user_id") REFERENCES "user"("id"),
  FOREIGN KEY ("plan_id") REFERENCES "learning_plan"("id"),
  FOREIGN KEY ("book_id") REFERENCES "book"("id"),
  FOREIGN KEY ("sr_item_id") REFERENCES "sr_item"("id")
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS "idx_lp_user_due" ON "learning_point"("user_id", "next_review", "fully_learned");
CREATE INDEX IF NOT EXISTS "idx_lp_user_box" ON "learning_point"("user_id", "box", "status");
CREATE INDEX IF NOT EXISTS "idx_lp_source" ON "learning_point"("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "idx_lp_plan" ON "learning_point"("plan_id");
CREATE INDEX IF NOT EXISTS "idx_lp_domain_type" ON "learning_point"("user_id", "domain_type", "item_type");
CREATE INDEX IF NOT EXISTS "idx_lp_tags" ON "learning_point"("tags");

-- ============================================
-- AI Learning Companion Tables
-- ============================================

-- Learning Topics (user-created learning goals)
CREATE TABLE IF NOT EXISTS "learning_topic" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "domain_type" TEXT NOT NULL,
  "source_type" TEXT,
  "source_id" TEXT,
  "target_date" TEXT,
  "daily_time_minutes" INTEGER DEFAULT 15,
  "difficulty" TEXT DEFAULT 'auto',
  "status" TEXT DEFAULT 'planning',
  "progress_percent" REAL DEFAULT 0,
  "mastered_items" INTEGER DEFAULT 0,
  "total_items" INTEGER DEFAULT 0,
  "streak_days" INTEGER DEFAULT 0,
  "last_studied_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_topic_user_status" ON "learning_topic"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_learning_topic_domain" ON "learning_topic"("domain_type");

-- Learning Plans (AI-generated curricula)
CREATE TABLE IF NOT EXISTS "learning_plan" (
  "id" TEXT PRIMARY KEY,
  "topic_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "plan_data" TEXT NOT NULL,
  "current_phase" INTEGER DEFAULT 1,
  "current_day" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'active',
  "started_at" TEXT,
  "completed_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,
  FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id"),
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_plan_topic" ON "learning_plan"("topic_id");
CREATE INDEX IF NOT EXISTS "idx_learning_plan_user_status" ON "learning_plan"("user_id", "status");

-- Learning Sessions (individual study sessions)
CREATE TABLE IF NOT EXISTS "learning_session" (
  "id" TEXT PRIMARY KEY,
  "plan_id" TEXT,
  "topic_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "session_type" TEXT NOT NULL,
  "started_at" TEXT NOT NULL,
  "completed_at" TEXT,
  "duration_minutes" INTEGER,
  "items_reviewed" INTEGER DEFAULT 0,
  "items_correct" INTEGER DEFAULT 0,
  "items_new" INTEGER DEFAULT 0,
  "session_data" TEXT,
  FOREIGN KEY ("plan_id") REFERENCES "learning_plan"("id"),
  FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id"),
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_session_topic" ON "learning_session"("topic_id", "started_at");
CREATE INDEX IF NOT EXISTS "idx_learning_session_user" ON "learning_session"("user_id", "started_at");

-- Learning Item Performance (tracks individual item learning history)
CREATE TABLE IF NOT EXISTS "learning_item_performance" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "topic_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "item_type" TEXT NOT NULL,
  "reviewed_at" TEXT NOT NULL,
  "was_correct" INTEGER NOT NULL,
  "response_time_ms" INTEGER,
  "confidence_level" INTEGER,
  "mistake_type" TEXT,
  "difficulty_rating" INTEGER,
  "mastery_before" REAL,
  "mastery_after" REAL,
  "session_id" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user"("id"),
  FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id"),
  FOREIGN KEY ("session_id") REFERENCES "learning_session"("id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_item_perf_topic_item" ON "learning_item_performance"("topic_id", "item_id");
CREATE INDEX IF NOT EXISTS "idx_learning_item_perf_user" ON "learning_item_performance"("user_id", "reviewed_at");

-- Learner Profile (global learning characteristics)
CREATE TABLE IF NOT EXISTS "learner_profile" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL UNIQUE,
  "global_profile" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

-- Learner Domain Profile (per-domain learning characteristics)
CREATE TABLE IF NOT EXISTS "learner_domain_profile" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "domain_type" TEXT NOT NULL,
  "domain_name" TEXT,
  "profile_data" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,
  UNIQUE("user_id", "domain_type"),
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "idx_learner_domain_profile_user" ON "learner_domain_profile"("user_id");

-- Learning Notifications (persistent notification store)
CREATE TABLE IF NOT EXISTS "learning_notification" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "priority" TEXT DEFAULT 'normal',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "icon" TEXT,
  "color" TEXT,
  "plan_id" TEXT,
  "topic_id" TEXT,
  "action_url" TEXT,
  "action_label" TEXT,
  "actions" TEXT,
  "created_at" TEXT NOT NULL,
  "scheduled_for" TEXT,
  "expires_at" TEXT,
  "status" TEXT DEFAULT 'delivered',
  "read_at" TEXT,
  "actioned_at" TEXT,
  "persistent" INTEGER DEFAULT 0,
  "dismissible" INTEGER DEFAULT 1,
  FOREIGN KEY ("user_id") REFERENCES "user"("id"),
  FOREIGN KEY ("plan_id") REFERENCES "learning_plan"("id"),
  FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_notification_user_status" ON "learning_notification"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_learning_notification_scheduled" ON "learning_notification"("scheduled_for");

-- ============================================
-- Adaptive Spaced Repetition (FSRS) Tables
-- ============================================

-- SR Items (tracks spaced repetition state for any learning item)
CREATE TABLE IF NOT EXISTS "sr_item" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "item_id" TEXT NOT NULL,
  "item_type" TEXT NOT NULL,
  "topic_id" TEXT,
  "state" INTEGER DEFAULT 0,
  "difficulty" REAL DEFAULT 5.0,
  "stability" REAL DEFAULT 0,
  "last_review" TEXT,
  "next_review" TEXT,
  "review_count" INTEGER DEFAULT 0,
  "lapse_count" INTEGER DEFAULT 0,
  "created_at" TEXT NOT NULL,
  UNIQUE("user_id", "item_id", "item_type"),
  FOREIGN KEY ("user_id") REFERENCES "user"("id"),
  FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id")
);

CREATE INDEX IF NOT EXISTS "idx_sr_item_user_due" ON "sr_item"("user_id", "next_review");
CREATE INDEX IF NOT EXISTS "idx_sr_item_user_type" ON "sr_item"("user_id", "item_type");
CREATE INDEX IF NOT EXISTS "idx_sr_item_topic" ON "sr_item"("topic_id");

-- SR Review History (tracks individual reviews for analytics and optimization)
CREATE TABLE IF NOT EXISTS "sr_review_history" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "item_id" TEXT NOT NULL,
  "item_type" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "response_time_ms" INTEGER,
  "elapsed_days" REAL,
  "retrievability" REAL,
  "stability_before" REAL,
  "stability_after" REAL,
  "difficulty_before" REAL,
  "difficulty_after" REAL,
  "interval" INTEGER,
  "topic_id" TEXT,
  "reviewed_at" TEXT NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "user"("id"),
  FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id")
);

CREATE INDEX IF NOT EXISTS "idx_sr_review_history_user" ON "sr_review_history"("user_id", "reviewed_at");
CREATE INDEX IF NOT EXISTS "idx_sr_review_history_item" ON "sr_review_history"("item_id", "item_type");

-- SR User Parameters (personalized FSRS parameters per user)
CREATE TABLE IF NOT EXISTS "sr_user_parameters" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL UNIQUE,
  "parameters" TEXT NOT NULL,
  "optimized_at" TEXT,
  "review_count_at_optimization" INTEGER,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

-- ============================================
-- AI Cache Table
-- ============================================
-- Caches AI-generated content (hints, pronunciations, explanations)
-- to avoid repeated API calls

CREATE TABLE IF NOT EXISTS "ai_cache" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "cache_type" TEXT NOT NULL,
  "cache_key" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" TEXT,
  "expires_at" TEXT,
  "created_at" TEXT NOT NULL,
  "user_id" INTEGER,
  UNIQUE(cache_type, cache_key, user_id)
);

CREATE INDEX IF NOT EXISTS "idx_ai_cache_lookup"
  ON "ai_cache"(cache_type, cache_key, user_id);

-- ============================================
-- Session Analytics Tables
-- ============================================
-- Tracks detailed analytics for study sessions

CREATE TABLE IF NOT EXISTS "session_analytics" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "hour_of_day" INTEGER,
  "day_of_week" INTEGER,
  "focus_score" REAL,
  "efficiency_score" REAL,
  "avg_response_time_ms" INTEGER,
  "retention_rate" REAL,
  "streak_length" INTEGER,
  "hints_used" INTEGER DEFAULT 0,
  "concepts_improved" TEXT,
  "created_at" TEXT NOT NULL,
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS "idx_session_analytics_user"
  ON "session_analytics"(user_id, created_at);

-- Learning Velocity (tracks mastery change over time)
CREATE TABLE IF NOT EXISTS "learning_velocity" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "topic_id" TEXT,
  "date" TEXT NOT NULL,
  "mastery_start" REAL,
  "mastery_end" REAL,
  "velocity" REAL,
  "items_studied" INTEGER,
  "time_spent_minutes" INTEGER,
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_learning_velocity_user_date"
  ON "learning_velocity"(user_id, date);

-- ============================================
-- Memory Consolidation Tables
-- ============================================

-- Consolidated Memory (LLM-synthesized learning summaries)
CREATE TABLE IF NOT EXISTS "consolidated_memory" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "concept_id" TEXT,
  "concept_name" TEXT,
  "memory_type" TEXT NOT NULL,
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "episode_count" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "insights" TEXT,
  "learning_process" TEXT,
  "metrics" TEXT,
  "source_episodes" TEXT,
  "mastery_assessment" TEXT,
  "learning_style" TEXT,
  "recommendations" TEXT,
  "created_at" TEXT NOT NULL,
  "expires_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
);

CREATE INDEX IF NOT EXISTS "idx_consolidated_memory_user_period"
  ON "consolidated_memory"("user_id", "period_start");
CREATE INDEX IF NOT EXISTS "idx_consolidated_memory_concept"
  ON "consolidated_memory"("concept_id");
CREATE INDEX IF NOT EXISTS "idx_consolidated_memory_type"
  ON "consolidated_memory"("memory_type");

-- ============================================
-- Phase 9 Brain Spine — Call Ledger
-- ============================================

CREATE TABLE IF NOT EXISTS "brain_call_ledger" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "intent" TEXT NOT NULL,
  "ts" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "context_keys" TEXT,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "cost_usd" REAL,
  "cache_hit" INTEGER NOT NULL DEFAULT 0,
  "cache_key" TEXT,
  "duration_ms" INTEGER,
  "trigger_id" TEXT,
  "trace_id" TEXT,
  "output_summary" TEXT,
  "output_json" TEXT,  -- full structured output JSON; consumed by Rationale Card and Phase 10 Director Mode
  -- Phase 15 (provider failover): per-attempt tracking.
  -- attempt_n is 1-indexed within a single brainCall; failover_reason names
  -- the error class that triggered the next attempt; error captures the
  -- message for this row's own failed attempt (null on success).
  "attempt_n" INTEGER NOT NULL DEFAULT 1,
  "failover_reason" TEXT,
  "error" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_brain_call_ledger_ts" ON "brain_call_ledger"("ts");
CREATE INDEX IF NOT EXISTS "idx_brain_call_ledger_intent_ts" ON "brain_call_ledger"("intent", "ts");
CREATE INDEX IF NOT EXISTS "idx_brain_call_ledger_trigger" ON "brain_call_ledger"("trigger_id");
CREATE INDEX IF NOT EXISTS "idx_brain_call_ledger_cache" ON "brain_call_ledger"("intent", "cache_key");
CREATE INDEX IF NOT EXISTS "idx_brain_call_ledger_trace" ON brain_call_ledger("trace_id");

-- ============================================
-- Phase 10b Study-Session Director — AI Sessions
-- ============================================

CREATE TABLE IF NOT EXISTS "ai_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" INTEGER NOT NULL,
  "quest_id" INTEGER,
  "goal" TEXT NOT NULL,
  "trace_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "iteration" INTEGER NOT NULL DEFAULT 0,
  "budget" INTEGER NOT NULL DEFAULT 12,
  "started_at" INTEGER NOT NULL,
  "ended_at" INTEGER,
  "error_reason" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_ai_sessions_user_id" ON "ai_sessions" ("user_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_ai_sessions_trace_id" ON "ai_sessions" ("trace_id");

CREATE TABLE IF NOT EXISTS "ai_session_trace" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" TEXT NOT NULL,
  "iteration" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL,
  "ts" INTEGER NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "ai_sessions" ("id")
);
CREATE INDEX IF NOT EXISTS "idx_ai_session_trace_session_id" ON "ai_session_trace" ("session_id", "ts" ASC);

-- ============================================
-- Phase 12 Historical Mastery Trajectory
-- ============================================

-- Mastery Event Log (append-only event log for mastery state changes)
CREATE TABLE IF NOT EXISTS "mastery_event" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "learning_point_id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "ts" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "prev_box" INTEGER,
  "new_box" INTEGER,
  "prev_mastery" REAL,
  "new_mastery" REAL,
  "rating" TEXT,
  "source" TEXT NOT NULL,
  "source_ref" TEXT,
  "notes" TEXT,
  "proximate_call_id" INTEGER,
  "feature_surface" TEXT NOT NULL DEFAULT 'unknown',
  FOREIGN KEY ("learning_point_id") REFERENCES "learning_point" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("proximate_call_id") REFERENCES "brain_call_ledger" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "idx_mastery_event_lp_ts" ON "mastery_event" ("learning_point_id", "ts");
CREATE INDEX IF NOT EXISTS "idx_mastery_event_user_ts" ON "mastery_event" ("user_id", "ts");
CREATE INDEX IF NOT EXISTS "idx_mastery_event_surface_ts" ON "mastery_event" ("feature_surface", "ts");
CREATE INDEX IF NOT EXISTS "idx_mastery_event_proximate_call" ON "mastery_event" ("proximate_call_id")
  WHERE "proximate_call_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_mastery_event_dedup" ON "mastery_event" (
  "learning_point_id", "ts", "event_type", COALESCE("source_ref", '')
);
-- Phase 13 backfill data migration: tag existing Phase-12 backfill rows.
-- Idempotent: re-running this on already-tagged rows is a no-op.
UPDATE mastery_event SET feature_surface = 'backfill'
  WHERE source = 'backfill' AND feature_surface = 'unknown';

-- Phase 15b — anomaly / regression detection. One row per detected
-- anomaly instance (UNIQUE on kind+key so rescan is idempotent).
-- `evidence_json` carries the per-kind detail payload; `acknowledged_at`
-- is set when the user mutes a specific instance.
CREATE TABLE IF NOT EXISTS "brain_anomaly" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "kind" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "evidence_json" TEXT,
  "since_ts" INTEGER NOT NULL,
  "last_seen_ts" INTEGER NOT NULL,
  "acknowledged_at" INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_brain_anomaly_kind_key"
  ON "brain_anomaly" ("kind", "key");
CREATE INDEX IF NOT EXISTS "idx_brain_anomaly_last_seen"
  ON "brain_anomaly" ("last_seen_ts");

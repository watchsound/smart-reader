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

CREATE TABLE "user" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "username"  TEXT,
  "email"  TEXT,
  "password_hash" TEXT,
  "status"  INTEGER
);

CREATE TABLE "note" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "data" TEXT,
  "leitner_item_id"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "annotation" (
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

CREATE TABLE "bookmark_group" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_name" TEXT NOT NULL,
  "parent_group_id" INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER,
  FOREIGN KEY ("parent_group_id") REFERENCES "bookmark_group"("id")
);

CREATE TABLE "bookmark" (
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

CREATE TABLE "history_group" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_name" TEXT NOT NULL,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "history" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "source_key"  TEXT,
  "source_type" TEXT,
  "description" TEXT,
  "favicon" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER,
  "group_id" INTEGER
);

CREATE TABLE "bookshelf" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "book" (
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

CREATE TABLE "prompt" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "title"  INTEGER,
  "content"  TEXT,
  "source" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "chat" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "description"  TEXT,
  "total_tokens"  INTEGER,
  "pinned" INTEGER,
  "auto_delete" INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "message" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "chat_id"  INTEGER,
  "role"  TEXT,
  "content" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "quiz_problem" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "data" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "mood_board" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"  TEXT,
  "description"  TEXT,
  "react_grid_layout"   TEXT,
  "react_diagram" TEXT,
  "pinned"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

CREATE TABLE "vocabulary" (
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

CREATE TABLE "leitner_item" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" INTEGER,
  "box" INTEGER,
  "skips" INTEGER,
  "flips" INTEGER,
  "next_review" TEXT,
  "fully_learned" INTEGER,
  "score"  INTEGER
);

CREATE TABLE "vocabulary_set" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"  TEXT,
  "score"  INTEGER,
  "last_time_at" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

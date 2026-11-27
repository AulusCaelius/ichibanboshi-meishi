import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Initialize SQLite database with required schema for users, sessions,
 * works, uploads, custom templates, favorites, and daily analytics.
 */
export function openDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      idol TEXT DEFAULT '',
      color TEXT DEFAULT '#FF7600',
      company TEXT DEFAULT '初星学園',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      slug TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      pv INTEGER NOT NULL DEFAULT 0,
      saves INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_works_user ON works(user_id);
    CREATE INDEX IF NOT EXISTS idx_works_updated ON works(updated_at DESC);

    CREATE TABLE IF NOT EXISTS daily_stats (
      work_id TEXT NOT NULL,
      day TEXT NOT NULL,
      pv INTEGER NOT NULL DEFAULT 0,
      saves INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (work_id, day),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      mime TEXT NOT NULL,
      filename TEXT NOT NULL,
      data BLOB NOT NULL,
      byte_size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, template_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  return db;
}

export function todayIsoDay(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function build7DayTrend(db, workId) {
  const rows = db.prepare('SELECT day, pv FROM daily_stats WHERE work_id = ?').all(workId);
  const map = new Map(rows.map((r) => [r.day, Number(r.pv || 0)]));
  const out = [];
  const now = Date.now();
  for (let offset = 6; offset >= 0; offset--) {
    const key = todayIsoDay(now - offset * 86400 * 1000);
    out.push(map.get(key) || 0);
  }
  return out;
}

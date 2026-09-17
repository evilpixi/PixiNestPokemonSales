import { DatabaseSync } from 'node:sqlite';

export const db = new DatabaseSync('pokemon.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    price INTEGER NOT NULL,
    sold INTEGER NOT NULL DEFAULT 0
  )
`);

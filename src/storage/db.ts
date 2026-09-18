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

db.exec(`
  CREATE TABLE IF NOT EXISTS sale (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client TEXT NOT NULL,
    address INTEGER NOT NULL,
    productid INTEGER NOT NULL,
    price INTEGER NOT NULL,
    date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stripedata TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);
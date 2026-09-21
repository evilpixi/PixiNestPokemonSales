import { DatabaseSync } from 'node:sqlite';

export const db = new DatabaseSync('pokemon.db');

// Several processes can open this file at once (dev server, parallel test workers): wait instead of failing.
db.exec('PRAGMA busy_timeout = 5000');

// Prices are stored as REAL dollars (e.g. 0.15 = 15 cents). Stripe wants cents,
// the conversion happens in SaleService.
db.exec(`
  CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    price REAL NOT NULL,
    sold INTEGER NOT NULL DEFAULT 0
  )
`);

// stripedata holds the Stripe Checkout Session id (cs_...).
db.exec(`
  CREATE TABLE IF NOT EXISTS sale (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client TEXT NOT NULL,
    address TEXT NOT NULL,
    productid INTEGER NOT NULL REFERENCES pokemon(id),
    price REAL NOT NULL,
    date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stripedata TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL
  )
`);

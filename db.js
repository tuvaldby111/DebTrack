// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT,
      profilePicture TEXT,
      startingBalance REAL
    )
  `);

  // Create entries table
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      debtor TEXT,
      creditor TEXT,
      amount REAL,
      description TEXT,
      date TEXT,
      status TEXT,
      paid INTEGER,
      paymentMethod TEXT,
      approved INTEGER
    )
  `);
});

module.exports = db;

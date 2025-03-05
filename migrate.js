// migrate.js
const fs = require('fs');
const path = require('path');
const db = require('./db');

const JSON_FILE = path.join(__dirname, 'data.json');

const rawData = fs.readFileSync(JSON_FILE, 'utf8');
const data = JSON.parse(rawData);

// Insert users
data.users.forEach(user => {
  db.run(
    `INSERT OR IGNORE INTO users (username, password, profilePicture, startingBalance)
     VALUES (?, ?, ?, ?)`,
    [user.username, user.password, user.profilePicture || '', user.startingBalance || 0],
    (err) => {
      if (err) console.error(err.message);
    }
  );
});

// Insert entries
data.entries.forEach(entry => {
  db.run(
    `INSERT OR IGNORE INTO entries 
      (id, debtor, creditor, amount, description, date, status, paid, paymentMethod, approved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.debtor,
      entry.creditor,
      entry.amount,
      entry.description || '',
      entry.date,
      entry.status || 'accepted',
      entry.paid ? 1 : 0,
      entry.paymentMethod || 'virtual',
      entry.approved ? 1 : 0
    ],
    (err) => {
      if (err) console.error(err.message);
    }
  );
});

console.log('Migration complete!');

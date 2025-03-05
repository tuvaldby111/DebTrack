// server.js
const express = require('express');
const db = require('./db'); // our new SQLite database module
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Signup
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: 'Username and password are required.' });
  }
  const sql = `
    INSERT INTO users (username, password, profilePicture, startingBalance)
    VALUES (?, ?, '', 0)
  `;
  db.run(sql, [username, password], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.json({ success: false, message: 'User already exists.' });
      }
      console.error(err);
      return res.json({ success: false, message: 'Failed to create user.' });
    }
    const newUser = { username, password, profilePicture: '', startingBalance: 0 };
    return res.json({ success: true, user: newUser });
  });
});

// API: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const sql = `SELECT * FROM users WHERE lower(username)=lower(?) AND password=?`;
  db.get(sql, [username, password], (err, row) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Error during login.' });
    }
    if (row) {
      return res.json({ success: true, user: row });
    } else {
      return res.json({ success: false, message: 'Invalid credentials.' });
    }
  });
});

// API: Reset Password
app.post('/api/reset-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const sqlSelect = `SELECT * FROM users WHERE lower(username)=lower(?)`;
  db.get(sqlSelect, [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Error resetting password.' });
    }
    if (!row) {
      return res.json({ success: false, message: 'User not found.' });
    }
    if (row.password !== oldPassword) {
      return res.json({ success: false, message: 'Old password is incorrect.' });
    }
    const sqlUpdate = `UPDATE users SET password=? WHERE lower(username)=lower(?)`;
    db.run(sqlUpdate, [newPassword, username], function(err) {
      if (err) {
        console.error(err);
        return res.json({ success: false, message: 'Failed to update password.' });
      }
      return res.json({ success: true });
    });
  });
});

// API: Get all users
app.get('/api/users', (req, res) => {
  const sql = `SELECT * FROM users`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, users: [] });
    }
    return res.json({ success: true, users: rows });
  });
});

// API: Get all entries
app.get('/api/entries', (req, res) => {
  const sql = `SELECT * FROM entries`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, entries: [] });
    }
    return res.json({ success: true, entries: rows });
  });
});

// API: Add a new debt entry (virtual or physical transaction)
app.post('/api/entry', (req, res) => {
  const { debtor, creditor, amount, description, paymentMethod } = req.body;
  if (!debtor || !creditor || !amount) {
    return res.json({ success: false, message: 'Missing required fields.' });
  }
  const id = Date.now();
  const sql = `
    INSERT INTO entries (id, debtor, creditor, amount, description, date, status, paid, paymentMethod, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const date = new Date().toISOString();
  const status = "accepted";
  const paid = 0;
  const pm = paymentMethod || "virtual";
  const approved = (pm === "physical") ? 0 : null; // for virtual, we ignore approved
  db.run(sql, [id, debtor, creditor, parseFloat(amount), description || '', date, status, paid, pm, approved], function(err) {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Failed to add entry.' });
    }
    return res.json({ success: true, entry: { id, debtor, creditor, amount: parseFloat(amount), description: description || '', date, status, paid, paymentMethod: pm, approved } });
  });
});

// API: Approve a physical transaction (only if acting user is the creditor)
app.post('/api/entry/approve', (req, res) => {
  const { id, username } = req.body;
  const sqlSelect = `SELECT * FROM entries WHERE id = ?`;
  db.get(sqlSelect, [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Error approving transaction.' });
    }
    if (!row) {
      return res.json({ success: false, message: 'Invalid transaction id.' });
    }
    if (row.creditor !== username) {
      return res.json({ success: false, message: 'Not authorized to approve this transaction.' });
    }
    const sqlUpdate = `UPDATE entries SET approved = 1 WHERE id = ?`;
    db.run(sqlUpdate, [id], function(err) {
      if (err) {
        console.error(err);
        return res.json({ success: false, message: 'Failed to approve transaction.' });
      }
      return res.json({ success: true });
    });
  });
});

// API: Update user profile (change username, profile picture, and optionally starting balance)
app.put('/api/user', (req, res) => {
  const { username, newUsername, profilePicture, startingBalance } = req.body;
  const sqlSelect = `SELECT * FROM users WHERE lower(username)=lower(?)`;
  db.get(sqlSelect, [username], (err, row) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Error updating profile.' });
    }
    if (!row) {
      return res.json({ success: false, message: 'User not found.' });
    }
    // Check if new username already exists if provided
    if(newUsername) {
      const sqlCheck = `SELECT * FROM users WHERE lower(username)=lower(?)`;
      db.get(sqlCheck, [newUsername], (err, conflict) => {
        if (conflict) {
          return res.json({ success: false, message: 'New username is already taken.' });
        } else {
          updateUser();
        }
      });
    } else {
      updateUser();
    }
    
    function updateUser() {
      const sqlUpdate = `
        UPDATE users 
        SET username = COALESCE(?, username), 
            profilePicture = COALESCE(?, profilePicture), 
            startingBalance = COALESCE(?, startingBalance)
        WHERE lower(username)=lower(?)
      `;
      db.run(sqlUpdate, [newUsername, profilePicture, (typeof startingBalance !== "undefined") ? parseFloat(startingBalance) : null, username], function(err) {
        if (err) {
          console.error(err);
          return res.json({ success: false, message: 'Failed to update profile.' });
        }
        const sqlReturn = `SELECT * FROM users WHERE lower(username)=lower(?)`;
        db.get(sqlReturn, [newUsername || username], (err, updatedUser) => {
          if (err) {
            console.error(err);
            return res.json({ success: false, message: 'Error retrieving updated user.' });
          }
          return res.json({ success: true, user: updatedUser });
        });
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

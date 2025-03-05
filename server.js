// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Utility: read data from JSON file
function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], entries: [] };
  }
  const rawData = fs.readFileSync(DATA_FILE);
  return JSON.parse(rawData);
}

// Utility: write data to JSON file
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API: Signup
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: 'Username and password are required.' });
  }
  const data = readData();
  const existingUser = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUser) {
    return res.json({ success: false, message: 'User already exists.' });
  }
  // In production, never store plain text passwords.
  const newUser = { username, password, profilePicture: "", startingBalance: 0 };
  data.users.push(newUser);
  writeData(data);
  res.json({ success: true, user: newUser });
});

// API: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const data = readData();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (user) {
    return res.json({ success: true, user });
  } else {
    return res.json({ success: false, message: 'Invalid credentials.' });
  }
});

// API: Reset Password
app.post('/api/reset-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const data = readData();
  const userIndex = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (userIndex === -1) {
    return res.json({ success: false, message: 'User not found.' });
  }
  if (data.users[userIndex].password !== oldPassword) {
    return res.json({ success: false, message: 'Old password is incorrect.' });
  }
  data.users[userIndex].password = newPassword;
  writeData(data);
  res.json({ success: true });
});

// API: Get all users
app.get('/api/users', (req, res) => {
  const data = readData();
  res.json({ success: true, users: data.users });
});

// API: Get all entries
app.get('/api/entries', (req, res) => {
  const data = readData();
  res.json({ success: true, entries: data.entries });
});

// API: Add a new debt entry (virtual or physical transaction)
app.post('/api/entry', (req, res) => {
  const { debtor, creditor, amount, description, paymentMethod } = req.body;
  if (!debtor || !creditor || !amount) {
    return res.json({ success: false, message: 'Missing required fields.' });
  }
  const newEntry = {
    id: Date.now(),
    debtor,
    creditor,
    amount: parseFloat(amount),
    description: description || '',
    date: new Date().toISOString(),
    status: "accepted",
    paid: false,
    paymentMethod: paymentMethod || "virtual"
  };
  if (paymentMethod && paymentMethod === "physical") {
    newEntry.approved = false;
  }
  const data = readData();
  data.entries.push(newEntry);
  writeData(data);
  res.json({ success: true, entry: newEntry });
});

// API: Approve a physical transaction (only if acting user is the creditor)
app.post('/api/entry/approve', (req, res) => {
  const { id, username } = req.body;
  const data = readData();
  const index = data.entries.findIndex(entry => entry.id === id);
  if (index === -1) {
    return res.json({ success: false, message: 'Invalid transaction id.' });
  }
  const entry = data.entries[index];
  if (entry.creditor !== username) {
    return res.json({ success: false, message: 'Not authorized to approve this transaction.' });
  }
  data.entries[index].approved = true;
  writeData(data);
  res.json({ success: true });
});

// API: Update user profile (change username, profile picture, and starting balance optionally)
app.put('/api/user', (req, res) => {
  const { username, newUsername, profilePicture, startingBalance } = req.body;
  const data = readData();
  const userIndex = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (userIndex === -1) {
    return res.json({ success: false, message: 'User not found.' });
  }
  if(newUsername) {
    const conflict = data.users.find(u => u.username.toLowerCase() === newUsername.toLowerCase());
    if(conflict) {
      return res.json({ success: false, message: 'New username is already taken.' });
    }
    data.users[userIndex].username = newUsername;
  }
  if(profilePicture) {
    data.users[userIndex].profilePicture = profilePicture;
  }
  if(typeof startingBalance !== "undefined") {
    data.users[userIndex].startingBalance = parseFloat(startingBalance);
  }
  writeData(data);
  res.json({ success: true, user: data.users[userIndex] });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

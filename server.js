const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'your_super_secret_key_change_me';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// DB path
const DB_PATH = path.join(__dirname, 'db.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_PATH)) {
  const initialData = {
    users: [
      {
        id: 1,
        username: 'admin',
        password: bcrypt.hashSync('admin123', 8),
        email: 'admin@explorevibe.com'
      }
    ],
    packages: [
      // ... (will add many spots below)
    ],
    wishlist: [], // { userId, packageId }
    bookings: [], // { id, userId, packageId, date, guests, status }
    nextId: { package: 100, booking: 1, user: 2 }
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

const readDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// Middleware: verify token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== AUTH ==========

  const db = readDB();
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  const hashed = bcrypt.hashSync(password, 8);
  const newUser = { id: db.nextId.user++, username, password: hashed, email };
  db.users.push(newUser);
  writeDB(db);
  const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: newUser.id, username, email } });
app.post('/api/packages', authenticate, (req, res) => {
  const db = readDB();
  const { title, price, duration, location, description, image, category, highlights, itinerary, images } = req.body;
  if (!title || !price || !duration || !location || !description) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const newPkg = {
    id: db.nextId.package++,
    title,
    price: parseFloat(price),
    duration,
    location,
    description,
    image: image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=220&fit=crop&crop=center&auto=format',
    category: category || 'General',
    rating: 4.5,
    reviews: 0,
    highlights: highlights || 'Experience the best of this destination.',
    itinerary: itinerary || 'Day 1: Arrival, Day 2: Sightseeing, Day 3: Leisure, Day 4: Departure',
    images: images || [image] // array of image URLs
  };
  db.packages.push(newPkg);
  writeDB(db);
  res.status(201).json(newPkg);
});

app.post('/api/packages', authenticate, (req, res) => {
  const db = readDB();
  const { title, price, duration, location, description, image, category } = req.body;
  if (!title || !price || !duration || !location || !description) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const newPkg = {
    id: db.nextId.package++,
    title,
    price: parseFloat(price),
    duration,
    location,
    description,
    image: image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=220&fit=crop&crop=center&auto=format',
    category: category || 'General',
    rating: 4.5,
    reviews: 0
  };
  db.packages.push(newPkg);
  writeDB(db);
  res.status(201).json(newPkg);
});

app.delete('/api/packages/:id', authenticate, (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  const index = db.packages.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  db.packages.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Deleted' });
});

// ========== WISHLIST ==========
app.get('/api/wishlist', authenticate, (req, res) => {
  const db = readDB();
  const userWish = db.wishlist.filter(w => w.userId === req.userId);
  const packages = db.packages.filter(p => userWish.some(w => w.packageId === p.id));
  res.json(packages);
});

app.post('/api/wishlist/:packageId', authenticate, (req, res) => {
  const db = readDB();
  const packageId = parseInt(req.params.packageId);
  const userId = req.userId;
  if (!db.packages.find(p => p.id === packageId)) {
    return res.status(404).json({ error: 'Package not found' });
  }
  if (db.wishlist.find(w => w.userId === userId && w.packageId === packageId)) {
    return res.status(400).json({ error: 'Already in wishlist' });
  }
  db.wishlist.push({ userId, packageId });
  writeDB(db);
  res.json({ message: 'Added to wishlist' });
});

app.delete('/api/wishlist/:packageId', authenticate, (req, res) => {
  const db = readDB();
  const packageId = parseInt(req.params.packageId);
  const userId = req.userId;
  const index = db.wishlist.findIndex(w => w.userId === userId && w.packageId === packageId);
  if (index === -1) return res.status(404).json({ error: 'Not in wishlist' });
  db.wishlist.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Removed from wishlist' });
});

// ========== BOOKINGS ==========
app.post('/api/bookings', authenticate, (req, res) => {
  const db = readDB();
  const { packageId, date, guests, requests } = req.body;
  if (!packageId || !date || !guests) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const newBooking = {
    id: db.nextId.booking++,
    userId: req.userId,
    packageId: parseInt(packageId),
    date,
    guests: parseInt(guests),
    requests: requests || '',
    status: 'confirmed',
    bookedAt: new Date().toISOString()
  };
  db.bookings.push(newBooking);
  writeDB(db);
  res.status(201).json(newBooking);
});

app.get('/api/bookings', authenticate, (req, res) => {
  const db = readDB();
  const userBookings = db.bookings.filter(b => b.userId === req.userId);
  const packages = db.packages;
  const result = userBookings.map(b => ({
    ...b,
    package: packages.find(p => p.id === b.packageId)
  }));
  res.json(result);
});

// ========== CONTACT ==========
app.post('/api/contact', (req, res) => {
  console.log('📬 Contact:', req.body);
  res.json({ message: 'Message received' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌍 Server running at http://localhost:${PORT}`);
  console.log(`📦 Database: ${DB_PATH}`);
});
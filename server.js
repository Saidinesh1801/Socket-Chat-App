require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
let sharp;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

app.use(express.json());

// ── Multer ──
const allowedMimes = [
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4',
  'video/mp4','video/webm','video/ogg',
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv','application/zip','application/json'
];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'), false);
  }
});

// ── MongoDB ──
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp';
console.log('Attempting to connect to MongoDB...');
mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ── Schemas ──
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
  room: { type: String, index: true },
  user: String,
  text: { type: String, default: '' },
  time: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: 'sent' },
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  replyTo: { _id: String, user: String, text: String },
  reactions: [{ emoji: String, users: [String] }],
  seen: [String],
  file: { filename: String, originalname: String, mimetype: String, size: Number, url: String }
});
messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ room: 1, text: 'text' });
const Message = mongoose.model('Message', messageSchema);

const roomSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  password: { type: String, default: null },
  creator: String,
  createdAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

// ── CSRF tokens ──
const csrfTokens = new Map();
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, Date.now());
  // Clean old tokens (> 1 hour)
  for (const [t, time] of csrfTokens) {
    if (Date.now() - time > 3600000) csrfTokens.delete(t);
  }
  res.json({ token });
});

// ── Auth Endpoints ──
app.post('/api/signup', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    username = username.trim().slice(0, 24);
    password = password.trim();
    if (username.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Username already taken' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    username = username.trim();
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Static files ──
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── File upload with CSRF ──
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 5MB.' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Compress images with Sharp
    if (sharp && req.file.mimetype.startsWith('image/') && !req.file.mimetype.includes('svg') && !req.file.mimetype.includes('gif')) {
      try {
        const compressed = path.join('uploads', 'c-' + req.file.filename);
        await sharp(req.file.path).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(compressed);
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        fs.renameSync(compressed, req.file.path);
      } catch (e) { /* use original if compression fails */ }
    }

    res.json({
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`
    });
  });
});

// ── Link preview endpoint ──
app.get('/api/link-preview', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ChatApp LinkPreview' }
    });
    clearTimeout(timeout);
    const html = await resp.text();
    const getMetaContent = (name) => {
      const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'));
      return m ? m[1] : '';
    };
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    res.json({
      title: getMetaContent('og:title') || (titleMatch ? titleMatch[1] : ''),
      description: getMetaContent('og:description') || getMetaContent('description'),
      image: getMetaContent('og:image'),
      url
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not fetch preview' });
  }
});

// ── Room management endpoints ──
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({}).sort({ createdAt: -1 });
    const roomData = rooms.map(r => ({
      name: r.name,
      creator: r.creator,
      hasPassword: !!r.password,
      createdAt: r.createdAt
    }));
    res.json(roomData);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ── Online users: room -> Map<socketId, username> ──
const roomUsers = new Map();
function getRoomUsernames(room) {
  const users = roomUsers.get(room);
  if (!users) return [];
  return [...new Set(users.values())];
}
function removeUserFromAllRooms(socketId) {
  for (const [room, users] of roomUsers.entries()) {
    if (users.has(socketId)) {
      users.delete(socketId);
      io.to(room).emit('users list', getRoomUsernames(room));
      if (users.size === 0) roomUsers.delete(room);
    }
  }
}

// ── Rate limiting ──
const rateLimits = new Map();

// ── Socket auth middleware ──
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.username = decoded.username;
    next();
  } catch (e) { next(new Error('Invalid token')); }
});

// ── Socket.IO ──
io.on('connection', (socket) => {
  const username = socket.username;
  let currentRoom = null;
  console.log('User connected:', username);

  socket.on('join room', async (data) => {
    const roomName = (typeof data === 'string' ? data : data.room || '').trim().slice(0, 32);
    const roomPassword = typeof data === 'object' ? data.password : null;
    if (!roomName) return;

    // Check if room has a password
    const roomDoc = await Room.findOne({ name: roomName });
    if (roomDoc && roomDoc.password) {
      const valid = await bcrypt.compare(roomPassword || '', roomDoc.password);
      if (!valid) return socket.emit('room error', { message: 'Incorrect room password' });
    }

    // Leave previous room
    if (currentRoom) {
      socket.leave(currentRoom);
      if (roomUsers.has(currentRoom)) {
        roomUsers.get(currentRoom).delete(socket.id);
        io.to(currentRoom).emit('users list', getRoomUsernames(currentRoom));
      }
    }

    currentRoom = roomName;
    socket.join(roomName);

    if (!roomUsers.has(roomName)) roomUsers.set(roomName, new Map());
    roomUsers.get(roomName).set(socket.id, username);
    io.to(roomName).emit('users list', getRoomUsernames(roomName));

    try {
      const msgs = await Message.find({ room: roomName }).sort({ timestamp: 1 }).limit(50);
      socket.emit('load messages', msgs);
    } catch (err) { console.error('Error fetching messages:', err); }
  });

  socket.on('create room', async (data) => {
    const name = (data.name || '').trim().slice(0, 32);
    if (!name) return socket.emit('room error', { message: 'Room name required' });
    try {
      const exists = await Room.findOne({ name });
      if (exists) return socket.emit('room error', { message: 'Room already exists' });
      const room = new Room({
        name,
        password: data.password ? await bcrypt.hash(data.password, 10) : null,
        creator: username
      });
      await room.save();
      io.emit('room created', { name, creator: username, hasPassword: !!data.password });
    } catch (e) { socket.emit('room error', { message: 'Could not create room' }); }
  });

  socket.on('delete room', async (data) => {
    try {
      const room = await Room.findOne({ name: data.name });
      if (!room) return;
      if (room.creator !== username) return socket.emit('room error', { message: 'Only the room creator can delete it' });
      await Room.deleteOne({ name: data.name });
      await Message.deleteMany({ room: data.name });
      io.emit('room deleted', { name: data.name });
    } catch (e) { socket.emit('room error', { message: 'Could not delete room' }); }
  });

  socket.on('chat message', async (data) => {
    const now = Date.now();
    const last = rateLimits.get(socket.id) || 0;
    if (now - last < 1000) return socket.emit('rate limited', { message: 'Slow down!' });
    rateLimits.set(socket.id, now);

    const text = (data.text || '').trim().slice(0, 2000);
    const room = (data.room || '').trim();
    if (!text && !data.file) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const msg = new Message({
        room, user: username, text, time, status: 'sent',
        replyTo: data.replyTo || null,
        file: data.file || null
      });
      await msg.save();
      io.to(room).emit('chat message', msg);
    } catch (err) { console.error('Error saving message:', err); }
  });

  socket.on('edit message', async (data) => {
    try {
      const msg = await Message.findById(data._id);
      if (!msg || msg.user !== username) return;
      msg.text = (data.text || '').trim().slice(0, 2000);
      msg.edited = true;
      await msg.save();
      io.to(msg.room).emit('message edited', { _id: msg._id, text: msg.text, edited: true });
    } catch (e) { console.error('Error editing message:', e); }
  });

  socket.on('delete message', async (data) => {
    try {
      const msg = await Message.findById(data._id);
      if (!msg || msg.user !== username) return;
      msg.deleted = true;
      msg.text = '';
      msg.file = null;
      await msg.save();
      io.to(msg.room).emit('message deleted', { _id: msg._id });
    } catch (e) { console.error('Error deleting message:', e); }
  });

  socket.on('add reaction', async (data) => {
    try {
      const msg = await Message.findById(data._id);
      if (!msg) return;
      const existing = msg.reactions.find(r => r.emoji === data.emoji);
      if (existing) {
        const idx = existing.users.indexOf(username);
        if (idx > -1) existing.users.splice(idx, 1);
        else existing.users.push(username);
        if (existing.users.length === 0) msg.reactions = msg.reactions.filter(r => r.emoji !== data.emoji);
      } else {
        msg.reactions.push({ emoji: data.emoji, users: [username] });
      }
      await msg.save();
      io.to(msg.room).emit('message reactions', { _id: msg._id, reactions: msg.reactions });
    } catch (e) { console.error('Error adding reaction:', e); }
  });

  socket.on('deliver message', async (data) => {
    try {
      await Message.updateOne({ _id: data._id }, { status: 'delivered' });
      io.to(data.room).emit('message status', { _id: data._id, status: 'delivered' });
    } catch (e) {}
  });

  socket.on('mark seen', async (data) => {
    try {
      const result = await Message.updateMany(
        { room: data.room, user: { $ne: username }, seen: { $ne: username } },
        { $addToSet: { seen: username } }
      );
      if (result.modifiedCount > 0) {
        io.to(data.room).emit('messages seen', { user: username, room: data.room });
      }
    } catch (e) {}
  });

  socket.on('search messages', async (data) => {
    try {
      const query = (data.query || '').trim();
      if (!query) return socket.emit('search results', []);
      const results = await Message.find({
        room: data.room,
        deleted: { $ne: true },
        text: { $regex: query, $options: 'i' }
      }).sort({ timestamp: -1 }).limit(20);
      socket.emit('search results', results);
    } catch (e) { socket.emit('search results', []); }
  });

  socket.on('load more messages', async (data) => {
    try {
      const msgs = await Message.find({
        room: data.room,
        timestamp: { $lt: new Date(data.before) }
      }).sort({ timestamp: -1 }).limit(30);
      socket.emit('more messages', msgs.reverse());
    } catch (e) { console.error('Error:', e); }
  });

  socket.on('typing', (data) => socket.to(data.room).emit('typing', { user: username }));
  socket.on('stop typing', (data) => socket.to(data.room).emit('stop typing', { user: username }));

  socket.on('disconnect', () => {
    console.log('User disconnected:', username);
    removeUserFromAllRooms(socket.id);
    rateLimits.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

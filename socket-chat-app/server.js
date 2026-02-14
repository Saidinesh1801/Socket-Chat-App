const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Message schema
const messageSchema = new mongoose.Schema({
  room: String,
  user: String,
  text: { type: String, default: '' },
  time: String,
  timestamp: { type: Date, default: Date.now },
  file: {
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    url: String
  }
});

const Message = mongoose.model('Message', messageSchema);

// Serve the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileData = {
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  };
  
  res.json(fileData);
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join room', async (room) => {
    socket.join(room);

    // Fetch the last 50 messages from the database for this room
    try {
      const existingMessages = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);

      // Send history only to the user who just joined
      socket.emit('load messages', existingMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  });

  socket.on('chat message', async (data) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Create and save the message to MongoDB
    try {
      const newMessage = new Message({
        room: data.room,
        user: data.user,
        text: data.text || '',
        time: time,
        file: data.file || null
      });
      await newMessage.save();

      // Broadcast to everyone in the room
      io.to(data.room).emit('chat message', newMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.room).emit('typing', { user: data.user });
  });

  socket.on('stop typing', (data) => {
    socket.to(data.room).emit('stop typing', { user: data.user });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

const connectDB = require('./config/db');
const { socketAuth } = require('./middleware/socketAuth');
const setupSocketHandlers = require('./socket/handler');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const uploadRoutes = require('./routes/upload');
const linkPreviewRoutes = require('./routes/linkPreview');
const wallpaperRoutes = require('./routes/wallpapers');

// ── App Setup ──
const app = express();

// ── HTTPS or HTTP ──
let server;
const sslKeyPath = process.env.SSL_KEY || path.join(__dirname, 'certs', 'key.pem');
const sslCertPath = process.env.SSL_CERT || path.join(__dirname, 'certs', 'cert.pem');

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  server = https.createServer({
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  }, app);
  logger.info('HTTPS enabled');
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*' }
});

// ── Optional Redis Adapter ──
if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter enabled');
  } catch (e) {
    logger.warn('Redis adapter not available, using in-memory');
  }
}

// ── Security & Middleware ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://th.wallhaven.cc", "https://w.wallhaven.cc"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// ── Static Files ──
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ──
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    https: server instanceof https.Server
  });
};

// v1 routes (primary)
app.use('/api/v1', authRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/link-preview', linkPreviewRoutes);
app.use('/api/v1/wallpapers', wallpaperRoutes);
app.get('/api/v1/health', healthHandler);

// Legacy routes (backward compatibility)
app.use('/api', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/upload', uploadRoutes);
app.use('/api/link-preview', linkPreviewRoutes);
app.get('/api/health', healthHandler);

// ── Socket.IO ──
io.use(socketAuth);
setupSocketHandlers(io);

// ── Database & Start ──
connectDB();

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const protocol = server instanceof https.Server ? 'https' : 'http';
  logger.info(`Server running on ${protocol}://localhost:${PORT}`);
});

// ── Graceful Shutdown ──
function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB disconnected');
      process.exit(0);
    });
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };

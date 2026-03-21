import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import crypto from 'crypto';
import logger from './utils/logger';
import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';

const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  logger.error('Missing required environment variables', { missing });
  process.exit(1);
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
  logger.warn('Generated random JWT_SECRET for development');
}

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

import connectDB from './config/db';
import { socketAuth } from './middleware/socketAuth';
import setupSocketHandlers from './socket/handler';

import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import uploadRoutes from './routes/upload';
import linkPreviewRoutes from './routes/linkPreview';
import wallpaperRoutes from './routes/wallpapers';
import gifRoutes from './routes/gifs';
import presetAvatars from './utils/presetAvatars';

const app = express();

let server: http.Server | https.Server;
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
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Running HTTP in production - ensure TLS termination at reverse proxy');
  }
}

const io = new Server(server, {
  cors: { 
    origin: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : '*'),
    credentials: true
  }
});

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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://th.wallhaven.cc", "https://w.wallhaven.cc", "https://api.dicebear.com"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

const rootDir = __dirname.includes('dist') ? path.resolve(__dirname, '..') : __dirname;
app.use(express.static(path.join(rootDir, 'public')));
app.use('/uploads', express.static(path.join(rootDir, 'uploads')));

const healthHandler = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    https: server instanceof https.Server
  });
};

app.use('/api/v1', authRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/link-preview', linkPreviewRoutes);
app.use('/api/v1/wallpapers', wallpaperRoutes);
app.use('/api/v1/gifs', gifRoutes);
app.get('/api/v1/health', healthHandler);
app.get('/api/v1/profile/presets', (req: Request, res: Response) => res.json(presetAvatars));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/v1/swagger.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.get('/api/v1/health/ready', async (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];
  const isReady = dbState === 1;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.use('/api', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/upload', uploadRoutes);
app.use('/api/link-preview', linkPreviewRoutes);
app.get('/api/health', healthHandler);
app.get('/api/health/ready', async (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];
  const isReady = dbState === 1;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});

interface AppError extends Error {
  status?: number;
  message: string;
}

app.use((err: AppError, req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    path: req.path,
    method: req.method
  });
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.sendFile(path.join(rootDir, 'public', 'index.html'));
  }
});

io.use(socketAuth);
setupSocketHandlers(io);

connectDB();

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  const protocol = server instanceof https.Server ? 'https' : 'http';
  logger.info(`Server running on ${protocol}://localhost:${PORT}`);
});

function gracefulShutdown(signal: string) {
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

export { app, server };

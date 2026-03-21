import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  logger.error('Available env keys: ' + Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

interface JwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}

interface AuthenticatedSocket extends Socket {
  username?: string;
}

function socketAuth(socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    socket.username = decoded.username;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
}

export { socketAuth, JWT_SECRET, JwtPayload, AuthenticatedSocket };

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

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

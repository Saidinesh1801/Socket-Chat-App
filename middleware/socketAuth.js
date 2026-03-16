const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  logger.error('Available env keys: ' + Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

function socketAuth(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.username = decoded.username;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
}

module.exports = { socketAuth, JWT_SECRET };

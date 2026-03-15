// Set JWT_SECRET before requiring any modules
process.env.JWT_SECRET = 'unit_test_secret';

const jwt = require('jsonwebtoken');
const { sanitizeText, sanitizeRoomName } = require('../utils/sanitize');
const logger = require('../utils/logger');
const httpAuth = require('../middleware/httpAuth');
const { socketAuth, JWT_SECRET } = require('../middleware/socketAuth');

describe('sanitizeText', () => {
  test('strips HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>hello')).toBe('alert("xss")hello');
  });

  test('removes control characters but keeps newlines', () => {
    expect(sanitizeText('hello\nworld')).toBe('hello\nworld');
    expect(sanitizeText('hello\x00world')).toBe('helloworld');
    expect(sanitizeText('hello\x07world')).toBe('helloworld');
  });

  test('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  test('truncates to 2000 characters', () => {
    const long = 'a'.repeat(3000);
    expect(sanitizeText(long).length).toBe(2000);
  });

  test('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123)).toBe('');
  });

  test('handles nested HTML tags', () => {
    expect(sanitizeText('<div><b>bold</b></div>')).toBe('bold');
  });
});

describe('sanitizeRoomName', () => {
  test('strips dangerous characters', () => {
    expect(sanitizeRoomName('room<script>')).toBe('roomscript');
    expect(sanitizeRoomName("room'name")).toBe('roomname');
    expect(sanitizeRoomName('room"name')).toBe('roomname');
    expect(sanitizeRoomName('room&name')).toBe('roomname');
  });

  test('removes control characters', () => {
    expect(sanitizeRoomName('room\x00name')).toBe('roomname');
  });

  test('truncates to 32 characters', () => {
    const long = 'a'.repeat(50);
    expect(sanitizeRoomName(long).length).toBe(32);
  });

  test('trims whitespace', () => {
    expect(sanitizeRoomName('  MyRoom  ')).toBe('MyRoom');
  });

  test('returns empty string for non-string input', () => {
    expect(sanitizeRoomName(null)).toBe('');
    expect(sanitizeRoomName(42)).toBe('');
  });

  test('preserves valid room names', () => {
    expect(sanitizeRoomName('General')).toBe('General');
    expect(sanitizeRoomName('Room 123')).toBe('Room 123');
    expect(sanitizeRoomName('user1:dm:user2')).toBe('user1:dm:user2');
  });
});

describe('logger', () => {
  test('has info, warn, error, debug methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('does not throw on calls', () => {
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.warn('test warning')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.debug('test debug')).not.toThrow();
  });

  test('handles metadata', () => {
    expect(() => logger.info('test', { key: 'value' })).not.toThrow();
    expect(() => logger.error('test', { error: 'details' })).not.toThrow();
  });
});

describe('httpAuth middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const mockNext = jest.fn();

  beforeEach(() => {
    mockNext.mockClear();
  });

  test('rejects request without Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    httpAuth(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('rejects request with invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid_token' } };
    const res = mockRes();
    httpAuth(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('rejects request with non-Bearer scheme', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    httpAuth(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('passes valid token and sets req.username', () => {
    const token = jwt.sign({ username: 'testuser' }, JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    httpAuth(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(req.username).toBe('testuser');
  });
});

describe('socketAuth middleware', () => {
  test('rejects socket without token', () => {
    const socket = { handshake: { auth: {} } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Authentication required');
  });

  test('rejects socket with invalid token', () => {
    const socket = { handshake: { auth: { token: 'bad_token' } } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Invalid token');
  });

  test('accepts socket with valid token and sets username', () => {
    const token = jwt.sign({ username: 'socketuser' }, JWT_SECRET, { expiresIn: '1h' });
    const socket = { handshake: { auth: { token } } };
    const next = jest.fn();
    socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.username).toBe('socketuser');
  });
});

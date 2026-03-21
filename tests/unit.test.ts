import jwt from 'jsonwebtoken';
import { describe, test, expect } from '@jest/globals';
import { sanitizeText, sanitizeRoomName } from '../utils/sanitize';
import logger from '../utils/logger';
import { JWT_SECRET } from '../middleware/socketAuth';

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

  test('handles mixed content', () => {
    expect(sanitizeText('Hello <b>World</b>!')).toBe('Hello World!');
    expect(sanitizeText('<p>Paragraph</p><script>evil()</script>')).toBe('Paragraphevil()');
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
    expect(sanitizeRoomName('Room_123')).toBe('Room_123');
    expect(sanitizeRoomName('user1:dm:user2')).toBe('user1:dm:user2');
  });

  test('handles special characters', () => {
    expect(sanitizeRoomName('room\\name')).toBe('roomname');
    expect(sanitizeRoomName('room<name')).toBe('roomname');
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

  test('handles undefined metadata', () => {
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });
});

describe('JWT Token Generation', () => {
  test('generates valid JWT token', () => {
    const token = jwt.sign({ username: 'testuser' }, JWT_SECRET, { expiresIn: '1h' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  test('verifies valid token', () => {
    const token = jwt.sign({ username: 'testuser' }, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
    expect(decoded.username).toBe('testuser');
  });

  test('rejects invalid token', () => {
    expect(() => {
      jwt.verify('invalid_token', JWT_SECRET);
    }).toThrow();
  });

  test('rejects token with wrong secret', () => {
    const token = jwt.sign({ username: 'testuser' }, 'wrong_secret', { expiresIn: '1h' });
    expect(() => {
      jwt.verify(token, JWT_SECRET);
    }).toThrow();
  });
});

describe('Link Preview Security', () => {
  const testUrls = [
    { url: 'http://127.0.0.1/admin', blocked: true },
    { url: 'http://localhost/admin', blocked: true },
    { url: 'http://192.168.1.1/admin', blocked: true },
    { url: 'http://10.0.0.1/admin', blocked: true },
    { url: 'http://172.16.0.1/admin', blocked: true },
    { url: 'http://example.com/page', blocked: false },
    { url: 'https://google.com', blocked: false },
    { url: 'file:///etc/passwd', blocked: true },
  ];

  test('blocks private/internal URLs', async () => {
    const blockedUrls = testUrls.filter(t => t.blocked);
    for (const test of blockedUrls) {
      const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/v1/link-preview?url=${encodeURIComponent(test.url)}`);
      expect(res.status).toBe(403);
    }
  });
});

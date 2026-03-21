import request from 'supertest';
import { Express } from 'express';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app: Express;
let server: ReturnType<typeof app.listen>;
let authToken: string;

const testUser = {
  username: 'testuser' + Date.now(),
  email: `test${Date.now()}@example.com`,
  password: 'testpass123'
};

beforeAll(async () => {
  process.env.PORT = '0';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp_test';
  
  const mod = await import('../server');
  app = mod.app;
  server = mod.server;
  
  await new Promise(r => setTimeout(r, 2000));
});

afterAll(async () => {
  try {
    const mongoose = await import('mongoose');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } catch (e) {
    // ignore cleanup errors
  }
  if (server) {
    server.close();
  }
});

describe('Auth API', () => {
  test('POST /api/v1/signup - creates a new user', async () => {
    const res = await request(app).post('/api/v1/signup').send(testUser);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe(testUser.username);
    authToken = res.body.token;
  });

  test('POST /api/v1/signup - rejects duplicate username', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      ...testUser,
      email: 'other@example.com'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/taken/i);
  });

  test('POST /api/v1/signup - rejects duplicate email', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      username: 'diffuser' + Math.floor(Math.random() * 10000),
      email: testUser.email,
      password: 'testpass123'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/i);
  });

  test('POST /api/v1/signup - validates short username', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      username: 'a',
      email: 'x@x.com',
      password: 'test'
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/signup - validates invalid email', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      username: 'validuser',
      email: 'notanemail',
      password: 'test'
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/login - success', async () => {
    const res = await request(app).post('/api/v1/login').send({
      username: testUser.username,
      password: testUser.password
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/v1/login - wrong password', async () => {
    const res = await request(app).post('/api/v1/login').send({
      username: testUser.username,
      password: 'wrongpass'
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/login - nonexistent user', async () => {
    const res = await request(app).post('/api/v1/login').send({
      username: 'nobody',
      password: 'test'
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/forgot-password - nonexistent email', async () => {
    const res = await request(app).post('/api/v1/forgot-password').send({
      email: 'nobody@example.com'
    });
    expect(res.status).toBe(200);
  });
});

describe('Avatar API', () => {
  const validAvatarUrl = 'https://api.dicebear.com/9.x/lorelei/svg?seed=test';
  
  test('POST /api/v1/profile/avatar-url - sets avatar URL', async () => {
    const res = await request(app)
      .post('/api/v1/profile/avatar-url')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ avatar: validAvatarUrl });
    expect(res.status).toBe(200);
    expect(res.body.avatar).toBe(validAvatarUrl);
  });

  test('POST /api/v1/profile/avatar-url - requires avatar field', async () => {
    const res = await request(app)
      .post('/api/v1/profile/avatar-url')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/avatar.*required/i);
  });

  test('POST /api/v1/profile/avatar-url - requires auth', async () => {
    const res = await request(app)
      .post('/api/v1/profile/avatar-url')
      .send({ avatar: validAvatarUrl });
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/profile/presets - returns new categories', async () => {
    const res = await request(app).get('/api/v1/profile/presets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cool');
    expect(res.body).toHaveProperty('vibrant');
    expect(res.body).toHaveProperty('pastel');
    expect(res.body).toHaveProperty('robots');
    expect(res.body).toHaveProperty('fun');
  });

  test('POST /api/v1/profile/avatar/preset - sets preset avatar', async () => {
    const res = await request(app)
      .post('/api/v1/profile/avatar/preset')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ presetId: 'cl1', category: 'cool' });
    expect(res.status).toBe(200);
    expect(res.body.avatar).toContain('dicebear.com');
  });

  test('POST /api/v1/profile/avatar/preset - rejects invalid category', async () => {
    const res = await request(app)
      .post('/api/v1/profile/avatar/preset')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ presetId: 'cl1', category: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid.*category/i);
  });

  test('POST /api/v1/profile/avatar/preset - rejects invalid preset ID', async () => {
    const res = await request(app)
      .post('/api/v1/profile/avatar/preset')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ presetId: 'invalid', category: 'cool' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('DELETE /api/v1/profile/avatar - removes avatar', async () => {
    const res = await request(app)
      .delete('/api/v1/profile/avatar')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.avatar).toBeNull();
  });
});

describe('Rooms API', () => {
  test('GET /api/v1/rooms - returns array', async () => {
    const res = await request(app).get('/api/v1/rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Upload API', () => {
  test('POST /api/v1/upload - rejects without auth', async () => {
    const res = await request(app).post('/api/v1/upload');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/upload - rejects no file', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });
});

describe('Health Check', () => {
  test('GET /api/v1/health - returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/v1/health - includes timestamp', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /api/v1/health/ready - returns db status', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('db');
  });
});

describe('Profile API', () => {
  test('GET /api/v1/profile - requires auth', async () => {
    const res = await request(app).get('/api/v1/profile');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/profile - returns user data with auth', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(testUser.username);
  });

  test('GET /api/v1/profile - includes avatar', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('avatar');
  });

  test('PUT /api/v1/profile/status - updates status', async () => {
    const res = await request(app)
      .put('/api/v1/profile/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'Testing status update' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Testing status update');
  });

  test('PUT /api/v1/profile/status - truncates long status', async () => {
    const longStatus = 'a'.repeat(150);
    const res = await request(app)
      .put('/api/v1/profile/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: longStatus });
    expect(res.status).toBe(200);
    expect(res.body.status.length).toBeLessThanOrEqual(100);
  });

  test('GET /api/v1/profile/:username - returns public profile', async () => {
    const res = await request(app).get(`/api/v1/profile/${testUser.username}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(testUser.username);
  });
});

describe('Error Handling', () => {
  test('GET /api/v1/nonexistent - returns 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('POST /api/v1/signup - handles empty body', async () => {
    const res = await request(app).post('/api/v1/signup').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/login - handles empty body', async () => {
    const res = await request(app).post('/api/v1/login').send({});
    expect(res.status).toBe(400);
  });
});

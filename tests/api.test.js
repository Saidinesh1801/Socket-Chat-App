const request = require('supertest');

// Setup: start a test server
let app, server;

beforeAll(async () => {
  process.env.PORT = 0;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp_test';
  const mod = require('../server');
  app = mod.app;
  server = mod.server;
  // Wait for DB
  await new Promise(r => setTimeout(r, 2000));
});

afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  server.close();
});

const testUser = {
  username: 'testuser_' + Date.now(),
  email: `test${Date.now()}@example.com`,
  password: 'testpass123'
};

let authToken;

describe('Auth API', () => {
  test('POST /api/v1/signup — creates a new user', async () => {
    const res = await request(app).post('/api/v1/signup').send(testUser);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe(testUser.username);
    authToken = res.body.token;
  });

  test('POST /api/v1/signup — rejects duplicate username', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      ...testUser,
      email: 'other@example.com'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/taken/i);
  });

  test('POST /api/v1/signup — rejects duplicate email', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      ...testUser,
      username: 'otheruser'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/i);
  });

  test('POST /api/v1/signup — validates short username', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      username: 'a',
      email: 'x@x.com',
      password: 'test'
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/signup — validates invalid email', async () => {
    const res = await request(app).post('/api/v1/signup').send({
      username: 'validuser',
      email: 'notanemail',
      password: 'test'
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/login — success', async () => {
    const res = await request(app).post('/api/v1/login').send({
      username: testUser.username,
      password: testUser.password
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/v1/login — wrong password', async () => {
    const res = await request(app).post('/api/v1/login').send({
      username: testUser.username,
      password: 'wrongpass'
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/login — nonexistent user', async () => {
    const res = await request(app).post('/api/v1/login').send({
      username: 'nobody',
      password: 'test'
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/forgot-password — nonexistent email', async () => {
    const res = await request(app).post('/api/v1/forgot-password').send({
      email: 'nobody@example.com'
    });
    expect(res.status).toBe(404);
  });
});

describe('Rooms API', () => {
  test('GET /api/v1/rooms — returns array', async () => {
    const res = await request(app).get('/api/v1/rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Upload API', () => {
  test('POST /api/v1/upload — rejects without auth', async () => {
    const res = await request(app).post('/api/v1/upload');
    expect(res.status).toBe(401);
  });

  test('POST /api/v1/upload — rejects no file', async () => {
    const res = await request(app)
      .post('/api/v1/upload')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });
});

describe('Health Check', () => {
  test('GET /api/v1/health — returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

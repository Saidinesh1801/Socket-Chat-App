const request = require('supertest');
const { io: ioClient } = require('socket.io-client');

let app, server, authToken, serverUrl;

beforeAll(async () => {
  process.env.PORT = 0;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp_test2';
  const mod = require('../server');
  app = mod.app;
  server = mod.server;
  await new Promise(r => setTimeout(r, 2000));
  const addr = server.address();
  serverUrl = `http://localhost:${addr.port}`;

  // Create a test user
  const res = await request(app).post('/api/v1/signup').send({
    username: 'socketuser_' + Date.now(),
    email: `socket${Date.now()}@test.com`,
    password: 'test1234'
  });
  authToken = res.body.token;
});

afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  server.close();
});

function createClient() {
  return ioClient(serverUrl, {
    auth: { token: authToken },
    transports: ['websocket'],
    forceNew: true
  });
}

describe('Socket.IO', () => {
  test('connects with valid token', (done) => {
    const client = createClient();
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });
  });

  test('rejects connection without token', (done) => {
    const client = ioClient(serverUrl, {
      auth: {},
      transports: ['websocket'],
      forceNew: true
    });
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication/i);
      client.disconnect();
      done();
    });
  });

  test('rejects connection with invalid token', (done) => {
    const client = ioClient(serverUrl, {
      auth: { token: 'invalid_token' },
      transports: ['websocket'],
      forceNew: true
    });
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Invalid/i);
      client.disconnect();
      done();
    });
  });

  test('joins a room and receives message history', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: 'TestRoom' });
    });
    client.on('load messages', (msgs) => {
      expect(Array.isArray(msgs)).toBe(true);
      client.disconnect();
      done();
    });
  });

  test('sends and receives a chat message', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: 'MsgTestRoom' });
    });
    client.on('load messages', () => {
      client.emit('chat message', {
        text: 'Hello World',
        room: 'MsgTestRoom'
      });
    });
    client.on('chat message', (msg) => {
      expect(msg.text).toBe('Hello World');
      expect(msg.room).toBe('MsgTestRoom');
      client.disconnect();
      done();
    });
  });

  test('rate limits rapid messages', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: 'RateLimitRoom' });
    });
    client.on('load messages', () => {
      client.emit('chat message', { text: 'msg1', room: 'RateLimitRoom' });
      client.emit('chat message', { text: 'msg2', room: 'RateLimitRoom' });
    });
    client.on('rate limited', (data) => {
      expect(data.message).toBeDefined();
      client.disconnect();
      done();
    });
  });

  test('creates and lists rooms', (done) => {
    const client = createClient();
    const roomName = 'TestCreateRoom_' + Date.now();
    client.on('connect', () => {
      client.emit('create room', { name: roomName });
    });
    client.on('room created', async (data) => {
      expect(data.name).toBe(roomName);
      const res = await request(app).get('/api/v1/rooms');
      const found = res.body.find(r => r.name === roomName);
      expect(found).toBeDefined();
      client.disconnect();
      done();
    });
  });
});

describe('API Edge Cases', () => {
  test('POST /api/v1/signup — missing fields', async () => {
    const res = await request(app).post('/api/v1/signup').send({ username: 'test' });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/login — missing fields', async () => {
    const res = await request(app).post('/api/v1/login').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/verify-otp — no reset requested', async () => {
    const res = await request(app).post('/api/v1/verify-otp').send({
      email: 'nobody@test.com',
      otp: '123456',
      newPassword: 'newpass'
    });
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/link-preview — rejects without auth', async () => {
    const res = await request(app).get('/api/v1/link-preview');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/link-preview — missing URL with auth', async () => {
    const res = await request(app)
      .get('/api/v1/link-preview')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/v1/link-preview — blocks private URLs', async () => {
    const res = await request(app)
      .get('/api/v1/link-preview?url=http://127.0.0.1/admin')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/v1/health — returns HTTPS status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body).toHaveProperty('https');
    expect(res.body).toHaveProperty('timestamp');
  });
});

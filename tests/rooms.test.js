const request = require('supertest');
const { io: ioClient } = require('socket.io-client');

let app, server, authToken, authToken2, serverUrl;
let user1 = {
  username: 'roomuser1_' + Date.now(),
  email: `roomuser1_${Date.now()}@test.com`,
  password: 'test1234'
};
let user2 = {
  username: 'roomuser2_' + Date.now(),
  email: `roomuser2_${Date.now()}@test.com`,
  password: 'test1234'
};

beforeAll(async () => {
  process.env.PORT = 0;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp_test_rooms';
  const mod = require('../server');
  app = mod.app;
  server = mod.server;
  await new Promise(r => setTimeout(r, 2000));
  const addr = server.address();
  serverUrl = `http://localhost:${addr.port}`;

  const res1 = await request(app).post('/api/v1/signup').send(user1);
  authToken = res1.body.token;

  const res2 = await request(app).post('/api/v1/signup').send(user2);
  authToken2 = res2.body.token;
});

afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  server.close();
});

function createClient(token = authToken) {
  return ioClient(serverUrl, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });
}

describe('Room CRUD via Socket.IO', () => {
  test('creates a room without password', (done) => {
    const client = createClient();
    const roomName = 'NoPassRoom_' + Date.now();
    client.on('connect', () => {
      client.emit('create room', { name: roomName });
    });
    client.on('room created', (data) => {
      expect(data.name).toBe(roomName);
      expect(data.creator).toBe(user1.username);
      expect(data.hasPassword).toBe(false);
      client.disconnect();
      done();
    });
  });

  test('creates a room with password', (done) => {
    const client = createClient();
    const roomName = 'PassRoom_' + Date.now();
    client.on('connect', () => {
      client.emit('create room', { name: roomName, password: 'secret123' });
    });
    client.on('room created', (data) => {
      expect(data.name).toBe(roomName);
      expect(data.hasPassword).toBe(true);
      client.disconnect();
      done();
    });
  });

  test('rejects duplicate room name', (done) => {
    const client = createClient();
    const roomName = 'DupeRoom_' + Date.now();
    client.on('connect', () => {
      client.emit('create room', { name: roomName });
    });
    client.on('room created', () => {
      client.on('room error', (err) => {
        expect(err.message).toMatch(/already exists/i);
        client.disconnect();
        done();
      });
      client.emit('create room', { name: roomName });
    });
  });

  test('rejects empty room name', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('create room', { name: '' });
    });
    client.on('room error', (err) => {
      expect(err.message).toMatch(/required/i);
      client.disconnect();
      done();
    });
  });

  test('deletes a room by creator', (done) => {
    const client = createClient();
    const roomName = 'DeleteMe_' + Date.now();
    client.on('connect', () => {
      client.emit('create room', { name: roomName });
    });
    client.on('room created', () => {
      client.emit('delete room', { name: roomName });
    });
    client.on('room deleted', (data) => {
      expect(data.name).toBe(roomName);
      client.disconnect();
      done();
    });
  });

  test('rejects deletion by non-creator', (done) => {
    const client1 = createClient(authToken);
    const roomName = 'NoDelete_' + Date.now();

    client1.on('connect', () => {
      client1.emit('create room', { name: roomName });
    });
    client1.on('room created', () => {
      const client2 = createClient(authToken2);
      client2.on('room error', (err) => {
        expect(err.message).toMatch(/creator/i);
        client1.disconnect();
        client2.disconnect();
        done();
      });
      client2.on('connect', () => {
        client2.emit('delete room', { name: roomName });
      });
    });
  });
});

describe('Room password protection', () => {
  const protectedRoom = 'ProtectedRoom_' + Date.now();
  const roomPass = 'roompass123';

  beforeAll((done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('create room', { name: protectedRoom, password: roomPass });
    });
    client.on('room created', () => {
      client.disconnect();
      done();
    });
  });

  test('joins with correct password', (done) => {
    const client = createClient(authToken2);
    client.on('connect', () => {
      client.emit('join room', { room: protectedRoom, password: roomPass });
    });
    client.on('load messages', (msgs) => {
      expect(Array.isArray(msgs)).toBe(true);
      client.disconnect();
      done();
    });
  });

  test('rejects join with wrong password', (done) => {
    const client = createClient(authToken2);
    client.on('connect', () => {
      client.emit('join room', { room: protectedRoom, password: 'wrongpass' });
    });
    client.on('room error', (err) => {
      expect(err.message).toMatch(/incorrect/i);
      client.disconnect();
      done();
    });
  });
});

describe('Message operations via Socket.IO', () => {
  const msgRoom = 'MsgOpsRoom_' + Date.now();
  let savedMsgId;

  beforeAll((done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('create room', { name: msgRoom });
    });
    client.on('room created', () => {
      client.disconnect();
      done();
    });
  });

  test('sends and receives a message in a room', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: msgRoom });
    });
    client.on('load messages', () => {
      client.emit('chat message', { text: 'Hello Room!', room: msgRoom });
    });
    client.on('chat message', (msg) => {
      expect(msg.text).toBe('Hello Room!');
      expect(msg.room).toBe(msgRoom);
      expect(msg.user).toBe(user1.username);
      savedMsgId = msg._id;
      client.disconnect();
      done();
    });
  });

  test('edits own message', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: msgRoom });
    });
    client.on('load messages', () => {
      client.emit('edit message', { _id: savedMsgId, text: 'Edited text' });
    });
    client.on('message edited', (data) => {
      expect(data._id).toBe(savedMsgId);
      expect(data.text).toBe('Edited text');
      expect(data.edited).toBe(true);
      client.disconnect();
      done();
    });
  });

  test('cannot edit another user\'s message', (done) => {
    const client = createClient(authToken2);
    client.on('connect', () => {
      client.emit('join room', { room: msgRoom });
    });
    client.on('load messages', () => {
      client.emit('edit message', { _id: savedMsgId, text: 'Hacked!' });
      // The handler silently returns if user doesn't match, so no event is emitted.
      // Wait briefly and verify the message was not changed.
      setTimeout(async () => {
        const Message = require('../models/Message');
        const msg = await Message.findById(savedMsgId);
        expect(msg.text).toBe('Edited text');
        client.disconnect();
        done();
      }, 500);
    });
  });

  test('adds a reaction to a message', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: msgRoom });
    });
    client.on('load messages', () => {
      client.emit('add reaction', { _id: savedMsgId, emoji: '👍' });
    });
    client.on('message reactions', (data) => {
      expect(data._id).toBe(savedMsgId);
      const reaction = data.reactions.find(r => r.emoji === '👍');
      expect(reaction).toBeDefined();
      expect(reaction.users).toContain(user1.username);
      client.disconnect();
      done();
    });
  });

  test('deletes own message', (done) => {
    const client = createClient();
    client.on('connect', () => {
      client.emit('join room', { room: msgRoom });
    });
    client.on('load messages', () => {
      client.emit('delete message', { _id: savedMsgId });
    });
    client.on('message deleted', (data) => {
      expect(data._id).toBe(savedMsgId);
      client.disconnect();
      done();
    });
  });
});

describe('API edge cases', () => {
  test('GET /api/v1/rooms returns created rooms', async () => {
    const roomName = 'ApiListRoom_' + Date.now();
    // Create a room via socket first
    await new Promise((resolve) => {
      const client = createClient();
      client.on('connect', () => {
        client.emit('create room', { name: roomName });
      });
      client.on('room created', () => {
        client.disconnect();
        resolve();
      });
    });

    const res = await request(app).get('/api/v1/rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(r => r.name === roomName);
    expect(found).toBeDefined();
  });

  test('GET /api/v1/health returns expected fields', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('https');
    expect(typeof res.body.uptime).toBe('number');
  });
});

const bcrypt = require('bcryptjs');
const Message = require('../models/Message');
const Room = require('../models/Room');
const logger = require('../utils/logger');
const { sanitizeText, sanitizeRoomName } = require('../utils/sanitize');

const roomUsers = new Map();
const rateLimits = new Map();

function getRoomUsernames(room) {
  const users = roomUsers.get(room);
  if (!users) return [];
  return [...new Set(users.values())];
}

function removeUserFromAllRooms(io, socketId) {
  for (const [room, users] of roomUsers.entries()) {
    if (users.has(socketId)) {
      users.delete(socketId);
      io.to(room).emit('users list', getRoomUsernames(room));
      if (users.size === 0) roomUsers.delete(room);
    }
  }
}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const username = socket.username;
    let currentRoom = null;
    logger.info('User connected', { username });

    socket.on('join room', async (data) => {
      const roomName = sanitizeRoomName(typeof data === 'string' ? data : data.room || '');
      const roomPassword = typeof data === 'object' ? data.password : null;
      if (!roomName) return;

      const roomDoc = await Room.findOne({ name: roomName });
      if (roomDoc && roomDoc.password) {
        const valid = await bcrypt.compare(roomPassword || '', roomDoc.password);
        if (!valid) return socket.emit('room error', { message: 'Incorrect room password' });
      }

      if (currentRoom) {
        socket.leave(currentRoom);
        if (roomUsers.has(currentRoom)) {
          roomUsers.get(currentRoom).delete(socket.id);
          io.to(currentRoom).emit('users list', getRoomUsernames(currentRoom));
        }
      }

      currentRoom = roomName;
      socket.join(roomName);

      if (!roomUsers.has(roomName)) roomUsers.set(roomName, new Map());
      roomUsers.get(roomName).set(socket.id, username);
      io.to(roomName).emit('users list', getRoomUsernames(roomName));

      try {
        const msgs = await Message.find({ room: roomName }).sort({ timestamp: 1 }).limit(50);
        socket.emit('load messages', msgs);
      } catch (err) { logger.error('Error fetching messages', { error: err.message }); }
    });

    socket.on('create room', async (data) => {
      const name = sanitizeRoomName(data.name || '');
      if (!name) return socket.emit('room error', { message: 'Room name required' });
      try {
        if (await Room.findOne({ name })) return socket.emit('room error', { message: 'Room already exists' });
        const room = new Room({
          name,
          password: data.password ? await bcrypt.hash(data.password, 10) : null,
          creator: username
        });
        await room.save();
        io.emit('room created', { name, creator: username, hasPassword: !!data.password });
      } catch (e) { socket.emit('room error', { message: 'Could not create room' }); }
    });

    socket.on('delete room', async (data) => {
      try {
        const room = await Room.findOne({ name: data.name });
        if (!room) return;
        if (room.creator !== username) return socket.emit('room error', { message: 'Only the room creator can delete it' });
        await Room.deleteOne({ name: data.name });
        await Message.deleteMany({ room: data.name });
        io.emit('room deleted', { name: data.name });
      } catch (e) { socket.emit('room error', { message: 'Could not delete room' }); }
    });

    socket.on('chat message', async (data) => {
      const now = Date.now();
      const last = rateLimits.get(socket.id) || 0;
      if (now - last < 1000) return socket.emit('rate limited', { message: 'Slow down!' });
      rateLimits.set(socket.id, now);

      const text = sanitizeText(data.text || '');
      const room = sanitizeRoomName(data.room || '');
      if (!text && !data.file) return;

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      try {
        const msg = new Message({
          room, user: username, text, time, status: 'sent',
          replyTo: data.replyTo || null,
          file: data.file || null
        });
        await msg.save();
        io.to(room).emit('chat message', msg);
      } catch (err) { logger.error('Error saving message', { error: err.message }); }
    });

    socket.on('edit message', async (data) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg || msg.user !== username) return;
        msg.text = sanitizeText(data.text || '');
        msg.edited = true;
        await msg.save();
        io.to(msg.room).emit('message edited', { _id: msg._id, text: msg.text, edited: true });
      } catch (e) { logger.error('Error editing message', { error: e.message }); }
    });

    socket.on('delete message', async (data) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg || msg.user !== username) return;
        msg.deleted = true;
        msg.text = '';
        msg.file = null;
        await msg.save();
        io.to(msg.room).emit('message deleted', { _id: msg._id });
      } catch (e) { logger.error('Error deleting message', { error: e.message }); }
    });

    socket.on('add reaction', async (data) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg) return;
        const existing = msg.reactions.find(r => r.emoji === data.emoji);
        if (existing) {
          const idx = existing.users.indexOf(username);
          if (idx > -1) existing.users.splice(idx, 1);
          else existing.users.push(username);
          if (existing.users.length === 0) msg.reactions = msg.reactions.filter(r => r.emoji !== data.emoji);
        } else {
          msg.reactions.push({ emoji: data.emoji, users: [username] });
        }
        await msg.save();
        io.to(msg.room).emit('message reactions', { _id: msg._id, reactions: msg.reactions });
      } catch (e) { logger.error('Error adding reaction', { error: e.message }); }
    });

    socket.on('deliver message', async (data) => {
      try {
        await Message.updateOne({ _id: data._id }, { status: 'delivered' });
        io.to(data.room).emit('message status', { _id: data._id, status: 'delivered' });
      } catch (e) {}
    });

    socket.on('mark seen', async (data) => {
      try {
        const result = await Message.updateMany(
          { room: data.room, user: { $ne: username }, seen: { $ne: username } },
          { $addToSet: { seen: username } }
        );
        if (result.modifiedCount > 0) {
          io.to(data.room).emit('messages seen', { user: username, room: data.room });
        }
      } catch (e) {}
    });

    socket.on('search messages', async (data) => {
      try {
        const query = (data.query || '').trim();
        if (!query) return socket.emit('search results', []);
        const results = await Message.find({
          room: data.room,
          deleted: { $ne: true },
          text: { $regex: query, $options: 'i' }
        }).sort({ timestamp: -1 }).limit(20);
        socket.emit('search results', results);
      } catch (e) { socket.emit('search results', []); }
    });

    socket.on('load more messages', async (data) => {
      try {
        const msgs = await Message.find({
          room: data.room,
          timestamp: { $lt: new Date(data.before) }
        }).sort({ timestamp: -1 }).limit(30);
        socket.emit('more messages', msgs.reverse());
      } catch (e) { logger.error('Error loading messages', { error: e.message }); }
    });

    socket.on('typing', (data) => socket.to(data.room).emit('typing', { user: username }));
    socket.on('stop typing', (data) => socket.to(data.room).emit('stop typing', { user: username }));

    socket.on('disconnect', () => {
      logger.info('User disconnected', { username });
      removeUserFromAllRooms(io, socket.id);
      rateLimits.delete(socket.id);
    });
  });
}

module.exports = setupSocketHandlers;

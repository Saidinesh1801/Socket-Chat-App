import { Server, Socket } from 'socket.io';
import bcrypt from 'bcryptjs';
import Message from '../models/Message';
import Room from '../models/Room';
import User from '../models/User';
import logger from '../utils/logger';
import { sanitizeText, sanitizeRoomName } from '../utils/sanitize';

interface RoomUsersMap {
  [room: string]: Map<string, string>;
}

interface TypingUsersMap {
  [room: string]: { [username: string]: NodeJS.Timeout };
}

interface RateLimitsMap {
  [socketId: string]: number;
}

const roomUsers: RoomUsersMap = {};
const typingUsers: TypingUsersMap = {};
const rateLimits: RateLimitsMap = {};

function getRoomUsernames(room: string): string[] {
  const users = roomUsers[room];
  if (!users) return [];
  return [...new Set(users.values())];
}

function getRoomUserCount(room: string): number {
  const users = roomUsers[room];
  return users ? users.size : 0;
}

function removeUserFromAllRooms(io: Server, socketId: string) {
  for (const room of Object.keys(roomUsers)) {
    if (roomUsers[room].has(socketId)) {
      const username = roomUsers[room].get(socketId);
      roomUsers[room].delete(socketId);
      io.to(room).emit('users list', getRoomUsernames(room));
      io.to(room).emit('user count', { room, count: getRoomUserCount(room) });
      if (roomUsers[room].size === 0) {
        delete roomUsers[room];
        delete typingUsers[room];
      } else {
        stopTyping(io, room, username || '');
      }
    }
  }
}

function stopTyping(io: Server, room: string, username: string) {
  if (typingUsers[room] && typingUsers[room][username]) {
    clearTimeout(typingUsers[room][username]);
    delete typingUsers[room][username];
    io.to(room).emit('stop typing', { user: username });
  }
}

function extractMentions(text: string): string[] {
  const mentions = text.match(/@(\w+)/g);
  if (!mentions) return [];
  return [...new Set(mentions.map(m => m.slice(1).toLowerCase()))];
}

interface JoinRoomData {
  room?: string;
  password?: string;
}

interface ChatMessageData {
  text?: string;
  room?: string;
  replyTo?: { _id: string; user: string; text: string } | null;
  file?: { filename: string; originalname: string; mimetype: string; size: number; url: string } | null;
  forwardedFrom?: string;
}

interface EditMessageData {
  _id: string;
  text?: string;
}

interface DeleteMessageData {
  _id: string;
}

interface ReactionData {
  _id: string;
  emoji: string;
}

interface DeliverMessageData {
  _id: string;
  room: string;
}

interface MarkSeenData {
  room: string;
}

interface SearchData {
  query?: string;
  room?: string;
}

interface LoadMoreData {
  room: string;
  before: string;
}

interface TypingData {
  room: string;
}

interface CreateRoomData {
  name?: string;
  password?: string;
}

interface DeleteRoomData {
  name?: string;
}

interface ForwardMessageData {
  _id: string;
  targetRoom: string;
}

interface PinMessageData {
  _id: string;
  room: string;
}

interface AuthenticatedSocket extends Socket {
  username?: string;
}

function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    const username = socket.username;
    let currentRoom: string | null = null;
    logger.info('User connected', { username });

    socket.on('join room', async (data: string | JoinRoomData) => {
      const roomName = sanitizeRoomName(typeof data === 'string' ? data : data.room || '');
      const roomPassword = typeof data === 'object' ? data.password : undefined;
      if (!roomName) return;

      const isDM = roomName.includes(':dm:');
      let roomDoc = await Room.findOne({ name: roomName });

      if (isDM && !roomDoc) {
        const members = roomName.split(':dm:');
        if (members.length === 2 && members.includes(username || '')) {
          roomDoc = new Room({ name: roomName, isDM: true, members, creator: username });
          await roomDoc.save();
          io.emit('room created', { name: roomName, creator: username, hasPassword: false, isDM: true, members });
        } else {
          socket.emit('room error', { message: 'Invalid DM room' });
          return;
        }
      }

      if (roomDoc && roomDoc.password && !isDM) {
        if (!roomPassword) {
          socket.emit('room error', { message: 'Password required' });
          return;
        }
        const valid = await bcrypt.compare(roomPassword, roomDoc.password);
        if (!valid) {
          socket.emit('room error', { message: 'Incorrect room password' });
          return;
        }
      }

      if (currentRoom) {
        socket.leave(currentRoom);
        if (roomUsers[currentRoom]) {
          roomUsers[currentRoom].delete(socket.id);
          io.to(currentRoom).emit('users list', getRoomUsernames(currentRoom));
          io.to(currentRoom).emit('user count', { room: currentRoom, count: getRoomUserCount(currentRoom) });
        }
      }

      currentRoom = roomName;
      socket.join(roomName);

      if (!roomUsers[roomName]) roomUsers[roomName] = new Map();
      roomUsers[roomName].set(socket.id, username || '');

      io.to(roomName).emit('users list', getRoomUsernames(roomName));
      io.to(roomName).emit('user count', { room: roomName, count: getRoomUserCount(roomName) });
      io.to(roomName).emit('user joined', { username, room: roomName });

      try {
        const msgs = await Message.find({ room: roomName }).sort({ timestamp: 1 }).limit(50);
        socket.emit('load messages', msgs);
        
        const pinnedMsgs = await Message.find({ room: roomName, pinned: true }).sort({ timestamp: -1 }).limit(5);
        if (pinnedMsgs.length > 0) {
          socket.emit('pinned messages', pinnedMsgs);
        }
      } catch (err) { logger.error('Error fetching messages', { error: (err as Error).message }); }
    });

    socket.on('create room', async (data: CreateRoomData) => {
      const name = sanitizeRoomName(data.name || '');
      if (!name) {
        socket.emit('room error', { message: 'Room name required' });
        return;
      }
      try {
        if (await Room.findOne({ name })) {
          socket.emit('room error', { message: 'Room already exists' });
          return;
        }
        const room = new Room({
          name,
          password: data.password ? await bcrypt.hash(data.password, 10) : null,
          creator: username
        });
        await room.save();
        io.emit('room created', { name, creator: username, hasPassword: !!data.password });
      } catch (e) { socket.emit('room error', { message: 'Could not create room' }); }
    });

    socket.on('delete room', async (data: DeleteRoomData) => {
      try {
        const room = await Room.findOne({ name: data.name });
        if (!room) return;
        if (room.creator !== username) {
          socket.emit('room error', { message: 'Only the room creator can delete it' });
          return;
        }
        await Room.deleteOne({ name: data.name });
        await Message.deleteMany({ room: data.name });
        io.emit('room deleted', { name: data.name });
      } catch (e) { socket.emit('room error', { message: 'Could not delete room' }); }
    });

    socket.on('chat message', async (data: ChatMessageData) => {
      const now = Date.now();
      const last = rateLimits[socket.id] || 0;
      if (now - last < 1000) {
        socket.emit('rate limited', { message: 'Slow down!' });
        return;
      }
      rateLimits[socket.id] = now;

      const text = sanitizeText(data.text || '');
      const room = sanitizeRoomName(data.room || '');
      if (!text && !data.file) return;

      const mentions = extractMentions(text);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      try {
        const user = await User.findOne({ username }).select('avatar');
        const msg = new Message({
          room, user: username, text, time, status: 'sent',
          replyTo: data.replyTo || null,
          file: data.file || null,
          mentions,
          pinned: false,
          forwardedFrom: data.forwardedFrom || undefined
        });
        await msg.save();
        const msgObj = msg.toObject();
        (msgObj as any).avatar = user?.avatar || null;
        io.to(room).emit('chat message', msgObj);

        if (mentions.length > 0) {
          for (const mentioned of mentions) {
            if (mentioned !== username?.toLowerCase()) {
              const mentionedUser = await User.findOne({ username: new RegExp(`^${mentioned}$`, 'i') });
              if (mentionedUser) {
                io.emit('notification', {
                  type: 'mention',
                  from: username,
                  room,
                  message: msg,
                  mentionedUser: mentionedUser.username
                });
              }
            }
          }
        }
      } catch (err) { logger.error('Error saving message', { error: (err as Error).message }); }
    });

    socket.on('edit message', async (data: EditMessageData) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg || msg.user !== username) return;
        const oldMentions = msg.mentions || [];
        msg.text = sanitizeText(data.text || '');
        msg.mentions = extractMentions(msg.text);
        msg.edited = true;
        await msg.save();
        io.to(msg.room).emit('message edited', { _id: msg._id, text: msg.text, edited: true, mentions: msg.mentions });
      } catch (e) { logger.error('Error editing message', { error: (e as Error).message }); }
    });

    socket.on('delete message', async (data: DeleteMessageData) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg || msg.user !== username) return;
        msg.deleted = true;
        msg.text = '';
        msg.file = null;
        msg.mentions = [];
        await msg.save();
        io.to(msg.room).emit('message deleted', { _id: msg._id });
      } catch (e) { logger.error('Error deleting message', { error: (e as Error).message }); }
    });

    socket.on('add reaction', async (data: ReactionData) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg) return;
        const existing = msg.reactions.find(r => r.emoji === data.emoji);
        if (existing) {
          const idx = existing.users.indexOf(username || '');
          if (idx > -1) existing.users.splice(idx, 1);
          else existing.users.push(username || '');
          if (existing.users.length === 0) msg.reactions = msg.reactions.filter(r => r.emoji !== data.emoji);
        } else {
          msg.reactions.push({ emoji: data.emoji, users: [username || ''] });
        }
        await msg.save();
        io.to(msg.room).emit('message reactions', { _id: msg._id, reactions: msg.reactions });
      } catch (e) { logger.error('Error adding reaction', { error: (e as Error).message }); }
    });

    socket.on('pin message', async (data: PinMessageData) => {
      try {
        const msg = await Message.findById(data._id);
        if (!msg || msg.room !== data.room) return;
        if (msg.user !== username) {
          const room = await Room.findOne({ name: data.room });
          if (room?.creator !== username) return;
        }
        msg.pinned = !msg.pinned;
        await msg.save();
        io.to(msg.room).emit('message pinned', { _id: msg._id, pinned: msg.pinned });
        
        if (msg.pinned) {
          io.to(msg.room).emit('notification', {
            type: 'pin',
            from: username,
            room: msg.room,
            message: msg
          });
        }
      } catch (e) { logger.error('Error pinning message', { error: (e as Error).message }); }
    });

    socket.on('forward message', async (data: ForwardMessageData) => {
      try {
        const original = await Message.findById(data._id);
        if (!original) return;
        
        const targetRoom = sanitizeRoomName(data.targetRoom);
        const targetRoomDoc = await Room.findOne({ name: targetRoom });
        if (!targetRoomDoc) {
          socket.emit('room error', { message: 'Room not found' });
          return;
        }
        
        const mentions = extractMentions(original.text);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const forwarded = new Message({
          room: targetRoom,
          user: username,
          text: original.text,
          time,
          status: 'sent',
          file: original.file,
          mentions,
          pinned: false,
          forwardedFrom: `Forwarded from #${original.room}`
        });
        await forwarded.save();
        
        io.to(targetRoom).emit('chat message', forwarded);
        socket.emit('message forwarded', { success: true, targetRoom });
      } catch (e) { 
        socket.emit('room error', { message: 'Could not forward message' }); 
      }
    });

    socket.on('deliver message', async (data: DeliverMessageData) => {
      try {
        await Message.updateOne({ _id: data._id }, { status: 'delivered' });
        io.to(data.room).emit('message status', { _id: data._id, status: 'delivered' });
      } catch (e) { /* noop */ }
    });

    socket.on('mark seen', async (data: MarkSeenData) => {
      try {
        const result = await Message.updateMany(
          { room: data.room, user: { $ne: username }, seen: { $ne: username } },
          { $addToSet: { seen: username } }
        );
        if (result.modifiedCount > 0) {
          io.to(data.room).emit('messages seen', { user: username, room: data.room });
        }
      } catch (e) { /* noop */ }
    });

    socket.on('search messages', async (data: SearchData) => {
      try {
        const query = (data.query || '').trim();
        if (!query) {
          socket.emit('search results', []);
          return;
        }
        const filter: Record<string, unknown> = { deleted: { $ne: true }, text: { $regex: query, $options: 'i' } };
        if (data.room) filter.room = data.room;
        const results = await Message.find(filter).sort({ timestamp: -1 }).limit(30);
        socket.emit('search results', results);
      } catch (e) { socket.emit('search results', []); }
    });

    socket.on('load more messages', async (data: LoadMoreData) => {
      try {
        const msgs = await Message.find({
          room: data.room,
          timestamp: { $lt: new Date(data.before) }
        }).sort({ timestamp: -1 }).limit(30);
        socket.emit('more messages', msgs.reverse());
      } catch (e) { logger.error('Error loading messages', { error: (e as Error).message }); }
    });

    socket.on('typing', (data: TypingData) => {
      const room = data.room;
      if (!typingUsers[room]) typingUsers[room] = {};
      if (typingUsers[room][username || '']) {
        clearTimeout(typingUsers[room][username || '']);
      }
      typingUsers[room][username || ''] = setTimeout(() => {
        stopTyping(io, room, username || '');
      }, 3000);
      socket.to(room).emit('typing', { user: username });
    });

    socket.on('stop typing', (data: TypingData) => {
      stopTyping(io, data.room, username || '');
    });

    socket.on('get users', async (data: { room: string }) => {
      socket.emit('users list', getRoomUsernames(data.room));
      socket.emit('user count', { room: data.room, count: getRoomUserCount(data.room) });
    });

    socket.on('disconnect', () => {
      logger.info('User disconnected', { username });
      io.emit('user left', { username, room: currentRoom });
      removeUserFromAllRooms(io, socket.id);
      delete rateLimits[socket.id];
    });
  });
}

export default setupSocketHandlers;

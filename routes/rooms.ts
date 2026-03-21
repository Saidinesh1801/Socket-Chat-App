import { Router, Request, Response } from 'express';
import Room from '../models/Room';
import User from '../models/User';
import Message from '../models/Message';
import httpAuth from '../middleware/httpAuth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const rooms = await Room.find({}).sort({ createdAt: -1 });
    const roomData = rooms.map(r => ({
      name: r.name,
      creator: r.creator,
      hasPassword: !!r.password,
      isDM: r.isDM || false,
      members: r.members || [],
      createdAt: r.createdAt
    }));
    res.json(roomData);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', httpAuth, async (req: Request, res: Response) => {
  try {
    const users = await User.find({}).select('username status');
    res.json(users.map(u => ({
      username: u.username,
      status: u.status || ''
    })));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/search', httpAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) return res.json([]);
    
    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    }).select('username').limit(10);
    
    return res.json(users.map(u => ({ username: u.username })));
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:name/messages/search', httpAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) return res.json([]);
    
    const messages = await Message.find({
      room: req.params.name,
      deleted: { $ne: true },
      text: { $regex: q, $options: 'i' }
    }).select('text user time timestamp replyTo').sort({ timestamp: -1 }).limit(20);
    
    return res.json(messages);
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:name/pinned', httpAuth, async (req: Request, res: Response) => {
  try {
    const messages = await Message.find({
      room: req.params.name,
      pinned: true
    }).sort({ timestamp: -1 }).limit(10);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

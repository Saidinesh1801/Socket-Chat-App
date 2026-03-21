/// <reference path="../types/express.d.ts" />
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import User from '../models/User';
import { sendOTPEmail } from '../utils/email';
import { JWT_SECRET } from '../middleware/socketAuth';
import logger from '../utils/logger';
import { validate } from '../middleware/validation';
import presetAvatars from '../utils/presetAvatars';
import httpAuth from '../middleware/httpAuth';

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', validate('signup'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;
    if (await User.findOne({ username })) {
      res.status(409).json({ error: 'This username is already taken. Please choose a different one.' });
      return;
    }
    if (await User.findOne({ email })) {
      res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    await new User({ username, email, password: hashed }).save();
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    logger.error('Signup error', { error: (err as Error).message });
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/login', validate('login'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ error: 'No account found with this username. Please check your spelling or sign up.' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect password. Please try again or reset your password.' });
      return;
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    logger.error('Login error', { error: (err as Error).message });
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/forgot-password', otpLimiter, validate('forgotPassword'), async (req: Request, res: Response): Promise<void> => {
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      res.json({ message: 'If an account exists, an OTP will be sent' });
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOTPEmail(email, otp);
    res.json({ message: 'Verification code sent to your email', username: user.username });
  } catch (err) {
    logger.error('Forgot password error', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to send email. Check server email config.' });
  }
});

router.post('/verify-otp', otpLimiter, validate('verifyOtp'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user.otp || !user.otpExpiry) {
      res.status(400).json({ error: 'No reset requested.' });
      return;
    }
    if (new Date() > user.otpExpiry) {
      res.status(400).json({ error: 'Code expired. Request a new one.' });
      return;
    }
    const valid = await bcrypt.compare(otp, user.otp);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect verification code' });
      return;
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined as unknown as string;
    user.otpExpiry = undefined as unknown as Date;
    await user.save();
    res.json({ message: 'Password reset successful!' });
  } catch (err) {
    logger.error('OTP verification error', { error: (err as Error).message });
    res.status(500).json({ error: 'Server error' });
  }
});

let sharp: typeof import('sharp') | null;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const safeUsername = (req.username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'avatar-' + safeUsername + '-' + Date.now() + ext);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed (jpg, png, gif, webp)') as unknown as null, false);
    }
  }
});

router.get('/profile', httpAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ username: req.username }).select('-password -otp -otpExpiry');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ username: user.username, email: user.email, avatar: user.avatar, status: user.status, createdAt: user.createdAt });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/profile/presets', (req: Request, res: Response): void => {
  res.json(presetAvatars);
});

router.get('/profile/:username', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('username avatar status createdAt');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ username: user.username, avatar: user.avatar, status: user.status, createdAt: user.createdAt });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/profile/avatar', httpAuth, (req: Request, res: Response): void => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) {
      logger.error('Multer error', { error: (err as Error).message });
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    try {
      const safeFilename = req.file.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const avatarUrl = `/uploads/${safeFilename}`;
      await User.updateOne({ username: req.username }, { avatar: avatarUrl });
      logger.info('Avatar updated', { username: req.username, avatar: avatarUrl });
      res.json({ avatar: avatarUrl });
    } catch (e) {
      logger.error('Avatar upload failed', { error: (e as Error).message, username: req.username, stack: (e as Error).stack });
      res.status(500).json({ error: 'Failed to save avatar' });
    }
  });
});

router.delete('/profile/avatar', httpAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await User.updateOne({ username: req.username }, { avatar: null });
    res.json({ message: 'Avatar removed', avatar: null });
  } catch (e) {
    logger.error('Remove avatar failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
});

router.get('/profile/presets', (req: Request, res: Response): void => {
  res.json(presetAvatars);
});

router.get('/browse/avatars', async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string) || 'fun';
  const page = parseInt(req.query.page as string) || 1;
  logger.info('Avatar search', { q, page });
  try {
    const results: Array<{ id: string; url: string; thumb: string; resolution: string }> = [];
    const seeds = [
      q + (page * 1), q + (page * 2), q + (page * 3), q + (page * 4),
      q + (page * 5), q + (page * 6), q + (page * 7), q + (page * 8),
      q + (page * 9), q + (page * 10), q + (page * 11), q + (page * 12)
    ];
    seeds.forEach((seed, i) => {
      results.push({
        id: `av-${page}-${i}`,
        url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`,
        thumb: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&size=100`,
        resolution: '320x320'
      });
    });
    res.json({ results, pages: 10, current: page });
  } catch (e) {
    logger.error('Fetch avatars failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Could not fetch avatars' });
  }
});

router.post('/profile/avatar-url', httpAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { avatar } = req.body;
    if (!avatar) {
      res.status(400).json({ error: 'Avatar URL required' });
      return;
    }
    await User.updateOne({ username: req.username }, { avatar });
    res.json({ avatar });
  } catch (e) {
    logger.error('Set avatar URL failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Failed to set avatar' });
  }
});

router.get('/profile/avatar-categories', (req: Request, res: Response): void => {
  res.json([
    { id: 'cool', name: 'Cool Styles' },
    { id: 'vibrant', name: 'Vibrant Colors' },
    { id: 'pastel', name: 'Pastel' },
    { id: 'robots', name: 'Robots' },
    { id: 'fun', name: 'Fun' },
  ]);
});

router.post('/profile/avatar/preset', httpAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { presetId, category } = req.body;
    logger.info('Avatar preset request', { presetId, category, availableCategories: Object.keys(presetAvatars) });
    if (!presetId || !category) {
      res.status(400).json({ error: 'Preset ID and category required' });
      return;
    }
    const categoryAvatars = presetAvatars[category];
    if (!categoryAvatars) {
      logger.warn('Invalid category', { category, available: Object.keys(presetAvatars) });
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    const preset = categoryAvatars.find(p => p.id === presetId);
    if (!preset) {
      res.status(400).json({ error: 'Preset not found' });
      return;
    }
    await User.updateOne({ username: req.username }, { avatar: preset.url });
    res.json({ avatar: preset.url });
  } catch (e) {
    logger.error('Set preset avatar failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Failed to set avatar' });
  }
});

router.put('/profile/status', httpAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = (req.body.status || '').trim().slice(0, 100);
    await User.updateOne({ username: req.username }, { status });
    res.json({ status });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

export default router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { sendOTPEmail } = require('../utils/email');
const { JWT_SECRET } = require('../middleware/socketAuth');
const logger = require('../utils/logger');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', async (req, res) => {
  try {
    let { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    username = username.trim().slice(0, 24);
    email = email.trim().toLowerCase();
    password = password.trim();
    if (username.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (await User.findOne({ username })) return res.status(409).json({ error: 'Username already taken' });
    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    await new User({ username, email, password: hashed }).save();
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    logger.error('Signup error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    username = username.trim();
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account found with this email' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = await bcrypt.hash(otp, 10);
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOTPEmail(email, otp);
    res.json({ message: 'Verification code sent to your email', username: user.username });
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
    res.status(500).json({ error: 'Failed to send email. Check server email config.' });
  }
});

router.post('/verify-otp', otpLimiter, async (req, res) => {
  try {
    let { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required' });
    email = email.trim().toLowerCase();
    newPassword = newPassword.trim();
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.otp || !user.otpExpiry) return res.status(400).json({ error: 'No reset requested.' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    const valid = await bcrypt.compare(otp, user.otp);
    if (!valid) return res.status(401).json({ error: 'Incorrect verification code' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    res.json({ message: 'Password reset successful!' });
  } catch (err) {
    logger.error('OTP verification error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

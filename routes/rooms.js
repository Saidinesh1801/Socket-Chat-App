const express = require('express');
const Room = require('../models/Room');

const router = express.Router();

router.get('/', async (req, res) => {
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

module.exports = router;

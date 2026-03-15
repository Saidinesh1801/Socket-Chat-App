const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: { type: String, index: true },
  user: String,
  text: { type: String, default: '' },
  time: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: 'sent' },
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  replyTo: { _id: String, user: String, text: String },
  reactions: [{ emoji: String, users: [String] }],
  seen: [String],
  file: { filename: String, originalname: String, mimetype: String, size: Number, url: String }
});

messageSchema.index({ room: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);

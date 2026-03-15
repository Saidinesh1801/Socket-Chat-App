const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp';
  logger.info('Connecting to MongoDB...');
  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
  }
};

module.exports = connectDB;

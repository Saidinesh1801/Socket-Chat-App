import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatApp';
  
  const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    family: 4
  };
  
  logger.info('Connecting to MongoDB...');
  
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });
  
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  
  try {
    await mongoose.connect(uri, options);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection error', { error: (err as Error).message });
  }
};

export default connectDB;

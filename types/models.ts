import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar: string | null;
  status: string;
  otp: string | null;
  otpExpiry: Date | null;
  createdAt: Date;
}

export interface IMessage extends Document {
  room: string;
  user: string;
  text: string;
  time: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'seen';
  edited: boolean;
  deleted: boolean;
  replyTo?: {
    _id: string;
    user: string;
    text: string;
  } | null;
  reactions: Array<{
    emoji: string;
    users: string[];
  }>;
  seen: string[];
  file?: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    url: string;
  } | null;
}

export interface IRoom extends Document {
  name: string;
  password: string | null;
  creator: string;
  isDM: boolean;
  members: string[];
  createdAt: Date;
}

export interface JwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}

export interface SocketData {
  username: string;
}

export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
}

export interface PresetAvatarCategory {
  [key: string]: PresetAvatar[];
}

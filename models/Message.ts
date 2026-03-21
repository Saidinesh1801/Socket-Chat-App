import mongoose, { Schema, Document } from 'mongoose';

export interface IReplyTo {
  _id: string;
  user: string;
  text: string;
}

export interface IFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface IReaction {
  emoji: string;
  users: string[];
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
  replyTo?: IReplyTo | null;
  reactions: IReaction[];
  seen: string[];
  file?: IFile | null;
  mentions: string[];
  pinned: boolean;
  forwardedFrom?: string;
}

const messageSchema = new Schema<IMessage>({
  room: { type: String, index: true },
  user: String,
  text: { type: String, default: '' },
  time: String,
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, default: 'sent' },
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false, index: true },
  replyTo: { _id: String, user: String, text: String },
  reactions: [{ emoji: String, users: [String] }],
  seen: [String],
  file: { filename: String, originalname: String, mimetype: String, size: Number, url: String },
  mentions: [{ type: String, index: true }],
  pinned: { type: Boolean, default: false, index: true },
  forwardedFrom: String
});

messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ room: 1, deleted: 1, timestamp: -1 });
messageSchema.index({ room: 1, pinned: 1 });
messageSchema.index({ user: 1, timestamp: -1 });
messageSchema.index({ text: 'text' });

export default mongoose.model<IMessage>('Message', messageSchema);

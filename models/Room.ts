import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  name: string;
  password: string | null;
  creator: string;
  isDM: boolean;
  members: string[];
  createdAt: Date;
}

const roomSchema = new Schema<IRoom>({
  name: { type: String, unique: true, required: true, index: true },
  password: { type: String, default: null },
  creator: { type: String, index: true },
  isDM: { type: Boolean, default: false },
  members: [String],
  createdAt: { type: Date, default: Date.now }
});

roomSchema.index({ isDM: 1, members: 1 });

export default mongoose.model<IRoom>('Room', roomSchema);

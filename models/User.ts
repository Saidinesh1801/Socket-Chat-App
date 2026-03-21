import mongoose, { Schema, Document } from 'mongoose';

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

const userSchema = new Schema<IUser>({
  username: { type: String, unique: true, required: true, index: true },
  email: { type: String, unique: true, required: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  status: { type: String, default: "Hey there! I'm using Chat" },
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

userSchema.index({ email: 1, otp: 1 });

export default mongoose.model<IUser>('User', userSchema);

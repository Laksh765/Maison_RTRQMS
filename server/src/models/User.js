import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'restaurant_admin'], default: 'customer', required: true },
  restaurantId: {
    type: String,
    default: null,
    index: true,
    required() { return this.role === 'restaurant_admin'; },
  },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);

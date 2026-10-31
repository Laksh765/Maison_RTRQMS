import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema({
  _id: { type: String, required: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 400 },
  cuisine: { type: String, required: true, trim: true, maxlength: 80 },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  coverImage: { type: String, required: true, trim: true },
  isDemo: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

export const Restaurant = mongoose.model('Restaurant', restaurantSchema);

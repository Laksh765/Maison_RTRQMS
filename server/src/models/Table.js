import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  restaurantId: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1, max: 12 },
  active: { type: Boolean, default: true },
});

tableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });
tableSchema.index({ restaurantId: 1, active: 1, capacity: 1 });

export const Table = mongoose.model('Table', tableSchema);

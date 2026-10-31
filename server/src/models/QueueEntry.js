import mongoose from 'mongoose';

const queueEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  restaurantId: { type: String },
  restaurantName: { type: String },
  restaurantAddress: { type: String },
  code: { type: String, required: true, unique: true },
  guests: { type: Number, required: true, min: 1, max: 8 },
  status: { type: String, enum: ['Waiting', 'Called', 'Seated', 'Left'], default: 'Waiting' },
  active: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

queueEntrySchema.index({ userId: 1, active: 1 }, {
  unique: true,
  partialFilterExpression: { active: true },
});
queueEntrySchema.index({ status: 1, joinedAt: 1, _id: 1 });
queueEntrySchema.index({ restaurantId: 1, active: 1, joinedAt: 1, _id: 1 });

export const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);

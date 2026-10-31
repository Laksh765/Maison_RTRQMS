import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  restaurantId: { type: String },
  restaurantName: { type: String },
  restaurantAddress: { type: String },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
  tableNumber: { type: Number, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  guests: { type: Number, required: true, min: 1, max: 8 },
  note: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['Confirmed', 'Cancelled'], default: 'Confirmed' },
}, { timestamps: true });

reservationSchema.index({ date: 1, time: 1, tableId: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'Confirmed' },
});
reservationSchema.index({ restaurantId: 1, date: 1, time: 1, status: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema);

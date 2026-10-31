import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireCustomer } from '../middleware/auth.js';
import { Reservation } from '../models/Reservation.js';
import { Restaurant } from '../models/Restaurant.js';
import { Table } from '../models/Table.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { isValidDateTime } from '../utils/scheduling.js';

const router = Router();
router.use(requireAuth);
router.use(requireCustomer);
const querySchema = z.object({
  restaurantId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  date: z.string(),
  time: z.string(),
  guests: z.coerce.number().int().min(1).max(8),
});
const createSchema = z.object({
  restaurantId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  date: z.string(),
  time: z.string(),
  guests: z.number().int().min(1).max(8),
  note: z.string().trim().max(500).optional().default(''),
}).strict();

router.get('/availability', asyncHandler(async (request, response) => {
  const parsed = querySchema.safeParse(request.query);
  if (!parsed.success || !isValidDateTime(parsed.data.date, parsed.data.time)) {
    throw new HttpError(400, 'Choose a valid future reservation date and available time.');
  }
  const { restaurantId, date, time, guests } = parsed.data;
  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true }).select('_id');
  if (!restaurant) throw new HttpError(404, 'Restaurant not found.');
  const [tables, occupied] = await Promise.all([
    Table.find({ restaurantId, active: true, capacity: { $gte: guests } }).sort({ number: 1 }).lean(),
    Reservation.find({ restaurantId, date, time, status: 'Confirmed' }).select('tableId').lean(),
  ]);
  const unavailable = new Set(occupied.map(({ tableId }) => String(tableId)));
  response.json({ tables: tables.filter(({ _id }) => !unavailable.has(String(_id))).map(({ _id, number, capacity }) => ({ id: _id, number, capacity })) });
}));

router.post('/', asyncHandler(async (request, response) => {
  const parsed = createSchema.safeParse(request.body);
  if (!parsed.success || !isValidDateTime(parsed.data.date, parsed.data.time)) {
    throw new HttpError(400, 'Choose a valid future reservation date, time, and party size.');
  }
  const { restaurantId, date, time, guests, note } = parsed.data;
  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true }).select('_id name address');
  if (!restaurant) throw new HttpError(404, 'Restaurant not found.');
  const [tables, occupied] = await Promise.all([
    Table.find({ restaurantId, active: true, capacity: { $gte: guests } }).sort({ number: 1 }).lean(),
    Reservation.find({ restaurantId, date, time, status: 'Confirmed' }).select('tableId').lean(),
  ]);
  const unavailable = new Set(occupied.map(({ tableId }) => String(tableId)));
  const availableTables = tables.filter(({ _id }) => !unavailable.has(String(_id)));
  for (const table of availableTables) {
    try {
      const reservation = await Reservation.create({
        userId: request.userId,
        restaurantId,
        restaurantName: restaurant.name,
        restaurantAddress: restaurant.address,
        tableId: table._id,
        tableNumber: table.number,
        date,
        time,
        guests,
        note,
      });
      return response.status(201).json({ reservation });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new HttpError(409, 'That time has just filled up. Please choose another.');
}));

router.get('/mine', asyncHandler(async (request, response) => {
  const reservations = await Reservation.find({ userId: request.userId }).sort({ date: -1, time: -1 }).lean();
  response.json({ reservations });
}));

router.get('/:id', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, 'Invalid reservation.');
  const reservation = await Reservation.findOne({ _id: request.params.id, userId: request.userId }).lean();
  if (!reservation) throw new HttpError(404, 'Reservation not found.');
  response.json({ reservation });
}));

router.patch('/:id/cancel', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, 'Invalid reservation.');
  const reservation = await Reservation.findOne({ _id: request.params.id, userId: request.userId });
  if (!reservation) throw new HttpError(404, 'Reservation not found.');
  if (reservation.status !== 'Confirmed') throw new HttpError(409, 'This reservation has already been cancelled.');
  if (!isValidDateTime(reservation.date, reservation.time)) {
    throw new HttpError(409, 'Past reservations can no longer be cancelled.');
  }
  reservation.status = 'Cancelled';
  await reservation.save();
  response.json({ reservation });
}));

export default router;

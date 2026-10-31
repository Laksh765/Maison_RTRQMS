import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRestaurantAdmin } from '../middleware/auth.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { Reservation } from '../models/Reservation.js';
import { Restaurant } from '../models/Restaurant.js';
import { Table } from '../models/Table.js';
import { User } from '../models/User.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { QUEUE_TRANSITIONS } from '../utils/staff-workflows.js';
import { isValidDateTime } from '../utils/scheduling.js';

const router = Router();
router.use(requireAuth, requireRestaurantAdmin);

router.get('/me', asyncHandler(async (request, response) => {
  const [user, restaurant] = await Promise.all([
    User.findById(request.userId).select('name email role restaurantId'),
    Restaurant.findById(request.restaurantId)
      .select('_id name area address')
      .lean(),
  ]);
  if (!user || !restaurant) throw new HttpError(403, 'Restaurant administrator access is required.');
  response.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: { id: restaurant._id, name: restaurant.name, area: restaurant.area, address: restaurant.address },
  });
}));

router.get('/reservations', asyncHandler(async (request, response) => {
  const reservations = await Reservation.find({ restaurantId: request.restaurantId })
    .sort({ date: 1, time: 1 })
    .populate('userId', 'name email')
    .lean();
  response.json({
    reservations: reservations.map((reservation) => ({
      ...reservation,
      customer: reservation.userId ? {
        name: reservation.userId.name,
        email: reservation.userId.email,
      } : null,
      userId: undefined,
    })),
  });
}));

router.patch('/reservations/:reservationId/status', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.reservationId)) throw new HttpError(400, 'Invalid reservation.');
  const parsed = z.object({ status: z.literal('Cancelled') }).strict().safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'Choose a valid reservation status.');
  const reservation = await Reservation.findOne({
    _id: request.params.reservationId,
    restaurantId: request.restaurantId,
  });
  if (!reservation) throw new HttpError(404, 'Reservation not found.');
  if (reservation.status !== 'Confirmed') throw new HttpError(409, 'This reservation is no longer confirmed.');
  if (!isValidDateTime(reservation.date, reservation.time)) {
    throw new HttpError(409, 'Past reservations can no longer be cancelled.');
  }
  reservation.status = parsed.data.status;
  await reservation.save();
  response.json({ reservation });
}));

router.get('/queue', asyncHandler(async (request, response) => {
  const entries = await QueueEntry.find({ restaurantId: request.restaurantId, active: true })
    .sort({ joinedAt: 1, _id: 1 })
    .populate('userId', 'name email')
    .lean();
  response.json({
    entries: entries.map((entry, index) => ({
      ...entry,
      position: index + 1,
      customer: entry.userId ? { name: entry.userId.name, email: entry.userId.email } : null,
      userId: undefined,
    })),
  });
}));

router.patch('/queue/:queueEntryId/status', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.queueEntryId)) throw new HttpError(400, 'Invalid queue entry.');
  const parsed = z.object({ status: z.enum(['Called', 'Seated', 'Left']) }).strict().safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'Choose a valid queue status.');
  const nextStatus = parsed.data.status;
  const allowedCurrentStatuses = Object.entries(QUEUE_TRANSITIONS)
    .filter(([, allowedNextStatuses]) => allowedNextStatuses.includes(nextStatus))
    .map(([status]) => status);
  const updates = { status: nextStatus };
  if (nextStatus === 'Seated' || nextStatus === 'Left') {
    updates.active = false;
    updates.completedAt = new Date();
  }
  const entry = await QueueEntry.findOneAndUpdate({
    _id: request.params.queueEntryId,
    restaurantId: request.restaurantId,
    active: true,
    status: { $in: allowedCurrentStatuses },
  }, {
    $set: updates,
  }, {
    new: true,
    runValidators: true,
  });
  if (!entry) {
    const exists = await QueueEntry.exists({
      _id: request.params.queueEntryId,
      restaurantId: request.restaurantId,
    });
    if (!exists) throw new HttpError(404, 'Queue entry not found.');
    throw new HttpError(409, 'This queue entry has already changed or can no longer be advanced.');
  }
  response.json({ entry });
}));

router.get('/tables', asyncHandler(async (request, response) => {
  const parsed = z.object({
    date: z.string().optional(),
    time: z.string().optional(),
  }).strict().safeParse(request.query);
  if (!parsed.success || Boolean(parsed.data.date) !== Boolean(parsed.data.time)) {
    throw new HttpError(400, 'Choose both a valid date and seating time to check availability.');
  }
  const { date, time } = parsed.data;
  if (date && !isValidDateTime(date, time)) {
    throw new HttpError(400, 'Choose a valid future date and seating time to check availability.');
  }
  const tables = await Table.find({ restaurantId: request.restaurantId })
    .sort({ number: 1 })
    .select('number capacity active')
    .lean();
  const occupied = date
    ? await Reservation.find({ restaurantId: request.restaurantId, date, time, status: 'Confirmed' })
      .select('tableId')
      .lean()
    : [];
  const occupiedIds = new Set(occupied.map(({ tableId }) => String(tableId)));
  response.json({
    tables: tables.map((table) => ({
      ...table,
      available: date ? table.active && !occupiedIds.has(String(table._id)) : null,
    })),
  });
}));

export default router;

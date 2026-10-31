import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireCustomer } from '../middleware/auth.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { Restaurant } from '../models/Restaurant.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { estimatedWaitMinutes, queuePosition } from '../utils/scheduling.js';
import { env } from '../config/env.js';

const router = Router();
router.use(requireAuth);
router.use(requireCustomer);
const joinSchema = z.object({
  restaurantId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  guests: z.number().int().min(1).max(8),
}).strict();

async function entriesForUser(userId) {
  const entries = await QueueEntry.find({ userId }).sort({ joinedAt: -1 }).lean();
  const restaurantIds = [...new Set(entries.map(({ restaurantId }) => restaurantId).filter(Boolean))];
  const active = restaurantIds.length
    ? await QueueEntry.find({ active: true, restaurantId: { $in: restaurantIds } }).select('restaurantId joinedAt').sort({ joinedAt: 1, _id: 1 }).lean()
    : [];
  return entries.map((entry) => {
    if (!entry.active || !entry.restaurantId) return { entry, position: null, estimatedWaitMinutes: null };
    const activeAtRestaurant = active.filter(({ restaurantId }) => restaurantId === entry.restaurantId);
    const position = queuePosition(activeAtRestaurant, entry._id);
    return { entry, position, estimatedWaitMinutes: estimatedWaitMinutes(position, env.QUEUE_MINUTES_PER_PARTY) };
  });
}

router.post('/', asyncHandler(async (request, response) => {
  const parsed = joinSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'Choose a restaurant and party size from 1 to 8.');
  const restaurant = await Restaurant.findOne({ _id: parsed.data.restaurantId, isActive: true }).select('_id name address');
  if (!restaurant) throw new HttpError(404, 'Restaurant not found.');
  const entry = new QueueEntry({
    userId: request.userId,
    restaurantId: parsed.data.restaurantId,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address,
    guests: parsed.data.guests,
    code: crypto.randomBytes(4).toString('hex').toUpperCase(),
  });
  try {
    await entry.save();
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.userId) throw new HttpError(409, 'You already have an active place in the queue.');
    throw error;
  }
  const calculated = await entriesForUser(request.userId);
  response.status(201).json({ entry: calculated.find(({ entry: item }) => String(item._id) === String(entry._id)) });
}));

router.get('/mine', asyncHandler(async (request, response) => {
  response.json({ entries: await entriesForUser(request.userId) });
}));

router.get('/:id', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, 'Invalid queue entry.');
  const entries = await entriesForUser(request.userId);
  const entry = entries.find(({ entry: item }) => String(item._id) === request.params.id);
  if (!entry) throw new HttpError(404, 'Queue entry not found.');
  response.json(entry);
}));

router.patch('/:id/leave', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, 'Invalid queue entry.');
  const entry = await QueueEntry.findOne({ _id: request.params.id, userId: request.userId });
  if (!entry) throw new HttpError(404, 'Queue entry not found.');
  if (!entry.active || entry.status !== 'Waiting') throw new HttpError(409, 'This queue entry can no longer be left.');
  entry.status = 'Left';
  entry.active = false;
  entry.completedAt = new Date();
  await entry.save();
  response.json({ entry });
}));

export default router;

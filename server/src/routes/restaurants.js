import { Router } from 'express';
import { Restaurant } from '../models/Restaurant.js';
import { asyncHandler, HttpError } from '../utils/errors.js';

const router = Router();

router.get('/', asyncHandler(async (_request, response) => {
  const restaurants = await Restaurant.find({ isActive: true })
    .select('_id name description cuisine area address coverImage isDemo')
    .sort({ name: 1 })
    .lean();
  response.json({
    restaurants: restaurants.map(({ _id, ...restaurant }) => ({ id: _id, ...restaurant })),
  });
}));

router.get('/:restaurantId', asyncHandler(async (request, response) => {
  const restaurant = await Restaurant.findOne({ _id: request.params.restaurantId, isActive: true })
    .select('_id name description cuisine area address coverImage isDemo')
    .lean();
  if (!restaurant) throw new HttpError(404, 'Restaurant not found.');
  const { _id, ...details } = restaurant;
  response.json({ restaurant: { id: _id, ...details } });
}));

export default router;

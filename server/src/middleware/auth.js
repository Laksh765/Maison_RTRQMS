import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Restaurant } from '../models/Restaurant.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/errors.js';

export const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export function requireAuth(request, response, next) {
  const token = request.cookies?.rtrqms_session;
  if (!token) return next(new HttpError(401, 'Please sign in to continue.'));
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      return next(new HttpError(401, 'Please sign in to continue.'));
    }
    request.userId = payload.sub;
    return next();
  } catch {
    return next(new HttpError(401, 'Please sign in to continue.'));
  }
}

export async function requireCustomer(request, _response, next) {
  try {
    const user = await User.findById(request.userId).select('role');
    if (!user || (user.role && user.role !== 'customer')) {
      return next(new HttpError(403, 'A customer account is required.'));
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireRestaurantAdmin(request, _response, next) {
  try {
    const user = await User.findById(request.userId).select('role restaurantId');
    if (!user || user.role !== 'restaurant_admin' || !user.restaurantId) {
      return next(new HttpError(403, 'Restaurant administrator access is required.'));
    }
    const restaurant = await Restaurant.findOne({ _id: user.restaurantId, isActive: true }).select('_id');
    if (!restaurant) return next(new HttpError(403, 'Your restaurant access is no longer active.'));
    request.restaurantId = user.restaurantId;
    return next();
  } catch (error) {
    return next(error);
  }
}

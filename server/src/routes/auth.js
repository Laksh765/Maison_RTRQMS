import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { User } from '../models/User.js';
import { Restaurant } from '../models/Restaurant.js';
import { requireAuth, cookieOptions } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { env } from '../config/env.js';

const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please wait a little before trying again.' } });
const passwordSchema = z.string().min(8).max(72).refine(
  (password) => Buffer.byteLength(password, 'utf8') <= 72,
);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: passwordSchema,
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
  ),
}).strict();

function issueSession(user, response) {
  const token = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN });
  response.cookie('rtrqms_session', token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'customer',
    restaurantId: user.restaurantId || null,
  };
}

router.post('/register', authLimit, asyncHandler(async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a name, valid email, and password of at least 8 characters.');
  const email = parsed.data.email.toLowerCase();
  const user = new User({ name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) throw new HttpError(400, 'Unable to create an account with those details.');
    throw error;
  }
  response.status(201).json({ user: issueSession(user, response) });
}));

router.post('/login', authLimit, asyncHandler(async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email and password.');
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!passwordMatches || (user.role && user.role !== 'customer')) throw new HttpError(401, 'Email or password is incorrect.');
  response.json({ user: issueSession(user, response) });
}));

router.post('/staff/login', authLimit, asyncHandler(async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a valid staff email and password.');
  const user = await User.findOne({ email: parsed.data.email.toLowerCase(), role: 'restaurant_admin' })
    .select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!passwordMatches || !user.restaurantId) throw new HttpError(401, 'Email or password is incorrect.');
  const restaurant = await Restaurant.findOne({ _id: user.restaurantId, isActive: true }).select('_id');
  if (!restaurant) throw new HttpError(401, 'Email or password is incorrect.');
  response.json({ user: issueSession(user, response) });
}));

router.post('/logout', (request, response) => {
  response.clearCookie('rtrqms_session', cookieOptions);
  response.json({ message: 'Signed out.' });
});

router.get('/me', requireAuth, asyncHandler(async (request, response) => {
  const user = await User.findById(request.userId).select('name email role restaurantId');
  if (!user) throw new HttpError(401, 'Please sign in to continue.');
  response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'customer',
      restaurantId: user.restaurantId || null,
    },
  });
}));

export default router;

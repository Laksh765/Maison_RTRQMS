import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import restaurantRoutes from './routes/restaurants.js';
import reservationRoutes from './routes/reservations.js';
import queueRoutes from './routes/queue.js';
import staffRoutes from './routes/staff.js';
import { HttpError } from './utils/errors.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/staff', staffRoutes);
app.use((_request, _response, next) => next(new HttpError(404, 'Not found.')));
app.use((error, _request, response, _next) => {
  if (error instanceof HttpError) return response.status(error.status).json({ message: error.message });
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ message: 'The request is too large.' });
  }
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ message: 'The request body must be valid JSON.' });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return response.status(400).json({ message: 'Please check the information you entered.' });
  }
  console.error('Unhandled request error:', error);
  return response.status(500).json({ message: 'Something went wrong. Please try again.' });
});

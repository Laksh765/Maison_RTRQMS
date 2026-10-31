import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Reservation } from './models/Reservation.js';
import { QueueEntry } from './models/QueueEntry.js';
import { Table } from './models/Table.js';
import { Restaurant } from './models/Restaurant.js';

try {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([User.init(), Reservation.init(), QueueEntry.init(), Table.init(), Restaurant.init()]);
  const server = app.listen(env.PORT, () => console.log(`RTRQMS API listening on http://localhost:${env.PORT}`));
  const close = async () => {
    server.close();
    await mongoose.disconnect();
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
} catch (error) {
  console.error('Could not start the API. Check MONGODB_URI and confirm MongoDB is running.', error.message);
  process.exit(1);
}

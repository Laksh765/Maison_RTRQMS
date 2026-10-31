import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { DEMO_RESTAURANTS, SEED_RESTAURANTS } from '../src/data/seedRestaurants.js';
import { QueueEntry } from '../src/models/QueueEntry.js';
import { Reservation } from '../src/models/Reservation.js';
import { Restaurant } from '../src/models/Restaurant.js';
import { Table } from '../src/models/Table.js';
import { User } from '../src/models/User.js';

try {
  if (env.DEMO_ADMIN_PASSWORD && env.NODE_ENV === 'production') {
    throw new Error('DEMO_ADMIN_PASSWORD may only be used outside production.');
  }
  if (env.DEMO_ADMIN_PASSWORD
    && (env.DEMO_ADMIN_PASSWORD.length < 12 || Buffer.byteLength(env.DEMO_ADMIN_PASSWORD, 'utf8') > 72)) {
    throw new Error('DEMO_ADMIN_PASSWORD must be 12 to 72 bytes.');
  }
  await mongoose.connect(env.MONGODB_URI);
  for (const restaurant of SEED_RESTAURANTS) {
    const { id, ...fields } = restaurant;
    await Restaurant.updateOne({ _id: id }, { $set: fields }, { upsert: true });
  }
  const legacyRestaurant = SEED_RESTAURANTS[0];
  const [legacyReservations, legacyQueueEntries, legacyTables] = await Promise.all([
    Reservation.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId: legacyRestaurant.id, restaurantName: legacyRestaurant.name, restaurantAddress: legacyRestaurant.address } },
    ),
    QueueEntry.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId: legacyRestaurant.id, restaurantName: legacyRestaurant.name, restaurantAddress: legacyRestaurant.address } },
    ),
    Table.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId: legacyRestaurant.id } },
    ),
  ]);

  try {
    await Table.createCollection();
  } catch (error) {
    if (error.code !== 48) throw error;
  }
  const tableIndexes = await Table.collection.indexes();
  if (tableIndexes.some(({ name }) => name === 'number_1')) {
    await Table.collection.dropIndex('number_1');
  }
  const capacities = [2, 2, 4, 4, 6, 8];
  const tables = SEED_RESTAURANTS.flatMap((restaurant, restaurantIndex) =>
    capacities.map((capacity, tableIndex) => ({
      number: restaurantIndex * capacities.length + tableIndex + 1,
      restaurantId: restaurant.id,
      capacity,
    })),
  );
  for (const table of tables) {
    await Table.updateOne(
      { restaurantId: table.restaurantId, number: table.number },
      { $setOnInsert: { restaurantId: table.restaurantId, number: table.number, capacity: table.capacity, active: true } },
      { upsert: true },
    );
  }
  let adminCount = 0;
  if (env.DEMO_ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(env.DEMO_ADMIN_PASSWORD, 12);
    for (const restaurant of DEMO_RESTAURANTS) {
      const email = `admin+${restaurant.id.replace('demo-', '')}@demo.maison.local`;
      const existing = await User.findOne({ email });
      if (existing && (existing.role !== 'restaurant_admin' || existing.restaurantId !== restaurant.id)) {
        throw new Error(`Cannot provision demo administrator; ${email} is already assigned to another account.`);
      }
      if (existing) {
        existing.name = `${restaurant.name} Admin`;
        existing.passwordHash = passwordHash;
        await existing.save();
      } else {
        await User.create({
          name: `${restaurant.name} Admin`,
          email,
          passwordHash,
          role: 'restaurant_admin',
          restaurantId: restaurant.id,
        });
      }
      adminCount += 1;
    }
  }
  console.log(`Seeded ${SEED_RESTAURANTS.length} restaurants and ${tables.length} sample tables. Existing reservations and other user/table records were not deleted.`);
  if (legacyReservations.modifiedCount || legacyQueueEntries.modifiedCount) {
    console.log(`Assigned ${legacyReservations.modifiedCount} pre-directory reservations and ${legacyQueueEntries.modifiedCount} pre-directory walk-ins to ${legacyRestaurant.name}.`);
  }
  if (legacyTables.modifiedCount) console.log(`Assigned ${legacyTables.modifiedCount} legacy tables to ${legacyRestaurant.name} without changing their capacities.`);
  if (adminCount) console.log(`Provisioned ${adminCount} demo restaurant administrator accounts using DEMO_ADMIN_PASSWORD.`);
  else console.log('No demo administrator accounts created; set DEMO_ADMIN_PASSWORD in server/.env to provision them.');
} catch (error) {
  console.error('Could not seed tables. Check MONGODB_URI and confirm MongoDB is running.', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

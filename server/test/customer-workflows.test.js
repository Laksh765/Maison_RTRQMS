import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { QueueEntry } from '../src/models/QueueEntry.js';
import { Reservation } from '../src/models/Reservation.js';
import { Restaurant } from '../src/models/Restaurant.js';
import { Table } from '../src/models/Table.js';
import { User } from '../src/models/User.js';

function query(value) {
  const resolveValue = () => typeof value === 'function' ? value() : value;
  return {
    select() { return this; },
    sort() { return this; },
    lean() { return Promise.resolve(resolveValue()); },
    then(resolve, reject) { return Promise.resolve(resolveValue()).then(resolve, reject); },
  };
}

test('customer reservation and walk-in workflows keep restaurant context through cancellation and leaving', async (t) => {
  const originals = {
    userFindById: User.findById,
    restaurantFindOne: Restaurant.findOne,
    tableFind: Table.find,
    reservationFind: Reservation.find,
    reservationFindOne: Reservation.findOne,
    reservationCreate: Reservation.create,
    queueFind: QueueEntry.find,
    queueFindOne: QueueEntry.findOne,
    queueSave: QueueEntry.prototype.save,
  };
  const customerId = '507f1f77bcf86cd799439011';
  const restaurantId = 'demo-copper-cardamom';
  const reservationId = '507f1f77bcf86cd799439012';
  const diningDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const date = `${diningDate.getFullYear()}-${String(diningDate.getMonth() + 1).padStart(2, '0')}-${String(diningDate.getDate()).padStart(2, '0')}`;
  const restaurant = {
    _id: restaurantId,
    name: 'Copper & Cardamom (Demo)',
    address: 'Fictional demo venue, Mumbai, India',
  };
  const bookings = [];
  const queueEntries = [];

  User.findById = () => query({ id: customerId, role: 'customer' });
  Restaurant.findOne = () => query(restaurant);
  Table.find = (filter) => query(filter.restaurantId === restaurantId
    ? [{ _id: 'table-demo-1', number: 1, capacity: 4 }]
    : []);
  Reservation.find = (filter) => query(bookings.filter((booking) =>
    Object.entries(filter).every(([key, value]) => String(booking[key]) === String(value))));
  Reservation.create = async (data) => {
    const booking = {
      _id: reservationId,
      ...data,
      status: 'Confirmed',
      async save() {},
    };
    bookings.push(booking);
    return booking;
  };
  Reservation.findOne = (filter) => query(() => bookings.find((booking) =>
    Object.entries(filter).every(([key, value]) => String(booking[key]) === String(value))) || null);
  QueueEntry.prototype.save = async function saveQueueEntry() {
    queueEntries.push(this.toObject());
  };
  QueueEntry.find = (filter) => query(() => {
    if (filter.userId) return queueEntries.filter((entry) => String(entry.userId) === String(filter.userId));
    if (filter.active && filter.restaurantId?.$in) {
      return queueEntries.filter((entry) => entry.active && filter.restaurantId.$in.includes(entry.restaurantId));
    }
    return [];
  });
  QueueEntry.findOne = (filter) => query(() => {
    const stored = queueEntries.find((entry) =>
      String(entry._id) === String(filter._id)
      && String(entry.userId) === String(filter.userId));
    if (!stored) return null;
    return {
      ...stored,
      async save() { Object.assign(stored, this); },
    };
  });
  t.after(() => {
    User.findById = originals.userFindById;
    Restaurant.findOne = originals.restaurantFindOne;
    Table.find = originals.tableFind;
    Reservation.find = originals.reservationFind;
    Reservation.findOne = originals.reservationFindOne;
    Reservation.create = originals.reservationCreate;
    QueueEntry.find = originals.queueFind;
    QueueEntry.findOne = originals.queueFindOne;
    QueueEntry.prototype.save = originals.queueSave;
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({}, env.JWT_SECRET, { subject: customerId, expiresIn: '5m' });
  const headers = { Cookie: `rtrqms_session=${token}`, 'Content-Type': 'application/json' };

  const availabilityResponse = await fetch(`${origin}/api/reservations/availability?restaurantId=${restaurantId}&date=${date}&time=17:00&guests=2`, { headers });
  assert.equal(availabilityResponse.status, 200);
  assert.equal((await availabilityResponse.json()).tables.length, 1);

  const reservationResponse = await fetch(`${origin}/api/reservations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ restaurantId, date, time: '17:00', guests: 2, note: '' }),
  });
  assert.equal(reservationResponse.status, 201);
  const { reservation } = await reservationResponse.json();
  assert.equal(reservation.restaurantId, restaurantId);
  assert.equal(reservation.restaurantName, restaurant.name);

  const mineResponse = await fetch(`${origin}/api/reservations/mine`, { headers });
  assert.equal((await mineResponse.json()).reservations.length, 1);

  const cancelResponse = await fetch(`${origin}/api/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(cancelResponse.status, 200);
  assert.equal(bookings[0].status, 'Cancelled');

  const joinResponse = await fetch(`${origin}/api/queue`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ restaurantId, guests: 2 }),
  });
  assert.equal(joinResponse.status, 201);
  const { entry } = await joinResponse.json();
  assert.equal(entry.entry.restaurantId, restaurantId);
  assert.equal(entry.position, 1);
  assert.equal(entry.estimatedWaitMinutes, 0);

  const queueMineResponse = await fetch(`${origin}/api/queue/mine`, { headers });
  assert.equal((await queueMineResponse.json()).entries.length, 1);

  const leaveResponse = await fetch(`${origin}/api/queue/${entry.entry._id}/leave`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(leaveResponse.status, 200);
  assert.equal(queueEntries[0].status, 'Left');
  assert.equal(queueEntries[0].active, false);
});

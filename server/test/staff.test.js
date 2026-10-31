import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { QueueEntry } from '../src/models/QueueEntry.js';
import { Reservation } from '../src/models/Reservation.js';
import { Restaurant } from '../src/models/Restaurant.js';
import { Table } from '../src/models/Table.js';
import { User } from '../src/models/User.js';
import { canAdvanceQueue } from '../src/utils/staff-workflows.js';

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

async function startServer(t) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('queue transition policy permits only the intended service progression', () => {
  assert.equal(canAdvanceQueue('Waiting', 'Called'), true);
  assert.equal(canAdvanceQueue('Waiting', 'Left'), true);
  assert.equal(canAdvanceQueue('Called', 'Seated'), true);
  assert.equal(canAdvanceQueue('Called', 'Left'), true);
  assert.equal(canAdvanceQueue('Waiting', 'Seated'), false);
  assert.equal(canAdvanceQueue('Seated', 'Called'), false);
  assert.equal(canAdvanceQueue('Left', 'Waiting'), false);
});

test('staff sign-in accepts an assigned admin and excludes that account from customer sign-in', async (t) => {
  const originalFindOne = User.findOne;
  const originalRestaurantFindOne = Restaurant.findOne;
  const email = 'admin+copper-cardamom@demo.maison.local';
  const password = 'local-demo-password';
  const admin = {
    id: '507f1f77bcf86cd799439011',
    name: 'Copper & Cardamom Admin',
    email,
    role: 'restaurant_admin',
    restaurantId: 'demo-copper-cardamom',
    passwordHash: await bcrypt.hash(password, 4),
  };
  User.findOne = (filter) => query(filter.role === 'restaurant_admin' || !filter.role ? admin : null);
  Restaurant.findOne = (filter) => query(filter._id === admin.restaurantId && filter.isActive ? { _id: admin.restaurantId } : null);
  t.after(() => {
    User.findOne = originalFindOne;
    Restaurant.findOne = originalRestaurantFindOne;
  });

  const origin = await startServer(t);
  const loginBody = JSON.stringify({ email, password });
  const staffResponse = await fetch(`${origin}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: loginBody,
  });
  assert.equal(staffResponse.status, 200);
  const { user } = await staffResponse.json();
  assert.equal(user.role, 'restaurant_admin');
  assert.equal(user.restaurantId, admin.restaurantId);
  assert.match(staffResponse.headers.get('set-cookie'), /HttpOnly/i);

  const customerResponse = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: loginBody,
  });
  assert.equal(customerResponse.status, 401);
});

test('staff API derives its restaurant scope from the authenticated admin', async (t) => {
  const originals = {
    userFindById: User.findById,
    restaurantFindOne: Restaurant.findOne,
    reservationFind: Reservation.find,
    reservationFindOne: Reservation.findOne,
    queueFind: QueueEntry.find,
    queueFindOneAndUpdate: QueueEntry.findOneAndUpdate,
    queueExists: QueueEntry.exists,
    tableFind: Table.find,
  };
  const ownerId = '507f1f77bcf86cd799439011';
  const ownerRestaurant = 'demo-copper-cardamom';
  const otherRestaurant = 'demo-ember-olive';
  let reservationLookup;
  let queueLookup;
  let queueUpdateFilter;
  const ownerQueueId = '507f1f77bcf86cd799439013';

  User.findById = () => query({ id: ownerId, name: 'Demo Admin', email: 'admin@example.test', role: 'restaurant_admin', restaurantId: ownerRestaurant });
  Restaurant.findOne = (filter) => query({ _id: filter._id });
  Reservation.find = (filter) => query([
    { _id: 'reservation-a', restaurantId: ownerRestaurant, tableId: 'table-a', date: '2030-05-12', time: '18:30', guests: 2, tableNumber: 1, status: 'Confirmed', userId: { name: 'Guest A', email: 'guest-a@example.test' } },
    { _id: 'reservation-b', restaurantId: otherRestaurant, tableId: 'table-b', date: '2030-05-12', time: '18:30', guests: 4, tableNumber: 7, status: 'Confirmed', userId: { name: 'Guest B', email: 'guest-b@example.test' } },
  ].filter((item) => item.restaurantId === filter.restaurantId));
  Reservation.findOne = (filter) => {
    reservationLookup = filter;
    return query(null);
  };
  QueueEntry.find = (filter) => query([
    { _id: 'queue-a', restaurantId: ownerRestaurant, status: 'Waiting', active: true, code: 'AAAA0001', guests: 2, joinedAt: new Date('2030-05-12T17:00:00Z'), userId: { name: 'Guest A', email: 'guest-a@example.test' } },
    { _id: 'queue-b', restaurantId: otherRestaurant, status: 'Waiting', active: true, code: 'BBBB0002', guests: 3, joinedAt: new Date('2030-05-12T17:01:00Z'), userId: { name: 'Guest B', email: 'guest-b@example.test' } },
  ].filter((item) => item.restaurantId === filter.restaurantId));
  const waitingEntry = {
    _id: ownerQueueId,
    restaurantId: ownerRestaurant,
    status: 'Waiting',
    active: true,
  };
  QueueEntry.findOneAndUpdate = (filter, update) => {
    queueLookup = filter;
    queueUpdateFilter = filter;
    if (filter._id !== ownerQueueId || filter.restaurantId !== ownerRestaurant
      || !filter.status.$in.includes(waitingEntry.status) || !waitingEntry.active) return query(null);
    Object.assign(waitingEntry, update.$set);
    return query(waitingEntry);
  };
  QueueEntry.exists = (filter) => query(filter._id === ownerQueueId && filter.restaurantId === ownerRestaurant ? { _id: ownerQueueId } : null);
  Table.find = (filter) => query([
    { _id: 'table-a', restaurantId: ownerRestaurant, number: 1, capacity: 2, active: true },
    { _id: 'table-b', restaurantId: otherRestaurant, number: 7, capacity: 4, active: true },
  ].filter((item) => item.restaurantId === filter.restaurantId));
  t.after(() => {
    User.findById = originals.userFindById;
    Restaurant.findOne = originals.restaurantFindOne;
    Reservation.find = originals.reservationFind;
    Reservation.findOne = originals.reservationFindOne;
    QueueEntry.find = originals.queueFind;
    QueueEntry.findOneAndUpdate = originals.queueFindOneAndUpdate;
    QueueEntry.exists = originals.queueExists;
    Table.find = originals.tableFind;
  });

  const origin = await startServer(t);
  const token = jwt.sign({}, env.JWT_SECRET, { subject: ownerId, expiresIn: '5m' });
  const headers = { Cookie: `rtrqms_session=${token}` };

  const customerRouteResponse = await fetch(`${origin}/api/reservations/mine`, { headers });
  assert.equal(customerRouteResponse.status, 403);

  const reservationsResponse = await fetch(`${origin}/api/staff/reservations?restaurantId=${otherRestaurant}`, { headers });
  assert.equal(reservationsResponse.status, 200);
  const { reservations } = await reservationsResponse.json();
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].restaurantId, ownerRestaurant);
  assert.equal(reservations[0].customer.email, 'guest-a@example.test');

  const queueResponse = await fetch(`${origin}/api/staff/queue?restaurantId=${otherRestaurant}`, { headers });
  assert.equal(queueResponse.status, 200);
  const { entries } = await queueResponse.json();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].restaurantId, ownerRestaurant);
  assert.equal(entries[0].position, 1);

  const tablesResponse = await fetch(`${origin}/api/staff/tables`, { headers });
  assert.equal(tablesResponse.status, 200);
  const { tables } = await tablesResponse.json();
  assert.deepEqual(tables.map(({ number }) => number), [1]);

  const availabilityResponse = await fetch(`${origin}/api/staff/tables?date=2030-05-12&time=18:30`, { headers });
  assert.equal(availabilityResponse.status, 200);
  const { tables: availability } = await availabilityResponse.json();
  assert.equal(availability[0].available, false);

  const crossRestaurantUpdate = await fetch(`${origin}/api/staff/reservations/507f1f77bcf86cd799439012/status`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Cancelled' }),
  });
  assert.equal(crossRestaurantUpdate.status, 404);
  assert.equal(reservationLookup.restaurantId, ownerRestaurant);

  const crossRestaurantQueueUpdate = await fetch(`${origin}/api/staff/queue/507f1f77bcf86cd799439014/status`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Called' }),
  });
  assert.equal(crossRestaurantQueueUpdate.status, 404);
  assert.equal(queueLookup.restaurantId, ownerRestaurant);

  const invalidQueueTransition = await fetch(`${origin}/api/staff/queue/${ownerQueueId}/status`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Seated' }),
  });
  assert.equal(invalidQueueTransition.status, 409);
  assert.equal(waitingEntry.status, 'Waiting');
  assert.deepEqual(queueUpdateFilter.status.$in, ['Called']);

  const callQueueEntry = await fetch(`${origin}/api/staff/queue/${ownerQueueId}/status`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Called' }),
  });
  assert.equal(callQueueEntry.status, 200);
  assert.equal(waitingEntry.status, 'Called');
  assert.equal(waitingEntry.active, true);

  const seatQueueEntry = await fetch(`${origin}/api/staff/queue/${ownerQueueId}/status`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Seated' }),
  });
  assert.equal(seatQueueEntry.status, 200);
  assert.equal(waitingEntry.status, 'Seated');
  assert.equal(waitingEntry.active, false);
  assert.ok(waitingEntry.completedAt instanceof Date);
});

test('customers cannot access staff endpoints even with a valid session', async (t) => {
  const originalFindById = User.findById;
  User.findById = () => query({ id: '507f1f77bcf86cd799439011', role: 'customer', restaurantId: null });
  t.after(() => { User.findById = originalFindById; });

  const origin = await startServer(t);
  const token = jwt.sign({}, env.JWT_SECRET, { subject: '507f1f77bcf86cd799439011', expiresIn: '5m' });
  const response = await fetch(`${origin}/api/staff/me`, {
    headers: { Cookie: `rtrqms_session=${token}` },
  });
  assert.equal(response.status, 403);
  assert.match((await response.json()).message, /administrator access/);
});

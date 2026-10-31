import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Restaurant } from '../src/models/Restaurant.js';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/rtrqms-test';
process.env.JWT_SECRET ??= 'test-only-secret-with-at-least-32-characters';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { app } = await import('../src/app.js');

test('health endpoint responds without a database connection', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('restaurant directory returns only the public restaurant fields', async (t) => {
  const originalFind = Restaurant.find;
  Restaurant.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [{
      _id: 'demo-copper-cardamom',
      name: 'Copper & Cardamom (Demo)',
      description: 'A fictional restaurant.',
      cuisine: 'Demo · Coastal Indian',
      area: 'Demo location · Bandra West',
      address: 'Fictional demo venue, Mumbai, India',
      coverImage: 'https://example.com/cover.jpg',
      isDemo: true,
    }],
  });
  t.after(() => { Restaurant.find = originalFind; });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/restaurants`);
  assert.equal(response.status, 200);
  const { restaurants } = await response.json();
  assert.equal(restaurants.length, 1);
  assert.equal(restaurants[0].id, 'demo-copper-cardamom');
  assert.equal('passwordHash' in restaurants[0], false);
});

test('protected module endpoints reject unauthenticated requests', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/api/auth/me', '/api/reservations/mine', '/api/queue/mine', '/api/staff/me', '/api/staff/tables']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 401, `${path} should require authentication`);
    assert.equal(typeof (await response.json()).message, 'string');
  }
});

test('unknown API routes return a JSON not-found response', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/not-a-module`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Not found.' });
});

test('malformed JSON is rejected with a client error', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'The request body must be valid JSON.' });
});

test('public registration rejects staff roles and restaurant assignments', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Not an Admin',
      email: 'not-admin@example.test',
      password: 'customer-password',
      role: 'restaurant_admin',
      restaurantId: 'demo-copper-cardamom',
    }),
  });
  assert.equal(response.status, 400);
});

test('oversized request bodies are rejected with a payload-too-large response', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: 'x'.repeat(21 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { message: 'The request is too large.' });
});

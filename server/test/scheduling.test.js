import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatedWaitMinutes, isValidDateTime, queuePosition, RESERVATION_TIMES } from '../src/utils/scheduling.js';

test('reservation times are restricted to the documented dining periods', () => {
  assert.deepEqual(RESERVATION_TIMES, ['17:00', '18:30', '20:00']);
  assert.equal(isValidDateTime('2030-05-12', '18:30', new Date('2030-05-01T12:00:00')), true);
  assert.equal(isValidDateTime('2030-05-12', '18:00', new Date('2030-05-01T12:00:00')), false);
});

test('reservation datetime rejects past and impossible calendar dates', () => {
  assert.equal(isValidDateTime('2030-05-12', '17:00', new Date('2030-05-12T17:00:00')), false);
  assert.equal(isValidDateTime('2030-02-30', '17:00', new Date('2030-01-01T00:00:00')), false);
});

test('queue position uses joined time and a stable id tie-breaker', () => {
  const at = new Date('2030-01-01T17:00:00Z');
  const entries = [
    { _id: 'b', joinedAt: at },
    { _id: 'c', joinedAt: new Date(at.getTime() + 1000) },
    { _id: 'a', joinedAt: at },
  ];
  assert.equal(queuePosition(entries, 'a'), 1);
  assert.equal(queuePosition(entries, 'b'), 2);
  assert.equal(queuePosition(entries, 'c'), 3);
  assert.equal(queuePosition(entries, 'missing'), null);
});

test('estimated wait is zero at the front and configurable per party ahead', () => {
  assert.equal(estimatedWaitMinutes(1, 12), 0);
  assert.equal(estimatedWaitMinutes(4, 12), 36);
});

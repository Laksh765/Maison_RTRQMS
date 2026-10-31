export const QUEUE_TRANSITIONS = {
  Waiting: ['Called', 'Left'],
  Called: ['Seated', 'Left'],
  Seated: [],
  Left: [],
};

export function canAdvanceQueue(currentStatus, nextStatus) {
  return QUEUE_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

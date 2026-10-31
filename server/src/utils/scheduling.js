export const RESERVATION_TIMES = ['17:00', '18:30', '20:00'];

export function isValidDateTime(date, time, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !RESERVATION_TIMES.includes(time)) return false;
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = date.split('-').map(Number);
  if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return false;
  return parsed.getTime() > now.getTime();
}

export function queuePosition(entries, entryId) {
  const ordered = [...entries].sort((left, right) =>
    left.joinedAt.getTime() - right.joinedAt.getTime() || String(left._id).localeCompare(String(right._id)));
  const index = ordered.findIndex((entry) => String(entry._id) === String(entryId));
  return index < 0 ? null : index + 1;
}

export function estimatedWaitMinutes(position, minutesPerParty) {
  return Math.max(0, (position - 1) * minutesPerParty);
}

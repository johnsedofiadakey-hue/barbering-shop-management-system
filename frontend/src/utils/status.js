// Human-readable client-facing labels for appointment statuses.
// Barber/admin views keep the raw operational status (they need the precise state);
// this is only for surfaces clients see.
export function getClientStatusLabel(status, date) {
  if (status === 'ONGOING') {
    if (date) {
      const today = new Date();
      const [year, month, day] = date.split('-').map(Number);
      if (year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate()) return 'Today';
    }
    return 'Upcoming';
  }
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'NO_SHOW') return 'No-show';
  return status;
}

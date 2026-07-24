export function formatTime(value) {
  if (!value) return '';
  const [hours = '0', minutes = '0'] = String(value).split(':');
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return new Intl.DateTimeFormat('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace('am', 'AM')
    .replace('pm', 'PM');
}

export function formatTimeRange(start, end) {
  if (!start) return '';
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function formatBookingDate(value, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return value ? new Intl.DateTimeFormat('en-GH', options).format(new Date(`${value}T12:00:00`)) : '';
}

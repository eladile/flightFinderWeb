export function parsePrice(raw: string): number {
  if (!raw) return Infinity;
  // Strip all non-digit characters except decimal point
  const cleaned = raw.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? Infinity : parsed;
}

export function parseDuration(raw: string): number {
  if (!raw) return 99999;
  let minutes = 0;

  // Match patterns like "2h 30m", "2h", "45m"
  const hourMatch = raw.match(/(\d+)h/);
  const minMatch = raw.match(/(\d+)m/);

  if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) minutes += parseInt(minMatch[1], 10);

  return minutes || 99999;
}

export function flightKey(flight: {
  source: string;
  destination: string;
  date: string;
  airline: string;
  departureTime: string;
  price: string;
}): string {
  return `${flight.source}:${flight.destination}:${flight.date}:${flight.airline}:${flight.departureTime}:${flight.price}`;
}

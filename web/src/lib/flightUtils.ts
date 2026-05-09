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
  arrivalTime: string;
  duration: string;
  stops: string;
  price: string;
  returnDate?: string;
  returnDeparture?: string;
  returnArrival?: string;
  link?: string;
  jobId?: string;
}): string {
  // Google Flights returns near-duplicate rows; include all visible fields
  // plus the link (unique per result) and jobId so we never collapse two
  // distinct rows onto one selection.
  return [
    flight.source,
    flight.destination,
    flight.date,
    flight.airline,
    flight.departureTime,
    flight.arrivalTime,
    flight.duration,
    flight.stops,
    flight.price,
    flight.returnDate ?? '',
    flight.returnDeparture ?? '',
    flight.returnArrival ?? '',
    flight.link ?? '',
    flight.jobId ?? '',
  ].join('|');
}

import type { Flight } from '../api/useSearchStream';

export function asMarkdown(flights: Flight[]): string {
  const rows = flights.map((f) => {
    const dates = f.returnDate ? `${f.date} ↔ ${f.returnDate}` : f.date;
    const times = `${f.departureTime} → ${f.arrivalTime}`;
    return `| ${f.destination} | ${f.airline} | ${dates} | ${times} | ${f.duration} | ${f.stops} | ${f.price} | [Link](${f.link}) |`;
  });

  return [
    '| Destination | Airline | Dates | Times | Duration | Stops | Price | Link |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

export function asPlainText(flights: Flight[]): string {
  return flights
    .map((f) => {
      const dates = f.returnDate ? `${f.date} ↔ ${f.returnDate}` : f.date;
      const times = `${f.departureTime} → ${f.arrivalTime}`;
      return `${f.destination} | ${f.airline} | ${dates} | ${times} | ${f.duration} | ${f.stops} | ${f.price}\n${f.link}`;
    })
    .join('\n\n');
}

export function asJson(flights: Flight[]): string {
  return JSON.stringify(flights, null, 2);
}

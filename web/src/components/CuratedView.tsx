import { useMemo } from 'react';
import type { StreamState } from '../api/useSearchStream';
import { parsePrice, parseDuration, flightKey } from '../lib/flightUtils';

type Props = {
  state: StreamState;
  selected?: Set<string>;
  onToggle?: (key: string) => void;
};

type FlightWithJobId = StreamState['flights'][0];

type DestinationGroup = {
  destination: string;
  flights: FlightWithJobId[];
  cheapest?: FlightWithJobId;
  fastest?: FlightWithJobId;
  googleLink?: string;
  skyscannerLink?: string;
};

function groupByDestination(flights: FlightWithJobId[]): DestinationGroup[] {
  const groups = new Map<string, DestinationGroup>();

  for (const flight of flights) {
    const dest = flight.destination;
    if (!groups.has(dest)) {
      groups.set(dest, { destination: dest, flights: [] });
    }
    groups.get(dest)!.flights.push(flight);
  }

  return Array.from(groups.values()).map((group) => {
    // Separate by source
    const googleFlights = group.flights.filter((f) => f.source === 'google');
    const skyscannerFlights = group.flights.filter((f) => f.source === 'skyscanner');

    // Prefer google for price/duration comparison
    const compareFlights = googleFlights.length > 0 ? googleFlights : group.flights;

    let cheapest: FlightWithJobId | undefined;
    let fastest: FlightWithJobId | undefined;
    let minPrice = Infinity;
    let minDuration = Infinity;

    for (const flight of compareFlights) {
      const price = parsePrice(flight.price);
      const duration = parseDuration(flight.duration);

      if (price < minPrice) {
        minPrice = price;
        cheapest = flight;
      }

      if (duration < minDuration) {
        minDuration = duration;
        fastest = flight;
      }
    }

    // Links
    const googleLink = googleFlights.find((f) => f.link)?.link;
    const skyscannerLink = skyscannerFlights.find((f) => f.link)?.link;

    return { ...group, cheapest, fastest, googleLink, skyscannerLink };
  });
}

function FlightCard({
  flight,
  badge,
  selected,
  onToggle,
}: {
  flight: FlightWithJobId;
  badge: string;
  selected?: Set<string>;
  onToggle?: (key: string) => void;
}) {
  const hasSelection = Boolean(selected && onToggle);
  const key = flightKey(flight);
  const isChecked = selected?.has(key) ?? false;

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      {hasSelection && (
        <div className="mb-2 flex items-center">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggle?.(key)}
            className="h-4 w-4"
          />
        </div>
      )}
      <div className="mb-1 text-xs font-semibold uppercase text-blue-600">{badge}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{flight.price}</span>
        <span className="text-sm text-gray-600">{flight.airline}</span>
      </div>
      <div className="mt-1 text-sm text-gray-700">
        {flight.date}
        {flight.returnDate && ` ↔ ${flight.returnDate}`}
      </div>
      <div className="mt-1 flex gap-3 text-xs text-gray-600">
        <span>{flight.duration}</span>
        <span>{flight.stops}</span>
      </div>
    </div>
  );
}

export default function CuratedView({ state, selected, onToggle }: Props) {
  // Collapse near-duplicate rows from Google Flights by booking link — same
  // link = same booking, no reason to show it twice.
  const dedupedFlights = useMemo(() => {
    const seen = new Set<string>();
    return state.flights.filter((f) => {
      if (!f.link) return true;
      if (seen.has(f.link)) return false;
      seen.add(f.link);
      return true;
    });
  }, [state.flights]);

  const groups = useMemo(() => groupByDestination(dedupedFlights), [dedupedFlights]);

  if (groups.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-semibold">Best Picks</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((group) => {
          const { destination, cheapest, fastest, googleLink, skyscannerLink } = group;
          const airlineCount = new Set(group.flights.map((f) => f.airline)).size;
          const flightCount = group.flights.length;

          // Check if same flight is both cheapest and fastest
          const isSameFlight =
            cheapest &&
            fastest &&
            cheapest.airline === fastest.airline &&
            cheapest.date === fastest.date &&
            cheapest.departureTime === fastest.departureTime;

          return (
            <div key={destination} className="rounded-lg border border-gray-300 bg-white p-4">
              <header className="mb-4 border-b border-gray-200 pb-3">
                <h3 className="text-3xl font-bold">{destination}</h3>
                <p className="text-sm text-gray-600">
                  {airlineCount} {airlineCount === 1 ? 'airline' : 'airlines'} · {flightCount}{' '}
                  {flightCount === 1 ? 'flight' : 'flights'}
                </p>
              </header>

              <div className="space-y-3">
                {isSameFlight && cheapest ? (
                  <FlightCard
                    flight={cheapest}
                    badge="Cheapest & Fastest"
                    selected={selected}
                    onToggle={onToggle}
                  />
                ) : (
                  <>
                    {cheapest && (
                      <FlightCard
                        flight={cheapest}
                        badge="Cheapest"
                        selected={selected}
                        onToggle={onToggle}
                      />
                    )}
                    {fastest && (
                      <FlightCard
                        flight={fastest}
                        badge="Fastest"
                        selected={selected}
                        onToggle={onToggle}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                {googleLink && (
                  <a
                    href={googleLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Google Flights
                  </a>
                )}
                {skyscannerLink && (
                  <a
                    href={skyscannerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded border border-purple-300 bg-purple-50 px-3 py-2 text-center text-sm font-medium text-purple-700 hover:bg-purple-100"
                  >
                    Skyscanner
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

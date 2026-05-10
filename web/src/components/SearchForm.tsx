import { useEffect, useState } from 'react';
import { fetchAirports } from '../api/client';
import { useUrlState } from '../hooks/useUrlState';
import type { Airport, Provider, SearchRequest, Stops, TripType } from '../types';
import AirportCombobox from './AirportCombobox';
import DateRangeInput from './DateRangeInput';
import PresetPicker from './PresetPicker';

type Props = {
  onSubmit?: (req: SearchRequest) => void;
  loading?: boolean;
  initial?: SearchRequest;
  disableUrlState?: boolean;
  onChange?: (req: SearchRequest | null) => void;
  hideSubmit?: boolean;
};

function stopsToValue(s: Stops): string {
  return typeof s === 'number' ? String(s) : s;
}

function valueToStops(v: string): Stops {
  if (v === 'any' || v === 'nonstop') return v;
  return parseInt(v, 10);
}

async function resolveCodes(codes: string[]): Promise<Airport[]> {
  const results = await Promise.all(
    codes.map(async (code) => {
      const hits = await fetchAirports(code, 1);
      return hits[0] && hits[0].iata.toUpperCase() === code.toUpperCase() ? hits[0] : null;
    }),
  );
  return results.filter((a): a is Airport => a !== null);
}

export default function SearchForm({
  onSubmit,
  loading,
  initial: initialProp,
  disableUrlState,
  onChange,
  hideSubmit,
}: Props) {
  const urlState = disableUrlState ? null : useUrlState();
  const initial = initialProp ?? urlState?.initial ?? null;

  const [origins, setOrigins] = useState<Airport[]>([]);
  const [destinations, setDestinations] = useState<Airport[]>([]);
  const [tripType, setTripType] = useState<TripType>(initial?.tripType ?? 'oneway');
  const [outboundFrom, setOutboundFrom] = useState(initial?.outboundDateFrom ?? '');
  const [outboundTo, setOutboundTo] = useState(initial?.outboundDateTo ?? '');
  const [returnFrom, setReturnFrom] = useState(initial?.returnDateFrom ?? '');
  const [returnTo, setReturnTo] = useState(initial?.returnDateTo ?? '');
  const [stops, setStops] = useState<Stops>(initial?.stops ?? 'any');
  const [providers, setProviders] = useState<Provider[]>(
    initial?.providers ?? ['google', 'skyscanner'],
  );
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!initial) return;
    resolveCodes(initial.origins).then(setOrigins).catch(() => {});
    resolveCodes(initial.destinations).then(setDestinations).catch(() => {});
  }, [initial]);

  useEffect(() => {
    const msg = validate();
    if (msg) {
      onChange?.(null);
      return;
    }
    const req: SearchRequest = {
      origins: origins.map((a) => a.iata),
      destinations: destinations.map((a) => a.iata),
      tripType,
      outboundDateFrom: outboundFrom,
      outboundDateTo: outboundTo,
      stops,
      providers,
      ...(tripType === 'roundtrip'
        ? { returnDateFrom: returnFrom, returnDateTo: returnTo }
        : {}),
    };
    onChange?.(req);
  }, [origins, destinations, tripType, outboundFrom, outboundTo, returnFrom, returnTo, stops, providers, onChange]);

  function toggleProvider(p: Provider) {
    setProviders((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function validate(): string {
    if (origins.length === 0) return 'Add at least one origin airport.';
    if (destinations.length === 0) return 'Add at least one destination airport.';
    if (!outboundFrom || !outboundTo) return 'Outbound date range is required.';
    if (outboundTo < outboundFrom) return 'Outbound end date must be on or after start.';
    if (tripType === 'roundtrip') {
      if (!returnFrom || !returnTo) return 'Return date range is required for round trips.';
      if (returnTo < returnFrom) return 'Return end date must be on or after start.';
    }
    if (providers.length === 0) return 'Select at least one provider.';
    return '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    const req: SearchRequest = {
      origins: origins.map((a) => a.iata),
      destinations: destinations.map((a) => a.iata),
      tripType,
      outboundDateFrom: outboundFrom,
      outboundDateTo: outboundTo,
      stops,
      providers,
      ...(tripType === 'roundtrip'
        ? { returnDateFrom: returnFrom, returnDateTo: returnTo }
        : {}),
    };
    if (!disableUrlState) {
      urlState?.push(req);
    }
    onSubmit?.(req);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Origins</h2>
        <AirportCombobox
          value={origins}
          onChange={setOrigins}
          placeholder="Type airport, city, or country…"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Destinations</h2>
        <PresetPicker onPick={setDestinations} />
        <AirportCombobox
          value={destinations}
          onChange={setDestinations}
          placeholder="Type airport, city, or country…"
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Trip Type</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tripType"
              value="oneway"
              checked={tripType === 'oneway'}
              onChange={() => setTripType('oneway')}
            />
            One way
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tripType"
              value="roundtrip"
              checked={tripType === 'roundtrip'}
              onChange={() => setTripType('roundtrip')}
            />
            Round trip
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Outbound dates</h2>
        <DateRangeInput
          fromLabel="From"
          toLabel="To"
          fromValue={outboundFrom}
          toValue={outboundTo}
          onChange={(f, t) => {
            setOutboundFrom(f);
            setOutboundTo(t);
          }}
        />
      </section>

      {tripType === 'roundtrip' && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Return dates</h2>
          <DateRangeInput
            fromLabel="From"
            toLabel="To"
            fromValue={returnFrom}
            toValue={returnTo}
            min={outboundFrom || undefined}
            onChange={(f, t) => {
              setReturnFrom(f);
              setReturnTo(t);
            }}
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Stops</h2>
        <select
          value={stopsToValue(stops)}
          onChange={(e) => setStops(valueToStops(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="any">Any</option>
          <option value="nonstop">Nonstop</option>
          <option value="1">Up to 1 stop</option>
          <option value="2">Up to 2 stops</option>
          <option value="3">Up to 3 stops</option>
        </select>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Providers</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={providers.includes('google')}
              onChange={() => toggleProvider('google')}
            />
            Google Flights
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={providers.includes('skyscanner')}
              onChange={() => toggleProvider('skyscanner')}
            />
            Skyscanner
          </label>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!hideSubmit && (
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      )}
    </form>
  );
}

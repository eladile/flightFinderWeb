import type { Airport } from '../types';

type RawAirport = {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  country_name: string;
  region: string;
  tz: string;
};

function toAirport(raw: RawAirport): Airport {
  return {
    iata: raw.iata,
    icao: raw.icao,
    name: raw.name,
    city: raw.city,
    country: raw.country,
    countryName: raw.country_name,
    region: raw.region,
    tz: raw.tz,
  };
}

export async function fetchAirports(query: string, limit = 10): Promise<Airport[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `/api/airports/search?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`airport search failed: ${res.status}`);
  const data = (await res.json()) as RawAirport[];
  return data.map(toAirport);
}

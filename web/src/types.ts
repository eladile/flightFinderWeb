export type Airport = {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  countryName: string;
  region: string;
  tz: string;
};

export type TripType = 'oneway' | 'roundtrip';

export type Stops = 'any' | 'nonstop' | number;

export type Provider = 'google' | 'skyscanner';

export type SearchRequest = {
  origins: string[];
  destinations: string[];
  tripType: TripType;
  outboundDateFrom: string;
  outboundDateTo: string;
  returnDateFrom?: string;
  returnDateTo?: string;
  stops: Stops;
  providers: Provider[];
};

export type Flight = {
  destination: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: string;
  date: string;
  stops: string;
  returnDeparture: string;
  returnArrival: string;
  link: string;
  source: string;
  layoverInfo: string;
  returnDate: string;
  priceType: string;
  returnAirline: string;
  returnDuration: string;
  returnStops: string;
};

export type ScheduleRun = {
  startedAt: string;
  finishedAt: string | null;
  status: 'success' | 'failed' | 'running';
  flightCount: number;
  error: string | null;
};

export type Schedule = {
  name: string;
  cronExpression: string;
  request: SearchRequest;
  recipients: string[];
  subject: string | null;
  enabled: boolean;
  createdAt: string;
  lastRun: ScheduleRun | null;
  runs: ScheduleRun[];
};

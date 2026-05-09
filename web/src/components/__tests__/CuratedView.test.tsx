import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CuratedView from '../CuratedView';
import type { StreamState } from '../../api/useSearchStream';

const baseState: StreamState = {
  phase: 'running',
  jobs: {},
  jobOrder: [],
  flights: [],
  totalJobs: 0,
  totalFlights: 0,
  failedJobs: 0,
};

describe('CuratedView', () => {
  it('renders nothing when no flights', () => {
    const { container } = render(<CuratedView state={baseState} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows cheapest flight for destination with 3 google flights at different prices', () => {
    const state: StreamState = {
      ...baseState,
      flights: [
        {
          destination: 'BER',
          airline: 'Lufthansa',
          departureTime: '10:00',
          arrivalTime: '12:00',
          duration: '2h',
          price: '$500',
          date: '2026-06-15',
          stops: 'nonstop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://google.com/flights',
          source: 'google',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job1',
        },
        {
          destination: 'BER',
          airline: 'Air France',
          departureTime: '14:00',
          arrivalTime: '16:00',
          duration: '2h',
          price: '$300',
          date: '2026-06-16',
          stops: '1 stop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://google.com/flights2',
          source: 'google',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job2',
        },
        {
          destination: 'BER',
          airline: 'KLM',
          departureTime: '08:00',
          arrivalTime: '10:00',
          duration: '2h',
          price: '$450',
          date: '2026-06-17',
          stops: 'nonstop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://google.com/flights3',
          source: 'google',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job3',
        },
      ],
    };

    render(<CuratedView state={state} />);

    expect(screen.getByText('BER')).toBeInTheDocument();
    expect(screen.getByText('Cheapest')).toBeInTheDocument();
    expect(screen.getByText('$300')).toBeInTheDocument();
    expect(screen.getByText('Air France')).toBeInTheDocument();
  });

  it('prioritizes google flights over skyscanner for price ranking', () => {
    const state: StreamState = {
      ...baseState,
      flights: [
        {
          destination: 'PAR',
          airline: 'Lufthansa',
          departureTime: '10:00',
          arrivalTime: '12:00',
          duration: '2h',
          price: '$400',
          date: '2026-06-15',
          stops: 'nonstop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://google.com/flights',
          source: 'google',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job1',
        },
        {
          destination: 'PAR',
          airline: 'Air France',
          departureTime: '14:00',
          arrivalTime: '16:00',
          duration: '2h',
          price: '',
          date: '2026-06-16',
          stops: '1 stop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://skyscanner.com/flights',
          source: 'skyscanner',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job2',
        },
      ],
    };

    render(<CuratedView state={state} />);

    expect(screen.getByText('PAR')).toBeInTheDocument();
    expect(screen.getByText('$400')).toBeInTheDocument();
    expect(screen.getByText('Lufthansa')).toBeInTheDocument();
    expect(screen.getByText('Google Flights')).toBeInTheDocument();
    expect(screen.getByText('Skyscanner')).toBeInTheDocument();
  });

  it('shows combined badge when same flight is cheapest and fastest', () => {
    const state: StreamState = {
      ...baseState,
      flights: [
        {
          destination: 'AMS',
          airline: 'KLM',
          departureTime: '10:00',
          arrivalTime: '11:30',
          duration: '1h 30m',
          price: '$200',
          date: '2026-06-15',
          stops: 'nonstop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://google.com/flights',
          source: 'google',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job1',
        },
        {
          destination: 'AMS',
          airline: 'Air France',
          departureTime: '14:00',
          arrivalTime: '17:00',
          duration: '3h',
          price: '$300',
          date: '2026-06-16',
          stops: '1 stop',
          returnDeparture: '',
          returnArrival: '',
          link: 'https://google.com/flights2',
          source: 'google',
          layoverInfo: '',
          returnDate: '',
          priceType: '',
          returnAirline: '',
          returnDuration: '',
          returnStops: '',
          jobId: 'job2',
        },
      ],
    };

    render(<CuratedView state={state} />);

    expect(screen.getByText('Cheapest & Fastest')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText('KLM')).toBeInTheDocument();
  });
});

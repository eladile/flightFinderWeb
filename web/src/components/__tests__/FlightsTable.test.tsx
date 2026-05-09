import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FlightsTable from '../FlightsTable';
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

describe('FlightsTable', () => {
  it('renders nothing when no flights', () => {
    const { container } = render(<FlightsTable state={baseState} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all flights as rows when expanded', () => {
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
          destination: 'PAR',
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
      ],
    };

    render(<FlightsTable state={state} />);

    const toggleButton = screen.getByText('▶ Show all 2 flights');
    fireEvent.click(toggleButton);

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(2); // Header + 2 data rows
    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.getByText('$300')).toBeInTheDocument();
  });

  it('starts collapsed and expands on click', () => {
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
      ],
    };

    render(<FlightsTable state={state} />);

    expect(screen.queryByText('$500')).not.toBeInTheDocument();

    const toggleButton = screen.getByText('▶ Show all 1 flights');
    fireEvent.click(toggleButton);

    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.getByText('▼ Hide all flights')).toBeInTheDocument();
  });

  it('filters rows with global search', () => {
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
          destination: 'PAR',
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
      ],
    };

    render(<FlightsTable state={state} />);

    const toggleButton = screen.getByText('▶ Show all 2 flights');
    fireEvent.click(toggleButton);

    const searchInput = screen.getByPlaceholderText('Search flights...');
    fireEvent.change(searchInput, { target: { value: 'Lufthansa' } });

    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.queryByText('$300')).not.toBeInTheDocument();
  });

  it('sorts by price ascending by default', () => {
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
          destination: 'PAR',
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
      ],
    };

    render(<FlightsTable state={state} />);

    const toggleButton = screen.getByText('▶ Show all 2 flights');
    fireEvent.click(toggleButton);

    const rows = screen.getAllByRole('row');
    // First row is header, second should be cheaper flight ($300)
    expect(rows[1]).toHaveTextContent('$300');
  });

  it('re-sorts by duration when clicking duration header', () => {
    const state: StreamState = {
      ...baseState,
      flights: [
        {
          destination: 'BER',
          airline: 'Lufthansa',
          departureTime: '10:00',
          arrivalTime: '12:00',
          duration: '3h',
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
          destination: 'PAR',
          airline: 'Air France',
          departureTime: '14:00',
          arrivalTime: '16:00',
          duration: '1h 30m',
          price: '$500',
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

    render(<FlightsTable state={state} />);

    const toggleButton = screen.getByText('▶ Show all 2 flights');
    fireEvent.click(toggleButton);

    const durationHeader = screen.getByText('Duration');
    fireEvent.click(durationHeader);

    const rows = screen.getAllByRole('row');
    // First data row should now be the shorter duration (1h 30m)
    expect(rows[1]).toHaveTextContent('1h 30m');
  });
});

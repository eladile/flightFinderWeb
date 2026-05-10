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

  it('does not render master checkbox when callbacks not provided', () => {
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

    const selected = new Set<string>();
    const onToggle = () => {};
    render(<FlightsTable state={state} selected={selected} onToggle={onToggle} />);

    const toggleButton = screen.getByText('▶ Show all 1 flights');
    fireEvent.click(toggleButton);

    // Header should have only one checkbox (the row checkbox), not a master checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(1); // Only the row checkbox
  });

  it('renders master checkbox when all callbacks provided', () => {
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

    const selected = new Set<string>();
    const onToggle = () => {};
    const onSetAll = () => {};
    const onRemoveMany = () => {};
    render(
      <FlightsTable
        state={state}
        selected={selected}
        onToggle={onToggle}
        onSetAll={onSetAll}
        onRemoveMany={onRemoveMany}
      />
    );

    const toggleButton = screen.getByText('▶ Show all 1 flights');
    fireEvent.click(toggleButton);

    // Should have master checkbox + row checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('master checkbox calls setAll when unchecked', () => {
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

    const selected = new Set<string>();
    const onToggle = () => {};
    let setAllKeys: string[] = [];
    const onSetAll = (keys: string[]) => {
      setAllKeys = keys;
    };
    const onRemoveMany = () => {};

    render(
      <FlightsTable
        state={state}
        selected={selected}
        onToggle={onToggle}
        onSetAll={onSetAll}
        onRemoveMany={onRemoveMany}
      />
    );

    const toggleButton = screen.getByText('▶ Show all 1 flights');
    fireEvent.click(toggleButton);

    const checkboxes = screen.getAllByRole('checkbox');
    const masterCheckbox = checkboxes[0]; // First checkbox is the master
    fireEvent.click(masterCheckbox);

    expect(setAllKeys.length).toBeGreaterThan(0);
  });

  it('master checkbox works with partial selection', () => {
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

    const key1 = 'google|BER|2026-06-15|Lufthansa|10:00|12:00|2h|nonstop|$500|||https://google.com/flights|job1';
    const selected = new Set<string>([key1]); // Only one selected
    const onToggle = () => {};
    const onSetAll = () => {};
    const onRemoveMany = () => {};

    render(
      <FlightsTable
        state={state}
        selected={selected}
        onToggle={onToggle}
        onSetAll={onSetAll}
        onRemoveMany={onRemoveMany}
      />
    );

    const toggleButton = screen.getByText('▶ Show all 2 flights');
    fireEvent.click(toggleButton);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3); // Master + 2 rows

    // Master checkbox should be indeterminate (not checked, not unchecked)
    const masterCheckbox = checkboxes[0];
    expect(masterCheckbox).toHaveProperty('indeterminate');
  });
});

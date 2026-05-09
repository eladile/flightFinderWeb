import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectionBar from './SelectionBar';
import type { Flight } from '../api/useSearchStream';

// Mock clipboard API
beforeAll(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  });
});

describe('SelectionBar', () => {
  const mockFlights: Flight[] = [
    {
      destination: 'BER',
      airline: 'LH',
      departureTime: '10:00',
      arrivalTime: '14:00',
      duration: '4hr 0min',
      price: '$200',
      date: '2026-06-01',
      stops: 'Nonstop',
      returnDeparture: '',
      returnArrival: '',
      link: 'https://example.com',
      source: 'google',
      layoverInfo: '',
      returnDate: '',
      priceType: '',
      returnAirline: '',
      returnDuration: '',
      returnStops: '',
    },
    {
      destination: 'CDG',
      airline: 'AF',
      departureTime: '12:00',
      arrivalTime: '16:00',
      duration: '4hr 0min',
      price: '$250',
      date: '2026-06-02',
      stops: '1 stop',
      returnDeparture: '',
      returnArrival: '',
      link: 'https://example.com',
      source: 'google',
      layoverInfo: '',
      returnDate: '',
      priceType: '',
      returnAirline: '',
      returnDuration: '',
      returnStops: '',
    },
  ];

  it('renders count and total price', () => {
    const onSend = vi.fn();
    const onClear = vi.fn();

    render(<SelectionBar selectedFlights={mockFlights} onSend={onSend} onClear={onClear} />);

    expect(screen.getByText('2 flights selected')).toBeInTheDocument();
    expect(screen.getByText(/Total: \$450/)).toBeInTheDocument();
  });

  it('calls onSend when Send button clicked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onClear = vi.fn();

    render(<SelectionBar selectedFlights={mockFlights} onSend={onSend} onClear={onClear} />);

    await user.click(screen.getByText('Send'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when Clear button clicked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onClear = vi.fn();

    render(<SelectionBar selectedFlights={mockFlights} onSend={onSend} onClear={onClear} />);

    await user.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('copies markdown when Copy > Markdown clicked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onClear = vi.fn();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    render(<SelectionBar selectedFlights={mockFlights} onSend={onSend} onClear={onClear} />);

    await user.click(screen.getByText(/Copy/));
    await user.click(screen.getByText('Markdown'));

    expect(writeTextSpy).toHaveBeenCalledWith(
      expect.stringContaining('| BER |')
    );
  });

  it('returns null when no flights selected', () => {
    const onSend = vi.fn();
    const onClear = vi.fn();

    const { container } = render(
      <SelectionBar selectedFlights={[]} onSend={onSend} onClear={onClear} />
    );

    expect(container.firstChild).toBeNull();
  });
});

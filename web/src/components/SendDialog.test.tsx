import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SendDialog from './SendDialog';
import type { Flight } from '../api/useSearchStream';

declare const global: typeof globalThis;

const mockFlight: Flight = {
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
};

describe('SendDialog', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders when open is true', () => {
    const onClose = vi.fn();
    const onSent = vi.fn();

    render(
      <SendDialog
        open={true}
        selectedFlights={[mockFlight]}
        defaultRecipient="test@example.com"
        onClose={onClose}
        onSent={onSent}
      />
    );

    expect(screen.getByText('Send Flights')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toHaveValue('test@example.com');
  });

  it('does not render when open is false', () => {
    const onClose = vi.fn();
    const onSent = vi.fn();

    const { container } = render(
      <SendDialog
        open={false}
        selectedFlights={[mockFlight]}
        onClose={onClose}
        onSent={onSent}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('updates subject when edited', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();

    render(
      <SendDialog
        open={true}
        selectedFlights={[mockFlight]}
        onClose={onClose}
        onSent={onSent}
      />
    );

    const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
    await user.clear(subjectInput);
    await user.type(subjectInput, 'New Subject');

    expect(subjectInput.value).toBe('New Subject');
  });

  it('sends email when Send button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();

    // Mock fetch to handle both preview and send calls
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ html: '<p>preview</p>' }),
        });
      }
      // Send endpoint
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, count: 1 }),
      });
    });

    global.fetch = fetchMock as any;

    render(
      <SendDialog
        open={true}
        selectedFlights={[mockFlight]}
        defaultRecipient="test@example.com"
        onClose={onClose}
        onSent={onSent}
      />
    );

    // Wait for the "to" field to be populated
    await waitFor(() => {
      expect(screen.getByLabelText('To')).toHaveValue('test@example.com');
    });

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    // Wait for both callbacks
    await waitFor(() => {
      expect(onSent).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('calls onClose when Cancel button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();

    render(
      <SendDialog
        open={true}
        selectedFlights={[mockFlight]}
        onClose={onClose}
        onSent={onSent}
      />
    );

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays error on send failure', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();

    let sendCalled = false;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/preview')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ html: '<p>preview</p>' }),
        });
      }
      // Send endpoint - fail
      sendCalled = true;
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'SMTP error' }),
      });
    });

    global.fetch = fetchMock as any;

    render(
      <SendDialog
        open={true}
        selectedFlights={[mockFlight]}
        defaultRecipient="test@example.com"
        onClose={onClose}
        onSent={onSent}
      />
    );

    // Wait for the "to" field to be populated
    await waitFor(() => {
      expect(screen.getByLabelText('To')).toHaveValue('test@example.com');
    });

    const sendButton = screen.getByText('Send');
    await user.click(sendButton);

    await waitFor(() => {
      expect(sendCalled).toBe(true);
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText(/SMTP error/)).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(onSent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

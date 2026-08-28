import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchForm from './SearchForm';
import * as client from '../api/client';
import type { Airport, SearchRequest } from '../types';

vi.mock('../api/client');

const TLV: Airport = {
  iata: 'TLV', icao: 'LLBG', name: 'Ben Gurion', city: 'Tel Aviv',
  country: 'IL', countryName: 'Israel', region: 'Middle East', tz: 'Asia/Jerusalem',
};
const BER: Airport = {
  iata: 'BER', icao: 'EDDB', name: 'Berlin Brandenburg', city: 'Berlin',
  country: 'DE', countryName: 'Germany', region: 'Europe', tz: 'Europe/Berlin',
};

// Dates must be relative to today: the form rejects past dates, so hardcoded
// calendar dates would silently start failing once they age out.
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Pick TLV as origin and BER as destination via the two comboboxes. */
async function selectAirports(user: ReturnType<typeof userEvent.setup>) {
  const comboboxes = screen.getAllByRole('combobox');
  await user.type(comboboxes[0], 'TLV');
  await waitFor(() => expect(screen.getAllByText('TLV').length).toBeGreaterThan(0));
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByTestId('chip-TLV')).toBeInTheDocument());

  await user.type(comboboxes[1], 'BER');
  await waitFor(() => expect(screen.getAllByText('BER').length).toBeGreaterThan(0));
  comboboxes[1].focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByTestId('chip-BER')).toBeInTheDocument());
}

async function typeOutboundRange(
  user: ReturnType<typeof userEvent.setup>,
  from: string,
  to: string,
) {
  await user.type(screen.getAllByLabelText('From')[0] as HTMLInputElement, from);
  await user.type(screen.getAllByLabelText('To')[0] as HTMLInputElement, to);
}

describe('SearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    vi.mocked(client.fetchAirports).mockImplementation(async (q) => {
      if (q.toUpperCase() === 'TLV') return [TLV];
      if (q.toUpperCase() === 'BER') return [BER];
      return [];
    });
  });

  it('submits a valid SearchRequest for oneway/any', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchForm onSubmit={onSubmit} />);

    await selectAirports(user);
    const from = isoDaysFromToday(30);
    const to = isoDaysFromToday(40);
    await typeOutboundRange(user, from, to);

    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const req = onSubmit.mock.calls[0][0] as SearchRequest;
    expect(req).toEqual({
      origins: ['TLV'],
      destinations: ['BER'],
      tripType: 'oneway',
      outboundDateFrom: from,
      outboundDateTo: to,
      stops: 'any',
      providers: ['google', 'skyscanner'],
    });
  });

  it('blocks submission when outbound dates are in the past', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchForm onSubmit={onSubmit} />);

    await selectAirports(user);
    await typeOutboundRange(user, isoDaysFromToday(-10), isoDaysFromToday(-5));

    // The min attribute makes the inputs fail native constraint validation, so
    // the browser blocks the submit event before handleSubmit ever runs.
    expect((screen.getAllByLabelText('From')[0] as HTMLInputElement).checkValidity()).toBe(false);

    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('constrains the date pickers to today or later', async () => {
    render(<SearchForm onSubmit={vi.fn()} />);

    const today = isoDaysFromToday(0);
    expect(screen.getAllByLabelText('From')[0]).toHaveAttribute('min', today);
    expect(screen.getAllByLabelText('To')[0]).toHaveAttribute('min', today);
  });

  it('floors the return date pickers at today, not at a past outbound date', async () => {
    const user = userEvent.setup();
    render(<SearchForm onSubmit={vi.fn()} />);

    await user.click(screen.getByLabelText('Round trip'));
    await typeOutboundRange(user, isoDaysFromToday(-10), isoDaysFromToday(-5));

    const today = isoDaysFromToday(0);
    expect(screen.getAllByLabelText('From')[1]).toHaveAttribute('min', today);
    expect(screen.getAllByLabelText('To')[1]).toHaveAttribute('min', today);
  });

  it('does not emit a request to onChange when dates are in the past', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchForm onChange={onChange} hideSubmit />);

    await selectAirports(user);
    await typeOutboundRange(user, isoDaysFromToday(-10), isoDaysFromToday(-5));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

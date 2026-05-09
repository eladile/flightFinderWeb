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

describe('SearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('submits a valid SearchRequest for oneway/any', async () => {
    vi.mocked(client.fetchAirports).mockImplementation(async (q) => {
      if (q.toUpperCase() === 'TLV') return [TLV];
      if (q.toUpperCase() === 'BER') return [BER];
      return [];
    });
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SearchForm onSubmit={onSubmit} />);

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

    const fromInput = screen.getAllByLabelText('From')[0] as HTMLInputElement;
    const toInput = screen.getAllByLabelText('To')[0] as HTMLInputElement;
    await user.type(fromInput, '2026-06-10');
    await user.type(toInput, '2026-06-20');

    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const req = onSubmit.mock.calls[0][0] as SearchRequest;
    expect(req).toEqual({
      origins: ['TLV'],
      destinations: ['BER'],
      tripType: 'oneway',
      outboundDateFrom: '2026-06-10',
      outboundDateTo: '2026-06-20',
      stops: 'any',
      providers: ['google', 'skyscanner'],
    });
  });
});

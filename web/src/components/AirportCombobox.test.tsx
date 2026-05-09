import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AirportCombobox from './AirportCombobox';
import type { Airport } from '../types';
import * as client from '../api/client';

vi.mock('../api/client');

const BER: Airport = {
  iata: 'BER', icao: 'EDDB', name: 'Berlin Brandenburg', city: 'Berlin',
  country: 'DE', countryName: 'Germany', region: 'Europe', tz: 'Europe/Berlin',
};
const CDG: Airport = {
  iata: 'CDG', icao: 'LFPG', name: 'Charles de Gaulle', city: 'Paris',
  country: 'FR', countryName: 'France', region: 'Europe', tz: 'Europe/Paris',
};

function Harness({ initial = [] as Airport[] }: { initial?: Airport[] }) {
  const [value, setValue] = useState<Airport[]>(initial);
  return <AirportCombobox value={value} onChange={setValue} placeholder="Search…" />;
}

describe('AirportCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows dropdown results after typing', async () => {
    vi.mocked(client.fetchAirports).mockResolvedValue([BER]);
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('combobox'), 'ber');
    await waitFor(() => expect(client.fetchAirports).toHaveBeenCalled());
    expect(await screen.findByText('BER')).toBeInTheDocument();
    expect(screen.getAllByText(/Berlin/).length).toBeGreaterThan(0);
  });

  it('Enter adds the highlighted result as a chip', async () => {
    vi.mocked(client.fetchAirports).mockResolvedValue([BER]);
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'ber');
    await screen.findByText('BER');
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('chip-BER')).toBeInTheDocument();
  });

  it('Backspace on empty input removes last chip', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[BER]} />);
    expect(screen.getByTestId('chip-BER')).toBeInTheDocument();
    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('{Backspace}');
    await waitFor(() => expect(screen.queryByTestId('chip-BER')).not.toBeInTheDocument());
  });

  it('paste splits on comma and resolves each code', async () => {
    vi.mocked(client.fetchAirports).mockImplementation(async (q) => {
      if (q === 'BER') return [BER];
      if (q === 'CDG') return [CDG];
      return [];
    });
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    input.focus();
    await user.paste('BER, CDG');
    expect(await screen.findByTestId('chip-BER')).toBeInTheDocument();
    expect(await screen.findByTestId('chip-CDG')).toBeInTheDocument();
  });
});

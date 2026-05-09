import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PresetPicker from './PresetPicker';
import * as client from '../api/client';
import { PRESETS } from '../presets';
import type { Airport } from '../types';

vi.mock('../api/client');

function fakeAirport(code: string): Airport {
  return {
    iata: code, icao: `X${code}`, name: `${code} Airport`, city: code,
    country: 'XX', countryName: 'Testland', region: 'Europe', tz: 'UTC',
  };
}

describe('PresetPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking a preset resolves all codes and calls onPick', async () => {
    vi.mocked(client.fetchAirports).mockImplementation(async (q) => [fakeAirport(q.toUpperCase())]);
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<PresetPicker onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /^Europe$/ }));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const codes = PRESETS.Europe;
    expect(client.fetchAirports).toHaveBeenCalledTimes(codes.length);
    const picked = onPick.mock.calls[0][0] as Airport[];
    expect(picked.map((a) => a.iata)).toEqual(codes);
  });
});

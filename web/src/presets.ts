export const PRESETS: Record<string, string[]> = {
  Europe: [
    'AMS', 'ATH', 'BCN', 'BER', 'BRU', 'BUD', 'CDG', 'CPH',
    'FCO', 'LHR', 'LIS', 'MAD', 'MIL', 'MUC', 'OSL', 'PRG',
    'SOF', 'VIE', 'WAW', 'ZRH',
  ],
  'Major European hubs': [
    'LHR', 'CDG', 'AMS', 'FRA', 'MAD', 'BCN', 'FCO', 'MUC',
    'IST', 'ZRH', 'VIE', 'CPH', 'ARN', 'DUB', 'LIS', 'ATH',
    'WAW', 'PRG',
  ],
  'Major Asian hubs': [
    'NRT', 'HND', 'ICN', 'HKG', 'SIN', 'BKK', 'KUL', 'TPE',
    'DEL', 'BOM', 'DXB', 'DOH',
  ],
  'Americas hubs': [
    'JFK', 'LAX', 'ORD', 'SFO', 'MIA', 'YYZ', 'GRU', 'EZE', 'MEX',
  ],
};

export function getPresetAirports(name: string): string[] {
  return PRESETS[name] ?? [];
}

import { useState } from 'react';
import { fetchAirports } from '../api/client';
import { PRESETS } from '../presets';
import type { Airport } from '../types';

type Props = {
  onPick: (airports: Airport[]) => void;
};

export default function PresetPicker({ onPick }: Props) {
  const [loadingName, setLoadingName] = useState<string | null>(null);

  async function handlePick(name: string) {
    const codes = PRESETS[name] ?? [];
    setLoadingName(name);
    try {
      const results = await Promise.all(
        codes.map(async (code) => {
          const hits = await fetchAirports(code, 1);
          return hits[0] && hits[0].iata.toUpperCase() === code.toUpperCase() ? hits[0] : null;
        }),
      );
      const resolved = results.filter((a): a is Airport => a !== null);
      onPick(resolved);
    } finally {
      setLoadingName(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(PRESETS).map((name) => {
        const isLoading = loadingName === name;
        return (
          <button
            key={name}
            type="button"
            disabled={loadingName !== null}
            onClick={() => handlePick(name)}
            className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {isLoading && (
              <span
                role="status"
                aria-label="loading"
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
              />
            )}
            {name}
          </button>
        );
      })}
    </div>
  );
}

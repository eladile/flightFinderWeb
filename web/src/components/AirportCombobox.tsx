import { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { fetchAirports } from '../api/client';
import type { Airport } from '../types';

// Regional-indicator trick: ISO-2 "DE" → 🇩🇪. Base codepoint is 0x1F1E6 ('A').
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
}

type Props = {
  value: Airport[];
  onChange: (airports: Airport[]) => void;
  placeholder?: string;
};

export default function AirportCombobox({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetchAirports(debounced, 10)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const selectedCodes = useMemo(() => new Set(value.map((a) => a.iata)), [value]);

  function addAirport(airport: Airport) {
    if (selectedCodes.has(airport.iata)) return;
    onChange([...value, airport]);
    setQuery('');
    setResults([]);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text.includes(',')) return;
    e.preventDefault();
    const codes = text
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const resolved: Airport[] = [];
    for (const code of codes) {
      try {
        const hits = await fetchAirports(code, 1);
        if (hits[0] && hits[0].iata.toUpperCase() === code.toUpperCase()) {
          resolved.push(hits[0]);
        }
      } catch {
        /* ignore */
      }
    }
    const existing = new Set(value.map((a) => a.iata));
    const toAdd = resolved.filter((a) => !existing.has(a.iata));
    if (toAdd.length) onChange([...value, ...toAdd]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && query === '' && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Command shouldFilter={false} className="w-full">
        <div
          className="flex flex-wrap items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 focus-within:border-blue-500"
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((a, i) => (
            <span
              key={a.iata}
              className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-sm text-blue-900"
              data-testid={`chip-${a.iata}`}
            >
              <span aria-hidden>{countryCodeToFlag(a.country)}</span>
              <span className="font-medium">{a.iata}</span>
              <span className="text-blue-700">· {a.city}</span>
              <button
                type="button"
                className="ml-1 text-blue-700 hover:text-blue-900"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                aria-label={`Remove ${a.iata}`}
              >
                ×
              </button>
            </span>
          ))}
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onPaste={handlePaste}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] border-none bg-transparent py-1 outline-none"
            aria-label="Airport search"
          />
        </div>
        {open && (query.trim() !== '' || loading) && (
          <Command.List className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded border border-gray-300 bg-white shadow">
            {loading && <Command.Loading className="p-2 text-sm text-gray-500">Loading…</Command.Loading>}
            {!loading && results.length === 0 && (
              <Command.Empty className="p-2 text-sm text-gray-500">No airports found</Command.Empty>
            )}
            {results.map((a) => (
              <Command.Item
                key={a.iata}
                value={a.iata}
                onSelect={() => addAirport(a)}
                className="cursor-pointer px-3 py-2 text-sm data-[selected=true]:bg-blue-50"
              >
                <span aria-hidden className="mr-2">{countryCodeToFlag(a.country)}</span>
                <span className="font-medium">{a.iata}</span>
                <span className="text-gray-600"> · {a.city}</span>
                <span className="ml-2 text-xs text-gray-500">{a.name}</span>
              </Command.Item>
            ))}
          </Command.List>
        )}
      </Command>
    </div>
  );
}

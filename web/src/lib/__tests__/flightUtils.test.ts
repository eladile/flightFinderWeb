import { describe, it, expect } from 'vitest';
import { parsePrice, parseDuration, flightKey } from '../flightUtils';

describe('parsePrice', () => {
  it('parses dollar amount', () => {
    expect(parsePrice('$450')).toBe(450);
  });

  it('parses plain number', () => {
    expect(parsePrice('450')).toBe(450);
  });

  it('parses euro with thousands separator', () => {
    expect(parsePrice('€1,200')).toBe(1200);
  });

  it('returns Infinity for empty string', () => {
    expect(parsePrice('')).toBe(Infinity);
  });

  it('returns Infinity for non-numeric strings', () => {
    expect(parsePrice('N/A')).toBe(Infinity);
  });

  it('handles decimal prices', () => {
    expect(parsePrice('$1,234.56')).toBe(1234.56);
  });
});

describe('parseDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseDuration('2h 30m')).toBe(150);
  });

  it('parses only minutes', () => {
    expect(parseDuration('45m')).toBe(45);
  });

  it('parses only hours', () => {
    expect(parseDuration('3h')).toBe(180);
  });

  it('returns 99999 for empty string', () => {
    expect(parseDuration('')).toBe(99999);
  });

  it('returns 99999 for non-duration strings', () => {
    expect(parseDuration('N/A')).toBe(99999);
  });

  it('handles edge cases', () => {
    expect(parseDuration('0h 30m')).toBe(30);
    expect(parseDuration('1h 0m')).toBe(60);
  });
});

describe('flightKey', () => {
  const flight = {
    source: 'google',
    destination: 'BER',
    date: '2026-06-15',
    airline: 'Lufthansa',
    departureTime: '10:30',
    arrivalTime: '13:45',
    duration: '3h 15m',
    stops: 'Nonstop',
    price: '$450',
    link: 'https://example.com/x',
    jobId: 'j1',
  };

  it('generates stable key for identical input', () => {
    const key1 = flightKey(flight);
    const key2 = flightKey(flight);
    expect(key1).toBe(key2);
  });

  it('generates different keys for different inputs', () => {
    const key1 = flightKey(flight);
    const key2 = flightKey({ ...flight, price: '$500' });
    expect(key1).not.toBe(key2);
  });

  it('distinguishes rows that differ only in arrival time (anti-collision)', () => {
    const a = flightKey(flight);
    const b = flightKey({ ...flight, arrivalTime: '14:00' });
    expect(a).not.toBe(b);
  });

  it('distinguishes rows that differ only in link', () => {
    const a = flightKey(flight);
    const b = flightKey({ ...flight, link: 'https://example.com/y' });
    expect(a).not.toBe(b);
  });

  it('includes all fields in the key', () => {
    const key = flightKey(flight);
    expect(key).toContain('google');
    expect(key).toContain('BER');
    expect(key).toContain('2026-06-15');
    expect(key).toContain('Lufthansa');
    expect(key).toContain('10:30');
    expect(key).toContain('$450');
  });
});

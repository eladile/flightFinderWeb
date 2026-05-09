import { describe, it, expect } from 'vitest';
import { encodeSearchRequest, decodeSearchRequest } from './useUrlState';
import type { SearchRequest } from '../types';

describe('useUrlState encode/decode', () => {
  it('roundtrips a SearchRequest through base64', () => {
    const req: SearchRequest = {
      origins: ['TLV'],
      destinations: ['BER', 'CDG', 'MUC'],
      tripType: 'roundtrip',
      outboundDateFrom: '2026-06-10',
      outboundDateTo: '2026-06-15',
      returnDateFrom: '2026-06-20',
      returnDateTo: '2026-06-25',
      stops: 1,
      providers: ['google', 'skyscanner'],
    };
    const encoded = encodeSearchRequest(req);
    expect(encoded).not.toContain(' ');
    expect(decodeSearchRequest(encoded)).toEqual(req);
  });

  it('returns null on invalid base64 payload', () => {
    expect(decodeSearchRequest('not-valid-base64!!!')).toBeNull();
  });

  it('roundtrips unicode city names', () => {
    const req: SearchRequest = {
      origins: ['TLV'],
      destinations: ['ZRH'],
      tripType: 'oneway',
      outboundDateFrom: '2026-06-10',
      outboundDateTo: '2026-06-15',
      stops: 'any',
      providers: ['google'],
    };
    expect(decodeSearchRequest(encodeSearchRequest(req))).toEqual(req);
  });
});

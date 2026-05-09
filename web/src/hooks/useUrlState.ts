import { useEffect, useState } from 'react';
import type { SearchRequest } from '../types';

// btoa/atob only speak latin1 — the encode/unescape dance survives multi-byte
// chars like é in city names without pulling in a Node-only Buffer polyfill.
function toBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeSearchRequest(req: SearchRequest): string {
  return toBase64(JSON.stringify(req));
}

export function decodeSearchRequest(b64: string): SearchRequest | null {
  try {
    return JSON.parse(fromBase64(b64)) as SearchRequest;
  } catch {
    return null;
  }
}

export function useUrlState(): {
  initial: SearchRequest | null;
  push: (req: SearchRequest) => void;
} {
  const [initial] = useState<SearchRequest | null>(() => {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('q');
    return q ? decodeSearchRequest(q) : null;
  });

  useEffect(() => {
    // nothing to subscribe to for now; kept for future popstate handling
  }, []);

  function push(req: SearchRequest) {
    const b64 = encodeSearchRequest(req);
    const url = new URL(window.location.href);
    url.searchParams.set('q', b64);
    window.history.pushState({}, '', url.toString());
  }

  return { initial, push };
}

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchStream } from '../useSearchStream';

type Listener = (evt: { data: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  readyState = 1;
  onerror: ((e: unknown) => void) | null = null;
  private listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, fn: Listener) {
    const arr = this.listeners.get(name) ?? [];
    arr.push(fn);
    this.listeners.set(name, arr);
  }

  emit(name: string, payload: unknown) {
    const arr = this.listeners.get(name) ?? [];
    const data = JSON.stringify(payload);
    for (const fn of arr) fn({ data });
  }

  close() {
    this.readyState = 2;
  }
}

const sampleRequest = {
  origins: ['SFO'],
  destinations: ['JFK'],
  tripType: 'oneway' as const,
  outboundDateFrom: '2026-06-01',
  outboundDateTo: '2026-06-03',
  stops: 'any' as const,
  providers: ['google'],
};

const jobA = {
  id: 'j1',
  origin: 'SFO',
  destination: 'JFK',
  outboundDate: '2026-06-01',
  returnDate: null,
  stops: 'any' as const,
  providers: ['google'],
};

const jobB = {
  id: 'j2',
  origin: 'SFO',
  destination: 'BOS',
  outboundDate: '2026-06-01',
  returnDate: null,
  stops: 'any' as const,
  providers: ['google'],
};

const sampleFlight = {
  destination: 'JFK',
  airline: 'UA',
  departureTime: '08:00',
  arrivalTime: '16:00',
  duration: '8h',
  price: '$300',
  date: '2026-06-01',
  stops: 'Nonstop',
  returnDeparture: '',
  returnArrival: '',
  link: '',
  source: 'google',
  layoverInfo: '',
  returnDate: '',
  priceType: '',
  returnAirline: '',
  returnDuration: '',
  returnStops: '',
};

describe('useSearchStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })));
  });

  it('start() creates EventSource with base64 query param', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    expect(FakeEventSource.instances).toHaveLength(1);
    const url = FakeEventSource.instances[0].url;
    expect(url.startsWith('/api/search?q=')).toBe(true);
    const encoded = decodeURIComponent(url.slice('/api/search?q='.length));
    const decoded = JSON.parse(atob(encoded));
    expect(decoded).toEqual(sampleRequest);
  });

  it('PLAN populates jobs as pending', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('plan', { type: 'plan', totalJobs: 2, jobs: [jobA, jobB] }));
    expect(result.current.state.totalJobs).toBe(2);
    expect(result.current.state.jobOrder).toEqual(['j1', 'j2']);
    expect(result.current.state.jobs.j1.status).toBe('pending');
    expect(result.current.state.jobs.j2.status).toBe('pending');
    expect(result.current.state.phase).toBe('running');
  });

  it('JOB_STARTED flips to running', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => es.emit('job_started', { jobId: 'j1' }));
    expect(result.current.state.jobs.j1.status).toBe('running');
  });

  it('FLIGHT appends flight with jobId', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => es.emit('flight', { jobId: 'j1', flight: sampleFlight }));
    expect(result.current.state.flights).toHaveLength(1);
    expect(result.current.state.flights[0].jobId).toBe('j1');
    expect(result.current.state.flights[0].airline).toBe('UA');
  });

  it('JOB_COMPLETED sets flightCount and flips status', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => es.emit('job_completed', { jobId: 'j1', flightCount: 3 }));
    expect(result.current.state.jobs.j1.status).toBe('completed');
    expect(result.current.state.jobs.j1.flightCount).toBe(3);
  });

  it('JOB_FAILED sets error', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => es.emit('job_failed', { jobId: 'j1', error: 'timed out' }));
    expect(result.current.state.jobs.j1.status).toBe('failed');
    expect(result.current.state.jobs.j1.error).toBe('timed out');
  });

  it('DONE moves phase to done', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => es.emit('done', { totalFlights: 5, failedJobs: 0 }));
    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.totalFlights).toBe(5);
  });

  it('cancel() closes EventSource and DELETEs search', () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.emit('search_id', { searchId: 'abc123' }));
    act(() => es.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => result.current.cancel());
    expect(es.readyState).toBe(2);
    expect(result.current.state.phase).toBe('cancelled');
    expect(fetchMock).toHaveBeenCalledWith('/api/search/abc123', { method: 'DELETE' });
  });

  it('start() twice resets state', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es1 = FakeEventSource.instances[0];
    act(() => es1.emit('plan', { totalJobs: 1, jobs: [jobA] }));
    act(() => es1.emit('flight', { jobId: 'j1', flight: sampleFlight }));
    expect(result.current.state.flights).toHaveLength(1);
    act(() => result.current.start(sampleRequest));
    expect(result.current.state.flights).toHaveLength(0);
    expect(result.current.state.jobOrder).toEqual([]);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(es1.readyState).toBe(2);
  });

  it('onerror transitions to error unless done', () => {
    const { result } = renderHook(() => useSearchStream());
    act(() => result.current.start(sampleRequest));
    const es = FakeEventSource.instances[0];
    act(() => es.onerror?.({}));
    expect(result.current.state.phase).toBe('error');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProgressPanel from '../ProgressPanel';
import type { StreamState } from '../../api/useSearchStream';

function buildState(overrides: Partial<StreamState> = {}): StreamState {
  const job = {
    id: 'j1',
    origin: 'SFO',
    destination: 'JFK',
    outboundDate: '2026-06-01',
    returnDate: null,
    stops: 'any' as const,
    providers: ['google'],
  };
  const job2 = {
    id: 'j2',
    origin: 'SFO',
    destination: 'BOS',
    outboundDate: '2026-06-01',
    returnDate: null,
    stops: 'any' as const,
    providers: ['google'],
  };
  return {
    phase: 'running',
    jobs: {
      j1: { job, status: 'running' },
      j2: { job: job2, status: 'pending' },
    },
    jobOrder: ['j1', 'j2'],
    flights: [],
    totalJobs: 2,
    totalFlights: 0,
    failedJobs: 0,
    ...overrides,
  };
}

describe('ProgressPanel', () => {
  it('renders a row per job', () => {
    render(<ProgressPanel state={buildState()} />);
    expect(screen.getByText(/SFO → JFK/)).toBeInTheDocument();
    expect(screen.getByText(/SFO → BOS/)).toBeInTheDocument();
  });

  it('shows progress bar percent based on completed/total', () => {
    const state = buildState({
      jobs: {
        j1: { job: buildState().jobs.j1.job, status: 'completed', flightCount: 2 },
        j2: { job: buildState().jobs.j2.job, status: 'pending' },
      },
    });
    render(<ProgressPanel state={state} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows Cancel only during running phase', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ProgressPanel state={buildState()} onCancel={onCancel} />,
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    rerender(
      <ProgressPanel
        state={buildState({ phase: 'done', totalFlights: 5 })}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('renders failed job error message', () => {
    const state = buildState({
      jobs: {
        j1: { job: buildState().jobs.j1.job, status: 'failed', error: 'timed out' },
        j2: { job: buildState().jobs.j2.job, status: 'pending' },
      },
    });
    render(<ProgressPanel state={state} />);
    expect(screen.getByText('timed out')).toBeInTheDocument();
  });

  it('shows done summary in header when phase is done', () => {
    const state = buildState({ phase: 'done', totalFlights: 7, failedJobs: 1 });
    render(<ProgressPanel state={state} />);
    expect(screen.getByRole('heading', { name: /done: 7 flights · 1 failed/i })).toBeInTheDocument();
  });
});

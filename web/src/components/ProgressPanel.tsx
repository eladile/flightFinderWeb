import type { JobState, StreamState } from '../api/useSearchStream';

type Props = {
  state: StreamState;
  onCancel?: () => void;
  onRetry?: (jobId: string) => void;
};

function headerText(state: StreamState): string {
  if (state.phase === 'idle') return 'Ready';
  if (state.phase === 'opening' || state.phase === 'planning') return 'Opening stream…';
  if (state.phase === 'error') return `Error: ${state.error ?? 'unknown'}`;
  if (state.phase === 'cancelled') return 'Cancelled';
  if (state.phase === 'done') {
    return `Done: ${state.totalFlights} flights · ${state.failedJobs} failed`;
  }
  return `Searching ${state.totalJobs} destinations`;
}

function completedCount(state: StreamState): number {
  return state.jobOrder.filter((id) => {
    const s = state.jobs[id]?.status;
    return s === 'completed' || s === 'failed';
  }).length;
}

function badgeClass(status: JobState['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-200 text-gray-700';
    case 'running':
      return 'bg-blue-100 text-blue-800 animate-pulse';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
  }
}

function badgeText(job: JobState): string {
  switch (job.status) {
    case 'pending':
      return 'pending';
    case 'running':
      return 'running';
    case 'completed':
      return `${job.flightCount ?? 0} flights`;
    case 'failed':
      return 'failed';
  }
}

function dateRange(job: JobState['job']): string {
  if (job.returnDate) return `${job.outboundDate} → ${job.returnDate}`;
  return job.outboundDate;
}

export default function ProgressPanel({ state, onCancel, onRetry }: Props) {
  const total = state.totalJobs;
  const done = completedCount(state);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  if (state.phase === 'idle') return null;

  return (
    <section className="mt-6 rounded border border-gray-200 bg-white p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{headerText(state)}</h2>
        {state.phase === 'running' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
          >
            Cancel
          </button>
        )}
      </header>
      <div className="mb-4 h-2 w-full overflow-hidden rounded bg-gray-100">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${percent}%` }}
          aria-label="progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <ul className="space-y-1 text-sm">
        {state.jobOrder.map((id) => {
          const j = state.jobs[id];
          if (!j) return null;
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-gray-50"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="font-mono">
                  {j.job.origin} → {j.job.destination}
                </span>
                <span className="text-gray-500">{dateRange(j.job)}</span>
                {j.status === 'failed' && j.error && (
                  <span className="truncate text-xs text-red-600" title={j.error}>
                    {j.error}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(j.status)}`}>
                  {badgeText(j)}
                </span>
                {j.status === 'failed' && onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(id)}
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
                  >
                    retry
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

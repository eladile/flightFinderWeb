import { useCallback, useEffect, useReducer, useRef } from 'react';

export type SearchJob = {
  id: string;
  origin: string;
  destination: string;
  outboundDate: string;
  returnDate: string | null;
  stops: 'any' | 'nonstop' | number;
  providers: string[];
};

export type Flight = {
  destination: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: string;
  date: string;
  stops: string;
  returnDeparture: string;
  returnArrival: string;
  link: string;
  source: string;
  layoverInfo: string;
  returnDate: string;
  priceType: string;
  returnAirline: string;
  returnDuration: string;
  returnStops: string;
};

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type JobState = {
  job: SearchJob;
  status: JobStatus;
  flightCount?: number;
  error?: string;
};

export type StreamPhase =
  | 'idle'
  | 'opening'
  | 'planning'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled';

export type StreamState = {
  phase: StreamPhase;
  searchId?: string;
  jobs: Record<string, JobState>;
  jobOrder: string[];
  flights: (Flight & { jobId: string })[];
  totalJobs: number;
  totalFlights: number;
  failedJobs: number;
  error?: string;
};

type Action =
  | { type: 'SEARCH_ID'; searchId: string }
  | { type: 'PLAN'; totalJobs: number; jobs: SearchJob[] }
  | { type: 'JOB_STARTED'; jobId: string }
  | { type: 'FLIGHT'; jobId: string; flight: Flight }
  | { type: 'JOB_COMPLETED'; jobId: string; flightCount: number }
  | { type: 'JOB_FAILED'; jobId: string; error: string }
  | { type: 'DONE'; totalFlights: number; failedJobs: number }
  | { type: 'ERROR'; error: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' }
  | { type: 'START' };

const initialState: StreamState = {
  phase: 'idle',
  jobs: {},
  jobOrder: [],
  flights: [],
  totalJobs: 0,
  totalFlights: 0,
  failedJobs: 0,
};

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'START':
      return { ...initialState, phase: 'opening' };
    case 'SEARCH_ID':
      return { ...state, searchId: action.searchId };
    case 'PLAN': {
      const jobs: Record<string, JobState> = {};
      const jobOrder: string[] = [];
      for (const job of action.jobs) {
        jobs[job.id] = { job, status: 'pending' };
        jobOrder.push(job.id);
      }
      return { ...state, phase: 'running', totalJobs: action.totalJobs, jobs, jobOrder };
    }
    case 'JOB_STARTED': {
      const current = state.jobs[action.jobId];
      if (!current) return state;
      return {
        ...state,
        jobs: { ...state.jobs, [action.jobId]: { ...current, status: 'running' } },
      };
    }
    case 'FLIGHT':
      return {
        ...state,
        flights: [...state.flights, { ...action.flight, jobId: action.jobId }],
      };
    case 'JOB_COMPLETED': {
      const current = state.jobs[action.jobId];
      if (!current) return state;
      return {
        ...state,
        jobs: {
          ...state.jobs,
          [action.jobId]: { ...current, status: 'completed', flightCount: action.flightCount },
        },
      };
    }
    case 'JOB_FAILED': {
      const current = state.jobs[action.jobId];
      if (!current) return state;
      return {
        ...state,
        jobs: {
          ...state.jobs,
          [action.jobId]: { ...current, status: 'failed', error: action.error },
        },
      };
    }
    case 'DONE':
      return {
        ...state,
        phase: 'done',
        totalFlights: action.totalFlights,
        failedJobs: action.failedJobs,
      };
    case 'ERROR':
      return { ...state, phase: 'error', error: action.error };
    case 'CANCEL':
      return { ...state, phase: 'cancelled' };
    default:
      return state;
  }
}

function encodeRequest(request: unknown): string {
  const json = JSON.stringify(request);
  return btoa(unescape(encodeURIComponent(json)));
}

export function useSearchStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const esRef = useRef<EventSource | null>(null);
  const doneRef = useRef(false);
  const searchIdRef = useRef<string | undefined>(undefined);

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const start = useCallback(
    (request: unknown) => {
      closeStream();
      doneRef.current = false;
      searchIdRef.current = undefined;
      dispatch({ type: 'START' });
      const url = `/api/search?q=${encodeURIComponent(encodeRequest(request))}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('search_id', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        searchIdRef.current = data.searchId;
        dispatch({ type: 'SEARCH_ID', searchId: data.searchId });
      });
      es.addEventListener('plan', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'PLAN', totalJobs: data.totalJobs, jobs: data.jobs });
      });
      es.addEventListener('job_started', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'JOB_STARTED', jobId: data.jobId });
      });
      es.addEventListener('flight', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'FLIGHT', jobId: data.jobId, flight: data.flight });
      });
      es.addEventListener('job_completed', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'JOB_COMPLETED', jobId: data.jobId, flightCount: data.flightCount });
      });
      es.addEventListener('job_failed', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'JOB_FAILED', jobId: data.jobId, error: data.error });
      });
      es.addEventListener('done', (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        doneRef.current = true;
        dispatch({ type: 'DONE', totalFlights: data.totalFlights, failedJobs: data.failedJobs });
        closeStream();
      });
      es.onerror = () => {
        if (doneRef.current) return;
        dispatch({ type: 'ERROR', error: 'stream error' });
        closeStream();
      };
    },
    [closeStream],
  );

  const cancel = useCallback(() => {
    const id = searchIdRef.current;
    closeStream();
    dispatch({ type: 'CANCEL' });
    if (id) {
      fetch(`/api/search/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  }, [closeStream]);

  const reset = useCallback(() => {
    closeStream();
    doneRef.current = false;
    searchIdRef.current = undefined;
    dispatch({ type: 'RESET' });
  }, [closeStream]);

  useEffect(() => {
    return () => {
      const id = searchIdRef.current;
      closeStream();
      if (id && !doneRef.current) {
        fetch(`/api/search/${id}`, { method: 'DELETE' }).catch(() => {});
      }
    };
  }, [closeStream]);

  return { state, start, cancel, reset };
}

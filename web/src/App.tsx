import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchForm from './components/SearchForm';
import ProgressPanel from './components/ProgressPanel';
import { useSearchStream } from './api/useSearchStream';
import type { SearchRequest } from './types';

const queryClient = new QueryClient();

export default function App() {
  const [health, setHealth] = useState<string>('loading...');
  const stream = useSearchStream();

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`status ${r.status}`))))
      .then(setHealth)
      .catch(() => setHealth('backend unreachable'));
  }, []);

  function handleSubmit(req: SearchRequest) {
    stream.start(req);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <main className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-3xl font-bold">Lazy Hopper</h1>
          <p className="text-xs text-gray-500">backend: {health}</p>
        </div>
        <SearchForm onSubmit={handleSubmit} loading={stream.state.phase === 'running' || stream.state.phase === 'opening' || stream.state.phase === 'planning'} />
        {stream.state.phase !== 'idle' && (
          <div className="mt-8">
            <ProgressPanel state={stream.state} onCancel={stream.cancel} />
          </div>
        )}
      </main>
    </QueryClientProvider>
  );
}

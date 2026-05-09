import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchForm from './components/SearchForm';
import ProgressPanel from './components/ProgressPanel';
import CuratedView from './components/CuratedView';
import FlightsTable from './components/FlightsTable';
import SelectionBar from './components/SelectionBar';
import SendDialog from './components/SendDialog';
import { useSearchStream } from './api/useSearchStream';
import { useSelection } from './hooks/useSelection';
import type { SearchRequest } from './types';

const queryClient = new QueryClient();

export default function App() {
  const [health, setHealth] = useState<string>('loading...');
  const stream = useSearchStream();
  const selection = useSelection();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [defaultRecipient, setDefaultRecipient] = useState<string>('');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`status ${r.status}`))))
      .then(setHealth)
      .catch(() => setHealth('backend unreachable'));

    fetch('/api/config/email_to')
      .then((r) => (r.ok ? r.json() : Promise.resolve({})))
      .then((data: { emailTo?: string }) => setDefaultRecipient(data.emailTo || ''))
      .catch(() => {});
  }, []);

  function handleSubmit(req: SearchRequest) {
    stream.start(req);
  }

  const selectedFlights = stream.state.flights.filter((f) =>
    selection.selected.has(
      `${f.source}:${f.destination}:${f.date}:${f.airline}:${f.departureTime}:${f.price}`
    )
  );

  const handleSendClick = () => {
    setSendDialogOpen(true);
  };

  const handleSent = () => {
    selection.clear();
  };

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
        {stream.state.flights.length > 0 && (
          <CuratedView
            state={stream.state}
            selected={selection.selected}
            onToggle={selection.toggle}
          />
        )}
        {stream.state.flights.length > 0 && (
          <FlightsTable
            state={stream.state}
            selected={selection.selected}
            onToggle={selection.toggle}
          />
        )}
        {selection.count > 0 && (
          <SelectionBar
            selectedFlights={selectedFlights}
            onSend={handleSendClick}
            onClear={selection.clear}
          />
        )}
        <SendDialog
          open={sendDialogOpen}
          selectedFlights={selectedFlights}
          defaultRecipient={defaultRecipient}
          onClose={() => setSendDialogOpen(false)}
          onSent={handleSent}
        />
      </main>
    </QueryClientProvider>
  );
}

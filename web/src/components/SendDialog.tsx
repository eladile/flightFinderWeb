import { useEffect, useState } from 'react';
import type { Flight } from '../api/useSearchStream';

type Props = {
  open: boolean;
  selectedFlights: Flight[];
  defaultRecipient?: string;
  onClose: () => void;
  onSent: () => void;
};

export default function SendDialog({ open, selectedFlights, defaultRecipient, onClose, onSent }: Props) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && defaultRecipient) {
      setTo(defaultRecipient);
    }
  }, [open, defaultRecipient]);

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split('T')[0];
      const count = selectedFlights.length;
      setSubject(`Flight picks — ${today} — ${count} flight${count !== 1 ? 's' : ''}`);
    }
  }, [open, selectedFlights.length]);

  useEffect(() => {
    if (!open) return;

    const fetchPreview = async () => {
      try {
        const res = await fetch('/api/send/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flights: selectedFlights, subject }),
        });
        if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
        const data = await res.json();
        setPreviewHtml(data.html);
      } catch (err) {
        console.error('Preview error:', err);
      }
    };

    fetchPreview();
  }, [open, selectedFlights, subject]);

  const handleSend = async () => {
    setError(null);
    setSending(true);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flights: selectedFlights, to, subject }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `Send failed: ${res.status}`);
      }

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Send failed');
      }

      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl flex-col rounded-lg bg-white shadow-xl">
        <header className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold">Send Flights</h2>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-1/3 flex-col gap-4 border-r border-gray-200 p-6">
            <div>
              <label htmlFor="to" className="mb-1 block text-sm font-medium text-gray-700">
                To
              </label>
              <input
                id="to"
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex-1" />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !to.trim()}
                className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="mb-2 text-sm font-medium text-gray-700">Preview</div>
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="h-full w-full rounded border border-gray-300"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">
                Loading preview...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Flight } from '../api/useSearchStream';
import { parsePrice } from '../lib/flightUtils';
import { asMarkdown, asPlainText, asJson } from '../lib/copyFormats';

type Props = {
  selectedFlights: Flight[];
  onSend: () => void;
  onClear: () => void;
};

export default function SelectionBar({ selectedFlights, onSend, onClear }: Props) {
  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const count = selectedFlights.length;
  const cheapestTotal = selectedFlights.reduce((sum, f) => sum + parsePrice(f.price), 0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const copyAs = (format: 'markdown' | 'plain' | 'json') => {
    let text = '';
    if (format === 'markdown') text = asMarkdown(selectedFlights);
    else if (format === 'plain') text = asPlainText(selectedFlights);
    else text = asJson(selectedFlights);

    navigator.clipboard.writeText(text).then(
      () => showToast(`Copied ${count} flight${count !== 1 ? 's' : ''} as ${format}`),
      () => showToast('Copy failed')
    );
    setCopyDropdownOpen(false);
  };

  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-300 bg-white shadow-lg">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="text-lg font-semibold">
            {count} flight{count !== 1 ? 's' : ''} selected
          </span>
          <span className="text-sm text-gray-600">
            Total: ${cheapestTotal.toFixed(0)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSend}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Send
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
              className="flex items-center gap-1 rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              Copy ▾
            </button>
            {copyDropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-40 rounded border border-gray-300 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => copyAs('markdown')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => copyAs('plain')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  Plain text
                </button>
                <button
                  type="button"
                  onClick={() => copyAs('json')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  JSON
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClear}
            className="rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 right-6 rounded bg-gray-800 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

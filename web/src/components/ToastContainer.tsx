import { useToasts, type ToastLevel } from '../lib/toast';

function levelClass(level: ToastLevel): string {
  switch (level) {
    case 'error':
      return 'border-red-300 bg-red-50 text-red-800';
    case 'success':
      return 'border-green-300 bg-green-50 text-green-800';
    case 'info':
      return 'border-gray-300 bg-white text-gray-800';
  }
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-2 rounded border px-3 py-2 text-sm shadow ${levelClass(t.level)}`}
        >
          <div className="flex-1">{t.message}</div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-gray-500 hover:text-gray-800"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

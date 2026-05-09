import { useEffect, useState } from 'react';

export type ToastLevel = 'error' | 'info' | 'success';

export type ToastMessage = {
  id: number;
  message: string;
  level: ToastLevel;
};

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  for (const l of listeners) l(toasts);
}

export function showToast(message: string, level: ToastLevel = 'info'): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, level }];
  emit();
  setTimeout(() => dismissToast(id), 5000);
  return id;
}

export function dismissToast(id: number): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function clearToasts(): void {
  toasts = [];
  emit();
}

export function useToasts() {
  const [current, setCurrent] = useState<ToastMessage[]>(toasts);
  useEffect(() => {
    const listener: Listener = (t) => setCurrent(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { toasts: current, showToast, dismiss: dismissToast };
}

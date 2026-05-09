import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, dismissToast, showToast, useToasts } from '../toast';

describe('useToasts', () => {
  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });

  it('appends new toasts and exposes them to subscribers', () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current.toasts).toHaveLength(0);

    act(() => {
      showToast('hello', 'info');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ message: 'hello', level: 'info' });
  });

  it('dismisses toasts by id', () => {
    const { result } = renderHook(() => useToasts());
    let id = 0;
    act(() => {
      id = showToast('bye', 'error');
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      dismissToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToasts());
    act(() => {
      showToast('temp', 'info');
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });
});

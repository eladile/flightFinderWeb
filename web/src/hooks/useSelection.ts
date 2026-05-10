import { useCallback, useState } from 'react';

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  const setAll = useCallback((keys: string[]) => {
    setSelected(new Set(keys));
  }, []);

  const removeMany = useCallback((keys: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  return {
    selected,
    toggle,
    clear,
    isSelected,
    setAll,
    removeMany,
    count: selected.size,
  };
}

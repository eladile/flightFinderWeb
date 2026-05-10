import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from './useSelection';

describe('useSelection', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.count).toBe(0);
    expect(result.current.selected.size).toBe(0);
  });

  it('toggle adds a key', () => {
    const { result } = renderHook(() => useSelection());
    act(() => {
      result.current.toggle('key1');
    });
    expect(result.current.count).toBe(1);
    expect(result.current.isSelected('key1')).toBe(true);
  });

  it('toggle removes a key', () => {
    const { result } = renderHook(() => useSelection());
    act(() => {
      result.current.toggle('key1');
      result.current.toggle('key1');
    });
    expect(result.current.count).toBe(0);
    expect(result.current.isSelected('key1')).toBe(false);
  });

  it('clear empties selection', () => {
    const { result } = renderHook(() => useSelection());
    act(() => {
      result.current.toggle('key1');
      result.current.toggle('key2');
    });
    expect(result.current.count).toBe(2);
    act(() => {
      result.current.clear();
    });
    expect(result.current.count).toBe(0);
  });

  it('setAll replaces selection', () => {
    const { result } = renderHook(() => useSelection());
    act(() => {
      result.current.toggle('key1');
      result.current.toggle('key2');
    });
    expect(result.current.count).toBe(2);
    act(() => {
      result.current.setAll(['key3', 'key4', 'key5']);
    });
    expect(result.current.count).toBe(3);
    expect(result.current.isSelected('key1')).toBe(false);
    expect(result.current.isSelected('key3')).toBe(true);
    expect(result.current.isSelected('key4')).toBe(true);
    expect(result.current.isSelected('key5')).toBe(true);
  });

  it('removeMany removes specified keys', () => {
    const { result } = renderHook(() => useSelection());
    act(() => {
      result.current.setAll(['key1', 'key2', 'key3', 'key4']);
    });
    expect(result.current.count).toBe(4);
    act(() => {
      result.current.removeMany(['key2', 'key4']);
    });
    expect(result.current.count).toBe(2);
    expect(result.current.isSelected('key1')).toBe(true);
    expect(result.current.isSelected('key2')).toBe(false);
    expect(result.current.isSelected('key3')).toBe(true);
    expect(result.current.isSelected('key4')).toBe(false);
  });
});

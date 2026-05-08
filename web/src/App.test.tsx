import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  });

  it('renders the Lazy Hopper heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /lazy hopper/i })).toBeInTheDocument();
  });
});

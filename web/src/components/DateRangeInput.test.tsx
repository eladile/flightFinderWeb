import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import DateRangeInput from './DateRangeInput';

function Harness({ initFrom = '', initTo = '' }: { initFrom?: string; initTo?: string }) {
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  return (
    <DateRangeInput
      fromLabel="From"
      toLabel="To"
      fromValue={from}
      toValue={to}
      onChange={(f, t) => {
        setFrom(f);
        setTo(t);
      }}
    />
  );
}

describe('DateRangeInput', () => {
  it('shows error when to < from', () => {
    render(<Harness initFrom="2026-06-10" initTo="2026-06-01" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/End date/);
  });

  it('no error when clearing the end date', async () => {
    const user = userEvent.setup();
    render(<Harness initFrom="2026-06-10" initTo="2026-06-01" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const toInput = screen.getByLabelText('To') as HTMLInputElement;
    await user.clear(toInput);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

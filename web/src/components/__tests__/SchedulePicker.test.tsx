import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SchedulePicker, { describeCron } from '../SchedulePicker';

describe('SchedulePicker', () => {
  it('renders with default "Daily at 09:00" when value is empty', async () => {
    const onChange = vi.fn();
    render(<SchedulePicker value="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText(/runs daily at 09:00/i)).toBeInTheDocument();
    });

    // Should emit the default cron
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('0 9 * * *');
    });
  });

  it('switching to "Every 2 hours" emits correct cron', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SchedulePicker value="0 9 * * *" onChange={onChange} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'every-2-hours');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('0 */2 * * *');
    });
  });

  it('switching to "Weekly", selecting Mon + Fri, time 17:30', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SchedulePicker value="0 9 * * *" onChange={onChange} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'weekly');

    // Change time
    const timeInput = screen.getByLabelText(/time/i);
    await user.clear(timeInput);
    await user.type(timeInput, '17:30');

    // Select Mon (index 1) and Fri (index 5)
    const dayButtons = screen.getAllByRole('button').filter((btn) => {
      const text = btn.textContent;
      return text === 'Mon' || text === 'Fri';
    });

    for (const btn of dayButtons) {
      await user.click(btn);
    }

    await waitFor(() => {
      const calls = onChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('30 17 * * 1,5');
    });
  });

  it('parsing prop: "0 */6 * * *" shows "Every 6 hours"', () => {
    const onChange = vi.fn();
    render(<SchedulePicker value="0 */6 * * *" onChange={onChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('every-6-hours');
  });

  it('parsing prop: "30 17 * * 1,5" shows Weekly with Mon+Fri and time 17:30', () => {
    const onChange = vi.fn();
    render(<SchedulePicker value="30 17 * * 1,5" onChange={onChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('weekly');

    const timeInput = screen.getByLabelText(/time/i) as HTMLInputElement;
    expect(timeInput.value).toBe('17:30');

    const dayButtons = screen.getAllByRole('button');
    const monButton = dayButtons.find((btn) => btn.textContent === 'Mon');
    const friButton = dayButtons.find((btn) => btn.textContent === 'Fri');

    expect(monButton).toHaveClass('bg-blue-500');
    expect(friButton).toHaveClass('bg-blue-500');
  });

  it('custom escape hatch: "15 9 * * 1-5" selects Custom and shows raw cron', () => {
    const onChange = vi.fn();
    render(<SchedulePicker value="15 9 * * 1-5" onChange={onChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('custom');

    const cronInput = screen.getByPlaceholderText('0 9 * * 1') as HTMLInputElement;
    expect(cronInput.value).toBe('15 9 * * 1-5');
  });
});

describe('describeCron', () => {
  it('describes "0 */2 * * *" as "Every 2 hours"', () => {
    expect(describeCron('0 */2 * * *')).toBe('Every 2 hours');
  });

  it('describes "0 9 * * *" as "Daily at 09:00"', () => {
    expect(describeCron('0 9 * * *')).toBe('Daily at 09:00');
  });

  it('describes "30 17 * * 1,5" as "Every Mon, Fri at 17:30"', () => {
    expect(describeCron('30 17 * * 1,5')).toBe('Every Mon, Fri at 17:30');
  });

  it('describes "0 8 15 * *" as "Monthly on day 15 at 08:00"', () => {
    expect(describeCron('0 8 15 * *')).toBe('Monthly on day 15 at 08:00');
  });

  it('describes "15 9 * * 1-5" as custom fallback', () => {
    expect(describeCron('15 9 * * 1-5')).toBe('Custom: 15 9 * * 1-5');
  });
});

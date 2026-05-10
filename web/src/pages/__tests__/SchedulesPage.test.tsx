import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SchedulesPage from '../SchedulesPage';

const mockSchedule = {
  name: 'test-schedule',
  cronExpression: '0 9 * * 1',
  request: {
    origins: ['NYC'],
    destinations: ['BER'],
    tripType: 'oneway' as const,
    outboundDateFrom: '2026-06-01',
    outboundDateTo: '2026-06-15',
    stops: 'any' as const,
    providers: ['google' as const],
  },
  recipients: ['test@example.com'],
  subject: 'Test subject',
  enabled: true,
  createdAt: '2026-05-08T10:00:00Z',
  lastRun: null,
  runs: [],
};

describe('SchedulesPage', () => {
  beforeEach(() => {
    (global as any).fetch = vi.fn();
  });

  it('loads and displays schedules', async () => {
    ((global as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockSchedule],
    });

    render(<SchedulesPage />);

    expect(screen.getByText('Loading schedules...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('test-schedule')).toBeInTheDocument();
    });

    expect(screen.getByText('Every Mon at 09:00')).toBeInTheDocument();
    const enabledElements = screen.getAllByText('Enabled');
    expect(enabledElements.length).toBeGreaterThan(0);
  });

  it('shows empty state when no schedules', async () => {
    ((global as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<SchedulesPage />);

    await waitFor(() => {
      expect(screen.getByText('No schedules configured.')).toBeInTheDocument();
    });
  });

  it('opens new schedule dialog on button click', async () => {
    ((global as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<SchedulesPage />);

    await waitFor(() => {
      expect(screen.getByText('No schedules configured.')).toBeInTheDocument();
    });

    const newButton = screen.getByText('+ New schedule');
    fireEvent.click(newButton);

    expect(screen.getByText('New Schedule')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('deletes schedule after confirmation', async () => {
    ((global as any).fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSchedule],
      })
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    (global as any).confirm = vi.fn(() => true);

    render(<SchedulesPage />);

    await waitFor(() => {
      expect(screen.getByText('test-schedule')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    expect((global as any).confirm).toHaveBeenCalledWith('Delete schedule "test-schedule"?');

    await waitFor(() => {
      expect(screen.getByText('No schedules configured.')).toBeInTheDocument();
    });
  });
});

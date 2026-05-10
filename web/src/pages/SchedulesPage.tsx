import { useEffect, useState } from 'react';
import type { Schedule, ScheduleRun, SearchRequest } from '../types';
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  triggerSchedule,
  type CreateScheduleBody,
} from '../api/schedules';
import { showToast } from '../lib/toast';
import SearchForm from '../components/SearchForm';
import SchedulePicker, { describeCron } from '../components/SchedulePicker';

type ScheduleFormDialogProps = {
  open: boolean;
  schedule: Schedule | null;
  onClose: () => void;
  onSaved: () => void;
};

function ScheduleFormDialog({ open, schedule, onClose, onSaved }: ScheduleFormDialogProps) {
  const isEdit = Boolean(schedule);
  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && schedule) {
      setName(schedule.name);
      setCronExpression(schedule.cronExpression);
      setEnabled(schedule.enabled);
      setRecipients(schedule.recipients.join(', '));
      setSubject(schedule.subject || '');
      setSearchRequest(schedule.request);
    } else if (open && !schedule) {
      setName('');
      setCronExpression('');
      setEnabled(true);
      setRecipients('');
      setSubject('');
      setSearchRequest(null);
    }
  }, [open, schedule]);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!cronExpression.trim()) {
      setError('Cron expression is required');
      return;
    }
    if (!recipients.trim()) {
      setError('Recipients are required');
      return;
    }
    if (!searchRequest) {
      setError('Search configuration is invalid');
      return;
    }

    const body: CreateScheduleBody = {
      name: name.trim(),
      cronExpression: cronExpression.trim(),
      enabled,
      recipients: recipients.split(',').map((r) => r.trim()).filter(Boolean),
      subject: subject.trim() || null,
      request: searchRequest,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateSchedule(schedule!.name, body);
        showToast(`Updated schedule "${name}"`, 'success');
      } else {
        await createSchedule(body);
        showToast(`Created schedule "${name}"`, 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      showToast(`Save failed: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-auto">
      <div className="max-h-[90vh] w-[90vw] max-w-3xl overflow-auto rounded-lg bg-white shadow-xl">
        <header className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold">{isEdit ? 'Edit Schedule' : 'New Schedule'}</h2>
        </header>

        <div className="space-y-4 p-6">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              placeholder="my-weekly-search"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Schedule</label>
            <SchedulePicker value={cronExpression} onChange={setCronExpression} />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Enabled
            </label>
          </div>

          <div>
            <label htmlFor="recipients" className="mb-1 block text-sm font-medium text-gray-700">
              Recipients
            </label>
            <input
              id="recipients"
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated email addresses</p>
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
              Subject (optional)
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Weekly flight deals"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Search Configuration</h3>
            <div className="rounded border border-gray-200 p-4">
              <SearchForm
                initial={searchRequest ?? undefined}
                disableUrlState
                onChange={setSearchRequest}
                hideSubmit
              />
            </div>
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <footer className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

type ScheduleRowProps = {
  schedule: Schedule;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => void;
};

function ScheduleRow({ schedule, onEdit, onDelete, onTrigger }: ScheduleRowProps) {
  const [running, setRunning] = useState(false);

  async function handleTrigger() {
    setRunning(true);
    try {
      const run = await triggerSchedule(schedule.name);
      if (run.status === 'success') {
        showToast(`${schedule.name}: ${run.flightCount} flights`, 'success');
      } else if (run.status === 'failed') {
        showToast(`${schedule.name}: ${run.error}`, 'error');
      }
      onTrigger();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Trigger failed: ${msg}`, 'error');
    } finally {
      setRunning(false);
    }
  }

  function formatRunStatus(run: ScheduleRun | null) {
    if (!run) return <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">Never</span>;
    if (run.status === 'running') {
      return <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700">Running...</span>;
    }
    if (run.status === 'failed') {
      return (
        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700" title={run.error || undefined}>
          Failed
        </span>
      );
    }
    const date = new Date(run.startedAt).toLocaleString();
    return (
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
        OK · {date}
      </span>
    );
  }

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-sm">{schedule.name}</td>
      <td className="px-4 py-3 text-sm" title={schedule.cronExpression}>
        {describeCron(schedule.cronExpression)}
      </td>
      <td className="px-4 py-3 text-sm">
        {schedule.enabled ? (
          <span className="text-green-600">Enabled</span>
        ) : (
          <span className="text-gray-500">Disabled</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm">{formatRunStatus(schedule.lastRun)}</td>
      <td className="px-4 py-3 text-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTrigger}
            disabled={running}
            className="text-blue-600 hover:underline disabled:opacity-50"
          >
            {running ? 'Running...' : 'Run Now'}
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={onEdit}
            className="text-blue-600 hover:underline"
          >
            Edit
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={onDelete}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listSchedules();
      setSchedules(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to load schedules: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(schedule: Schedule) {
    if (!window.confirm(`Delete schedule "${schedule.name}"?`)) return;
    try {
      await deleteSchedule(schedule.name);
      showToast(`Deleted "${schedule.name}"`, 'success');
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Delete failed: ${msg}`, 'error');
    }
  }

  function handleNew() {
    setEditingSchedule(null);
    setDialogOpen(true);
  }

  function handleEdit(schedule: Schedule) {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingSchedule(null);
  }

  function handleSaved() {
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Scheduled Searches</h2>
        <button
          type="button"
          onClick={handleNew}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New schedule
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading schedules...</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-gray-500">No schedules configured.</p>
      ) : (
        <div className="rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Cron</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Enabled</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Last Run</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <ScheduleRow
                  key={s.name}
                  schedule={s}
                  onEdit={() => handleEdit(s)}
                  onDelete={() => handleDelete(s)}
                  onTrigger={load}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ScheduleFormDialog
        open={dialogOpen}
        schedule={editingSchedule}
        onClose={handleDialogClose}
        onSaved={handleSaved}
      />
    </div>
  );
}

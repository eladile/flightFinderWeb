import type { Schedule, ScheduleRun, SearchRequest } from '../types';

export type CreateScheduleBody = {
  name: string;
  cronExpression: string;
  request: SearchRequest;
  recipients: string[];
  subject: string | null;
  enabled: boolean;
};

export type UpdateScheduleBody = Partial<CreateScheduleBody>;

export async function listSchedules(): Promise<Schedule[]> {
  const res = await fetch('/api/schedules');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `listSchedules failed: ${res.status}`);
  }
  return res.json();
}

export async function createSchedule(body: CreateScheduleBody): Promise<Schedule> {
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `createSchedule failed: ${res.status}`);
  }
  return res.json();
}

export async function updateSchedule(name: string, body: UpdateScheduleBody): Promise<Schedule> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `updateSchedule failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteSchedule(name: string): Promise<void> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `deleteSchedule failed: ${res.status}`);
  }
}

export async function triggerSchedule(name: string): Promise<ScheduleRun> {
  const res = await fetch(`/api/schedules/${encodeURIComponent(name)}/trigger`, {
    method: 'POST',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `triggerSchedule failed: ${res.status}`);
  }
  return res.json();
}

import { useEffect, useState } from 'react';

type Frequency =
  | 'every-hour'
  | 'every-2-hours'
  | 'every-6-hours'
  | 'every-12-hours'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

type Props = {
  value: string;
  onChange: (cron: string) => void;
};

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'every-hour', label: 'Every hour' },
  { value: 'every-2-hours', label: 'Every 2 hours' },
  { value: 'every-6-hours', label: 'Every 6 hours' },
  { value: 'every-12-hours', label: 'Every 12 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (advanced)' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseCronToState(cron: string): {
  frequency: Frequency;
  time: string;
  weekDays: boolean[];
  monthDay: number;
  customCron: string;
} {
  const trimmed = cron.trim();
  const parts = trimmed.split(/\s+/);

  // Default state
  const defaultState = {
    frequency: 'daily' as Frequency,
    time: '09:00',
    weekDays: [false, false, false, false, false, false, false],
    monthDay: 1,
    customCron: trimmed,
  };

  if (parts.length !== 5) return defaultState;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every hour: 0 * * * *
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { ...defaultState, frequency: 'every-hour' };
  }

  // Every N hours: 0 */N * * *
  const hourInterval = hour.match(/^\*\/(\d+)$/);
  if (
    minute === '0' &&
    hourInterval &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    const n = parseInt(hourInterval[1], 10);
    if (n === 2) return { ...defaultState, frequency: 'every-2-hours' };
    if (n === 6) return { ...defaultState, frequency: 'every-6-hours' };
    if (n === 12) return { ...defaultState, frequency: 'every-12-hours' };
  }

  // Daily: MM HH * * *
  if (
    minute.match(/^\d+$/) &&
    hour.match(/^\d+$/) &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    const hh = parseInt(hour, 10);
    const mm = parseInt(minute, 10);
    const time = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    return { ...defaultState, frequency: 'daily', time };
  }

  // Weekly: MM HH * * D[,D]*
  if (
    minute.match(/^\d+$/) &&
    hour.match(/^\d+$/) &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek.match(/^[\d,]+$/)
  ) {
    const hh = parseInt(hour, 10);
    const mm = parseInt(minute, 10);
    const time = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    const days = dayOfWeek.split(',').map((d) => parseInt(d, 10));
    const weekDays = [false, false, false, false, false, false, false];
    days.forEach((d) => {
      if (d >= 0 && d <= 6) weekDays[d] = true;
    });
    return { ...defaultState, frequency: 'weekly', time, weekDays };
  }

  // Monthly: MM HH D * *
  if (
    minute.match(/^\d+$/) &&
    hour.match(/^\d+$/) &&
    dayOfMonth.match(/^\d+$/) &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    const hh = parseInt(hour, 10);
    const mm = parseInt(minute, 10);
    const day = parseInt(dayOfMonth, 10);
    const time = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    return { ...defaultState, frequency: 'monthly', time, monthDay: day };
  }

  // Custom fallback
  return { ...defaultState, frequency: 'custom', customCron: trimmed };
}

function buildCron(
  frequency: Frequency,
  time: string,
  weekDays: boolean[],
  monthDay: number,
  customCron: string
): string {
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10));

  switch (frequency) {
    case 'every-hour':
      return '0 * * * *';
    case 'every-2-hours':
      return '0 */2 * * *';
    case 'every-6-hours':
      return '0 */6 * * *';
    case 'every-12-hours':
      return '0 */12 * * *';
    case 'daily':
      return `${mm} ${hh} * * *`;
    case 'weekly': {
      const days = weekDays
        .map((selected, idx) => (selected ? idx : -1))
        .filter((d) => d >= 0)
        .sort((a, b) => a - b);
      if (days.length === 0) return `${mm} ${hh} * * *`; // Fallback to daily
      return `${mm} ${hh} * * ${days.join(',')}`;
    }
    case 'monthly':
      return `${mm} ${hh} ${monthDay} * *`;
    case 'custom':
      return customCron;
    default:
      return '0 9 * * *';
  }
}

export function describeCron(cron: string): string {
  const parsed = parseCronToState(cron);

  switch (parsed.frequency) {
    case 'every-hour':
      return 'Every hour';
    case 'every-2-hours':
      return 'Every 2 hours';
    case 'every-6-hours':
      return 'Every 6 hours';
    case 'every-12-hours':
      return 'Every 12 hours';
    case 'daily':
      return `Daily at ${parsed.time}`;
    case 'weekly': {
      const days = parsed.weekDays
        .map((selected, idx) => (selected ? DAY_NAMES[idx] : null))
        .filter(Boolean)
        .join(', ');
      if (days) return `Every ${days} at ${parsed.time}`;
      return `Daily at ${parsed.time}`;
    }
    case 'monthly':
      return `Monthly on day ${parsed.monthDay} at ${parsed.time}`;
    case 'custom':
      return `Custom: ${cron}`;
    default:
      return cron;
  }
}

export default function SchedulePicker({ value, onChange }: Props) {
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [time, setTime] = useState('09:00');
  const [weekDays, setWeekDays] = useState([false, false, false, false, false, false, false]);
  const [monthDay, setMonthDay] = useState(1);
  const [customCron, setCustomCron] = useState('');

  // Parse value into state on mount or when value changes
  useEffect(() => {
    if (value) {
      const parsed = parseCronToState(value);
      setFrequency(parsed.frequency);
      setTime(parsed.time);
      setWeekDays(parsed.weekDays);
      setMonthDay(parsed.monthDay);
      setCustomCron(parsed.customCron);
    } else {
      // Default to Daily at 09:00
      setFrequency('daily');
      setTime('09:00');
      setWeekDays([false, false, false, false, false, false, false]);
      setMonthDay(1);
      setCustomCron('0 9 * * *');
    }
  }, [value]);

  // Emit cron whenever any state changes
  useEffect(() => {
    const newCron = buildCron(frequency, time, weekDays, monthDay, customCron);
    if (newCron !== value) {
      onChange(newCron);
    }
  }, [frequency, time, weekDays, monthDay, customCron, onChange, value]);

  function toggleWeekDay(idx: number) {
    const updated = [...weekDays];
    updated[idx] = !updated[idx];
    setWeekDays(updated);
  }

  const currentCron = buildCron(frequency, time, weekDays, monthDay, customCron);
  const preview = describeCron(currentCron);

  return (
    <div className="space-y-3">
      <div>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {(frequency === 'daily' ||
        frequency === 'weekly' ||
        frequency === 'monthly') && (
        <div>
          <label htmlFor="schedule-time" className="mb-1 block text-sm text-gray-600">
            Time
          </label>
          <input
            id="schedule-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {frequency === 'weekly' && (
        <div>
          <label className="mb-2 block text-sm text-gray-600">Days of week</label>
          <div className="flex gap-2">
            {DAY_NAMES.map((name, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleWeekDay(idx)}
                className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
                  weekDays[idx]
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {frequency === 'monthly' && (
        <div>
          <label htmlFor="schedule-monthday" className="mb-1 block text-sm text-gray-600">
            Day of month
          </label>
          <input
            id="schedule-monthday"
            type="number"
            min={1}
            max={28}
            value={monthDay}
            onChange={(e) => setMonthDay(Math.max(1, Math.min(28, parseInt(e.target.value, 10) || 1)))}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Capped at 28 to avoid February issues</p>
        </div>
      )}

      {frequency === 'custom' && (
        <div>
          <label className="mb-1 block text-sm text-gray-600">Cron expression</label>
          <input
            type="text"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 9 * * 1"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <p className="text-sm italic text-gray-500">
        Runs {preview.charAt(0).toLowerCase() + preview.slice(1)}
      </p>
    </div>
  );
}

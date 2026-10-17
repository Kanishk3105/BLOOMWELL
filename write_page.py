from pathlib import Path

content = '''
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  HeartPulse,
  MoonStar,
  PencilLine,
  Salad,
  Settings,
  Sparkles,
  Target,
  UtensilsCrossed,
  Weight,
} from 'lucide-react';

type Tab = 'Today' | 'Cycle' | 'Nutrition' | 'Insights' | 'Reminders';
type Flow = 'light' | 'medium' | 'heavy';

type Profile = {
  name: string;
  dob: string;
  cycleLength: number;
  periodLength: number;
  lastPeriod: string;
  weightKg: number;
  heightCm: number;
  timezone: string;
};

type CycleEntry = {
  id: string;
  date: string;
  flow: Flow;
  cramps: number;
  mood: string;
  notes: string;
};

type MealEntry = {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Reminder = {
  id: string;
  title: string;
  detail: string;
  enabled: boolean;
};

const STORAGE_KEY = 'bloomwell-user-data-v1';
const tabs: Tab[] = ['Today', 'Cycle', 'Nutrition', 'Insights', 'Reminders'];
const cycleRangeOptions = ['15d', '30d', '90d', '1y'];

const defaultProfile: Profile = {
  name: '',
  dob: '',
  cycleLength: 28,
  periodLength: 5,
  lastPeriod: '',
  weightKg: 0,
  heightCm: 0,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

const defaultReminders: Reminder[] = [
  { id: 'checkin', title: 'Cycle check-in', detail: 'Log symptoms before tonight', enabled: true },
  { id: 'weight', title: 'Weight check-in', detail: 'Record your latest weight', enabled: true },
  { id: 'doctor', title: 'Doctor follow-up', detail: 'Review symptoms and questions', enabled: false },
];

const emptyCycleData = [{ label: 'No data', days: 0 }];

function formatDate(value: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatShortDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function toDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCycleDay(lastPeriod: string) {
  if (!lastPeriod) return null;
  const start = toDate(lastPeriod);
  if (!start) return null;
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getNextPeriodDate(lastPeriod: string, cycleLength: number) {
  if (!lastPeriod) return null;
  const start = toDate(lastPeriod);
  if (!start) return null;
  const date = new Date(start);
  date.setDate(date.getDate() + cycleLength);
  return date;
}

function getObservedCycleData(entries: CycleEntry[]) {
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sorted.length < 2) return [];

  const data: { label: string; days: number }[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = toDate(sorted[i - 1].date);
    const curr = toDate(sorted[i].date);
    if (!prev || !curr) continue;
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    data.push({
      label: new Intl.DateTimeFormat('en', { month: 'short' }).format(curr),
      days: diffDays,
    });
  }

  return data;
}

function getLastMealTotals(entries: MealEntry[]) {
  return entries.reduce(
    (acc, item) => {
      acc.calories += Number(item.calories || 0);
      acc.protein += Number(item.protein || 0);
      acc.carbs += Number(item.carbs || 0);
      acc.fat += Number(item.fat || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('Today');
  const [selectedRange, setSelectedRange] = useState<string>('15d');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [cycleEntries, setCycleEntries] = useState<CycleEntry[]>([]);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>(defaultReminders);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newCycleEntry, setNewCycleEntry] = useState({
    date: new Date().toISOString().slice(0, 10),
    flow: 'medium' as Flow,
    cramps: 3,
    mood: 'steady',
    notes: '',
  });
  const [newMealEntry, setNewMealEntry] = useState({
    date: new Date().toISOString().slice(0, 10),
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as {
        profile?: Partial<Profile>;
        cycleEntries?: CycleEntry[];
        mealEntries?: MealEntry[];
        reminders?: Reminder[];
      };

      setProfile({ ...defaultProfile, ...parsed.profile });
      setCycleEntries(parsed.cycleEntries ?? []);
      setMealEntries(parsed.mealEntries ?? []);
      setReminders(parsed.reminders ?? defaultReminders);
    } catch {
      // Safe fallback on malformed local data.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, cycleEntries, mealEntries, reminders }));
  }, [profile, cycleEntries, mealEntries, reminders]);

  const cycleDay = useMemo(() => getCycleDay(profile.lastPeriod), [profile.lastPeriod]);
  const nextPeriod = useMemo(
    () => getNextPeriodDate(profile.lastPeriod, profile.cycleLength),
    [profile.lastPeriod, profile.cycleLength],
  );

  const observedCycleRange = useMemo(() => {
    const data = getObservedCycleData(cycleEntries);
    if (data.length === 0) return [];
    return data.slice(-Math.min(data.length, 6));
  }, [cycleEntries]);

  const cycleChartData = useMemo(() => {
    if (selectedRange === '15d') {
      return [
        { label: 'Day 1', value: 0 },
        { label: 'Day 5', value: 15 },
        { label: 'Day 10', value: 40 },
        { label: 'Day 15', value: 68 },
      ];
    }
    if (selectedRange === '30d') {
      return [
        { label: 'W1', value: 24 },
        { label: 'W2', value: 34 },
        { label: 'W3', value: 42 },
        { label: 'W4', value: 60 },
      ];
    }
    if (selectedRange === '90d') {
      return [
        { label: 'Jan', value: 28 },
        { label: 'Feb', value: 30 },
        { label: 'Mar', value: 29 },
      ];
    }
    return [
      { label: 'Jan', value: 28 },
      { label: 'Feb', value: 31 },
      { label: 'Mar', value: 29 },
      { label: 'Apr', value: 30 },
      { label: 'May', value: 28 },
      { label: 'Jun', value: 32 },
    ];
  }, [selectedRange]);

  const mealTotals = useMemo(() => getLastMealTotals(mealEntries), [mealEntries]);

  const insightList = useMemo(() => {
    const insights: string[] = [];

    if (profile.lastPeriod) {
      insights.push(`Current cycle day ${cycleDay ?? '—'}`);
    }

    if (observedCycleRange.length > 0) {
      const avg = observedCycleRange.reduce((sum, entry) => sum + entry.days, 0) / observedCycleRange.length;
      insights.push(`Average observed cycle length: ${Math.round(avg)} days`);
    }

    if (mealTotals.calories > 0) {
      insights.push(`Meals logged today total ${mealTotals.calories} kcal`);
    }

    if (!profile.lastPeriod && cycleEntries.length === 0) {
      insights.push('Add your first period date to start building cycle patterns.');
    }

    return insights.slice(0, 3);
  }, [cycleDay, cycleEntries.length, mealTotals.calories, observedCycleRange, profile.lastPeriod]);

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    setProfileOpen(false);
  };

  const addCycleEntry = () => {
    const date = newCycleEntry.date || new Date().toISOString().slice(0, 10);
    const nextEntry: CycleEntry = {
      id: `${Date.now()}`,
      date,
      flow: newCycleEntry.flow,
      cramps: Number(newCycleEntry.cramps) || 0,
      mood: newCycleEntry.mood,
      notes: newCycleEntry.notes,
    };

    setCycleEntries((prev) => [...prev, nextEntry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    setNewCycleEntry({
      date: new Date().toISOString().slice(0, 10),
      flow: 'medium',
      cramps: 3,
      mood: 'steady',
      notes: '',
    });

    if (!profile.lastPeriod) {
      setProfile((current) => ({ ...current, lastPeriod: date }));
    }
  };

  const addMealEntry = () => {
    if (!newMealEntry.name.trim()) return;

    const item: MealEntry = {
      id: `${Date.now()}`,
      date: newMealEntry.date,
      name: newMealEntry.name,
      calories: Number(newMealEntry.calories) || 0,
      protein: Number(newMealEntry.protein) || 0,
      carbs: Number(newMealEntry.carbs) || 0,
      fat: Number(newMealEntry.fat) || 0,
    };

    setMealEntries((prev) => [item, ...prev]);
    setNewMealEntry({
      date: new Date().toISOString().slice(0, 10),
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)));
  };

  const renderToday = () => (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-600 to-purple-600 p-5 text-white shadow-[0_20px_40px_rgba(124,93,200,0.35)]">
          <div className="mb-4 flex items-center justify-between text-violet-100">
            <span className="text-sm font-medium">Cycle day</span>
            <MoonStar size={18} />
          </div>
          <div className="mb-2 text-4xl font-semibold">{cycleDay ?? '—'}</div>
          <p className="text-sm text-violet-100">{profile.lastPeriod ? 'Current cycle progression' : 'Add your last period to start tracking'}</p>
        </div>

        <div className="rounded-[28px] border border-emerald-100 bg-white/80 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between text-emerald-700">
            <span className="text-sm font-medium">Weight</span>
            <Weight size={18} />
          </div>
          <div className="text-3xl font-semibold text-slate-900">{profile.weightKg ? `${profile.weightKg} kg` : 'Add weight'}</div>
          <p className="mt-2 text-sm text-slate-500">Track meaningful changes over time.</p>
        </div>

        <div className="rounded-[28px] border border-amber-100 bg-white/80 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between text-amber-700">
            <span className="text-sm font-medium">Nutrition</span>
            <UtensilsCrossed size={18} />
          </div>
          <div className="text-3xl font-semibold text-slate-900">{mealTotals.calories || 0} kcal</div>
          <p className="mt-2 text-sm text-slate-500">Protein {mealTotals.protein || 0}g · Carbs {mealTotals.carbs || 0}g</p>
        </div>

        <div className="rounded-[28px] border border-rose-100 bg-white/80 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between text-rose-500">
            <span className="text-sm font-medium">Next period</span>
            <CalendarDays size={18} />
          </div>
          <div className="text-3xl font-semibold text-slate-900">{nextPeriod ? formatShortDate(nextPeriod.toISOString()) : 'Data needed'}</div>
          <p className="mt-2 text-sm text-slate-500">Estimated window based on your history</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <div className="rounded-[32px] border border-white/70 bg-white/75 p-5 shadow-[0_22px_55px_rgba(121,96,150,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cycle overview</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Pattern prediction</h3>
            </div>
            <div className="flex gap-2 rounded-full bg-slate-100 p-1">
              {cycleRangeOptions.map((range) => (
                <button
                  key={range}
                  onClick={() => setSelectedRange(range)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    selectedRange === range ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cycleChartData}>
                <defs>
                  <linearGradient id="cycleFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={3} fill="url(#cycleFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_20px_45px_rgba(125,96,150,0.08)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick log</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Track today</h3>
              </div>
              <Camera className="text-violet-600" size={20} />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-600">
                Last period start
                <input
                  type="date"
                  value={profile.lastPeriod}
                  onChange={(event) => setProfile((current) => ({ ...current, lastPeriod: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="block text-sm font-medium text-slate-600">
                Weight check-in (kg)
                <input
                  type="number"
                  step="0.1"
                  value={profile.weightKg || ''}
                  onChange={(event) => setProfile((current) => ({ ...current, weightKg: Number(event.target.value) || 0 }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>
            </div>

            <button className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800">
              Save today
            </button>
          </div>

          <div className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 to-rose-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Meal scanner</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Scan your meal</h3>
              </div>
              <div className="rounded-full bg-white p-2 shadow-sm text-violet-600">
                <Salad size={18} />
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Add a meal photo or manual entry to review calories, protein, and your daily trend in a helpful, nonjudgmental way.
            </p>
            <button className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500">
              Add a meal photo
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  const renderCycle = () => (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cycle log</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Record your period and symptoms</h3>
          </div>
          <button
            onClick={() => setProfileOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700"
          >
            <PencilLine size={15} />
            Edit profile
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-600">
            Date
            <input
              type="date"
              value={newCycleEntry.date}
              onChange={(event) => setNewCycleEntry((prev) => ({ ...prev, date: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Flow
            <select
              value={newCycleEntry.flow}
              onChange={(event) => setNewCycleEntry((prev) => ({ ...prev, flow: event.target.value as Flow }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            >
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-600">
            Cramps
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              value={newCycleEntry.cramps}
              onChange={(event) => setNewCycleEntry((prev) => ({ ...prev, cramps: Number(event.target.value) || 0 }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Mood
            <input
              value={newCycleEntry.mood}
              onChange={(event) => setNewCycleEntry((prev) => ({ ...prev, mood: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <div className="flex items-end">
            <button onClick={addCycleEntry} className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800">
              Add log
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-600">
            Notes
            <textarea
              rows={3}
              value={newCycleEntry.notes}
              onChange={(event) => setNewCycleEntry((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">History</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Cycle records</h3>
            </div>
          </div>

          {cycleEntries.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Add your first period log to start understanding your cycle pattern.
            </div>
          ) : (
            <div className="space-y-3">
              {cycleEntries.slice().reverse().map((entry) => (
                <div key={entry.id} className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{formatLongDate(entry.date)}</p>
                      <p className="text-sm text-slate-500">Flow: {entry.flow} · Cramps: {entry.cramps}/10</p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">{entry.mood}</span>
                  </div>
                  {entry.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{entry.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prediction</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Estimated next period</h3>
            </div>
          </div>

          <div className="rounded-[24px] bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
            <div className="text-2xl font-semibold text-slate-900">
              {nextPeriod ? formatLongDate(nextPeriod.toISOString().slice(0, 10)) : 'Waiting for start date'}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This is an estimate based on your entered cycle history and should be reviewed with your own context.
            </p>
          </div>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Observed cycle lengths</p>
            <div className="mt-3 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={observedCycleRange.length > 0 ? observedCycleRange : emptyCycleData}>
                  <CartesianGrid stroke="#eef2ff" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="days" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderNutrition = () => (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Meal log</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Add food and nutrients</h3>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-medium text-slate-600 md:col-span-2">
            Meal name
            <input
              value={newMealEntry.name}
              onChange={(event) => setNewMealEntry((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Date
            <input
              type="date"
              value={newMealEntry.date}
              onChange={(event) => setNewMealEntry((prev) => ({ ...prev, date: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Calories
            <input
              type="number"
              value={newMealEntry.calories || ''}
              onChange={(event) => setNewMealEntry((prev) => ({ ...prev, calories: Number(event.target.value) || 0 }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Protein
            <input
              type="number"
              value={newMealEntry.protein || ''}
              onChange={(event) => setNewMealEntry((prev) => ({ ...prev, protein: Number(event.target.value) || 0 }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Carbs
            <input
              type="number"
              value={newMealEntry.carbs || ''}
              onChange={(event) => setNewMealEntry((prev) => ({ ...prev, carbs: Number(event.target.value) || 0 }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <div className="flex items-end">
            <button onClick={addMealEntry} className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-medium text-white hover:bg-violet-500">
              Save meal
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Daily intake</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Nutrition summary</h3>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Calories', value: `${mealTotals.calories || 0} kcal` },
              { label: 'Protein', value: `${mealTotals.protein || 0} g` },
              { label: 'Carbs', value: `${mealTotals.carbs || 0} g` },
              { label: 'Fat', value: `${mealTotals.fat || 0} g` },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <div className="mt-2 text-xl font-semibold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mealEntries.slice(0, 7).reverse()}>
                <CartesianGrid stroke="#eef2ff" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="protein" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                <Bar dataKey="carbs" fill="#f59e0b" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Meals</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Recent entries</h3>
            </div>
          </div>

          {mealEntries.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No meals logged yet. Add your first meal to start tracking patterns.
            </div>
          ) : (
            <div className="space-y-3">
              {mealEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800">{entry.name}</p>
                    <span className="text-sm text-slate-500">{entry.calories} kcal</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{formatShortDate(entry.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderInsights = () => (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Insights</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Your data, explained</h3>
          </div>
        </div>

        <div className="space-y-3">
          {insightList.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Start logging cycle and nutrition data to generate useful observations.
            </div>
          ) : (
            insightList.map((item) => (
              <div key={item} className="flex gap-3 rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );

  const renderReminders = () => (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reminders</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Check-ins and care prompts</h3>
          </div>
        </div>

        <div className="space-y-3">
          {reminders.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-100 bg-slate-50/70 p-3">
              <div>
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-sm text-slate-500">{item.detail}</p>
              </div>
              <button
                onClick={() => toggleReminder(item.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item.enabled ? 'On' : 'Off'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] text-slate-800">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-4 sm:px-4 lg:px-6">
        <aside className="hidden min-h-[calc(100vh-2rem)] w-[260px] shrink-0 rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_20px_60px_rgba(118,95,146,0.12)] backdrop-blur-xl lg:flex lg:flex-col">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-300 text-lg font-bold text-white shadow-lg shadow-violet-200">
              B
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-600">BloomWell</p>
              <h1 className="text-lg font-semibold text-slate-900">Your health space</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {tabs.map((label) => {
              const active = activeTab === label;
              const Icon =
                label === 'Today'
                  ? Sparkles
                  : label === 'Cycle'
                    ? MoonStar
                    : label === 'Nutrition'
                      ? Salad
                      : label === 'Insights'
                        ? Activity
                        : Bell;

              return (
                <button
                  key={label}
                  onClick={() => setActiveTab(label)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    active ? 'bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {label}
                  </span>
                  <ChevronRight size={16} className={active ? 'opacity-100' : 'opacity-0'} />
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 to-rose-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-violet-700">
              <Target size={16} />
              <span className="text-sm font-semibold">Care note</span>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Your data stays on your device here, and you can add or update details anytime without pressure or guesswork.
            </p>
          </div>
        </aside>

        <main className="flex-1 pb-24 lg:pb-10">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/60 p-4 shadow-[0_20px_50px_rgba(135,116,170,0.09)] backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Welcome</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  {profile.name ? `${profile.name}, here’s your health snapshot` : 'Here’s your health snapshot'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50">
                  <Bell size={18} />
                </button>
                <button
                  onClick={() => setProfileOpen(true)}
                  className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 pr-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-rose-300 font-medium text-white">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-700">{profile.name || 'Your profile'}</p>
                    <p className="text-[11px] text-slate-500">Update details</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                    activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </header>

          {activeTab === 'Today' && renderToday()}
          {activeTab === 'Cycle' && renderCycle()}
          {activeTab === 'Nutrition' && renderNutrition()}
          {activeTab === 'Insights' && renderInsights()}
          {activeTab === 'Reminders' && renderReminders()}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/70 bg-white/80 p-3 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around gap-2">
          {tabs.map((tab) => {
            const Icon =
              tab === 'Today'
                ? Sparkles
                : tab === 'Cycle'
                  ? MoonStar
                  : tab === 'Nutrition'
                    ? Salad
                    : tab === 'Insights'
                      ? Activity
                      : Bell;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-medium transition ${
                  activeTab === tab ? 'bg-violet-50 text-violet-700' : 'text-slate-500'
                }`}
              >
                <Icon size={18} />
                {tab}
              </button>
            );
          })}
        </div>
      </nav>

      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Profile</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">Personal details</h3>
              </div>
              <button onClick={() => setProfileOpen(false)} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                Close
              </button>
            </div>

            <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                Name
                <input
                  value={profile.name}
                  onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="text-sm font-medium text-slate-600">
                Date of birth
                <input
                  type="date"
                  value={profile.dob}
                  onChange={(event) => setProfile((current) => ({ ...current, dob: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="text-sm font-medium text-slate-600">
                Cycle length (days)
                <input
                  type="number"
                  min={20}
                  max={60}
                  value={profile.cycleLength}
                  onChange={(event) => setProfile((current) => ({ ...current, cycleLength: Number(event.target.value) || 28 }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="text-sm font-medium text-slate-600">
                Period duration (days)
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={profile.periodLength}
                  onChange={(event) => setProfile((current) => ({ ...current, periodLength: Number(event.target.value) || 5 }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="text-sm font-medium text-slate-600">
                Height (cm)
                <input
                  type="number"
                  min={80}
                  max={220}
                  value={profile.heightCm || ''}
                  onChange={(event) => setProfile((current) => ({ ...current, heightCm: Number(event.target.value) || 0 }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="text-sm font-medium text-slate-600">
                Weight (kg)
                <input
                  type="number"
                  min={30}
                  max={250}
                  step="0.1"
                  value={profile.weightKg || ''}
                  onChange={(event) => setProfile((current) => ({ ...current, weightKg: Number(event.target.value) || 0 }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="text-sm font-medium text-slate-600 md:col-span-2">
                Time zone
                <input
                  value={profile.timezone}
                  onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setProfileOpen(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700">
                  Cancel
                </button>
                <button type="submit" className="rounded-full bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-800">
                  Save profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatLongDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}
'''

Path('c:/BLOOMWELL/app/page.tsx').write_text(content, encoding='utf-8')
print('updated page.tsx')

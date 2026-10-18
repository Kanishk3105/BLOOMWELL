
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { loadLocalUserData, saveLocalUserData, LOCAL_USER_DATA_KEY, LEGACY_USER_DATA_KEY } from '@/lib/local-user-data';
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

type Tab = 'Today' | 'Cycle' | 'Nutrition' | 'Insights' | 'Health' | 'Reminders' | 'Profile';
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
  conditions: string;
  notes: string;
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
  vitamins: string;
  estimateConfidence?: AnalysisConfidence;
  estimateAssumptions?: string;
  nutritionSource?: NutritionSource;
};

type AnalysisConfidence = 'low' | 'medium' | 'high';

type NutritionSource =
  | 'manual'
  | 'generic-estimate'
  | 'adjusted-estimate'
  | 'ai-estimate'
  | 'adjusted-ai-estimate';

type MealAnalysisResult = {
  detected: true;
  mealName: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  potentialNutrients: string[];
  confidence: AnalysisConfidence;
  assumptions: string;
};

type MealEstimateDetails = Pick<MealAnalysisResult, 'confidence' | 'assumptions'>;

type MealPreset = Omit<MealEntry, 'id' | 'date' | 'nutritionSource'> & {
  id: string;
};

type Reminder = {
  id: string;
  title: string;
  detail: string;
  enabled: boolean;
};

const MAX_MEAL_IMAGE_BYTES = 8 * 1024 * 1024;
const tabs: Tab[] = ['Today', 'Cycle', 'Nutrition', 'Insights', 'Health', 'Reminders', 'Profile'];
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
  conditions: '',
  notes: '',
};

const defaultReminders: Reminder[] = [
  { id: 'checkin', title: 'Cycle check-in', detail: 'Log symptoms before tonight', enabled: true },
  { id: 'weight', title: 'Weight check-in', detail: 'Record your latest weight', enabled: true },
  { id: 'doctor', title: 'Doctor follow-up', detail: 'Review symptoms and questions', enabled: false },
];

const emptyCycleData = [{ label: 'No data', days: 0 }];

function formatShortDate(value: string) {
  if (!value) return '—';
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date) : '—';
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDate(value: string) {
  if (!value) return null;
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateParts) {
    const [, year, month, day] = dateParts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
      ? date
      : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCycleDay(lastPeriod: string) {
  if (!lastPeriod) return null;
  const start = toDate(lastPeriod);
  if (!start) return null;
  const now = new Date();
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const cycleDay = Math.round((currentDay - startDay) / (1000 * 60 * 60 * 24)) + 1;
  return cycleDay > 0 ? cycleDay : null;
}

function getNextPeriodDate(lastPeriod: string, cycleLength: number) {
  if (!lastPeriod) return null;
  const start = toDate(lastPeriod);
  if (!start || !Number.isFinite(cycleLength) || cycleLength < 1) return null;
  const cycleLengthDays = Math.round(cycleLength);
  if (cycleLengthDays < 1) return null;

  const today = new Date();
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysSinceStart = Math.floor((currentDay - startDay) / (1000 * 60 * 60 * 24));
  const cyclesToAdd = daysSinceStart >= 0 ? Math.floor(daysSinceStart / cycleLengthDays) + 1 : 1;
  const date = new Date(start);
  date.setDate(date.getDate() + cyclesToAdd * cycleLengthDays);
  return date;
}

function getObservedCycleData(entries: CycleEntry[]) {
  const sortedDates = [...new Set(entries.map((entry) => entry.date))].sort();
  if (sortedDates.length < 2) return [];

  const periodStarts: Date[] = [];
  let previousDate: Date | null = null;

  for (const value of sortedDates) {
    const date = toDate(value);
    if (!date) continue;
    const dateIndex = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const previousIndex = previousDate
      ? Date.UTC(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate())
      : null;

    if (previousIndex === null || dateIndex - previousIndex > 1000 * 60 * 60 * 24) {
      periodStarts.push(date);
    }

    previousDate = date;
  }

  const data: { label: string; days: number }[] = [];

  for (let i = 1; i < periodStarts.length; i += 1) {
    const prev = periodStarts[i - 1];
    const curr = periodStarts[i];
    const prevDay = Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate());
    const currDay = Date.UTC(curr.getFullYear(), curr.getMonth(), curr.getDate());
    const diffDays = Math.round((currDay - prevDay) / (1000 * 60 * 60 * 24));
    data.push({
      label: new Intl.DateTimeFormat('en', { month: 'short' }).format(curr),
      days: diffDays,
    });
  }

  return data;
}

function getCycleForecastData(lastPeriod: string, cycleLength: number, range: string) {
  const start = toDate(lastPeriod);
  if (!start || !Number.isFinite(cycleLength) || cycleLength < 1) return [];
  const cycleLengthDays = Math.round(cycleLength);
  if (cycleLengthDays < 1) return [];

  const rangeDays: Record<string, number> = { '15d': 15, '30d': 30, '90d': 90, '1y': 365 };
  const dayCount = rangeDays[range] ?? rangeDays['15d'];
  const today = new Date();
  const todayIndex = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startIndex = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  if (startIndex > todayIndex) return [];

  return Array.from({ length: dayCount }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const dateIndex = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const daysSinceStart = Math.floor((dateIndex - startIndex) / (1000 * 60 * 60 * 24));
    const cycleDay = (daysSinceStart % cycleLengthDays) + 1;
    return { label: formatShortDate(getLocalDateInputValue(date)), value: cycleDay };
  });
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

function getMealTotalsForDate(entries: MealEntry[], date: string) {
  return getLastMealTotals(entries.filter((entry) => entry.date === date));
}

const mealPresets: MealPreset[] = [
  {
    id: 'salad',
    name: 'Salad with grains and vegetables',
    calories: 420,
    protein: 24,
    carbs: 35,
    fat: 18,
    vitamins: 'Potential sources: vitamin C, folate, vitamin K',
  },
  {
    id: 'pasta',
    name: 'Pasta with sauce',
    calories: 560,
    protein: 28,
    carbs: 68,
    fat: 21,
    vitamins: 'Potential sources: B vitamins, iron, folate',
  },
  {
    id: 'smoothie',
    name: 'Fruit smoothie',
    calories: 310,
    protein: 18,
    carbs: 42,
    fat: 8,
    vitamins: 'Potential sources: vitamin C, potassium, folate',
  },
  {
    id: 'eggs',
    name: 'Eggs with toast',
    calories: 390,
    protein: 22,
    carbs: 34,
    fat: 17,
    vitamins: 'Potential sources: vitamin B12, choline, vitamin D',
  },
  {
    id: 'chicken-rice',
    name: 'Chicken with rice',
    calories: 640,
    protein: 42,
    carbs: 58,
    fat: 23,
    vitamins: 'Potential sources: vitamin B6, iron, niacin',
  },
  {
    id: 'fish',
    name: 'Fish with vegetables',
    calories: 480,
    protein: 36,
    carbs: 28,
    fat: 20,
    vitamins: 'Potential sources: vitamin D, vitamin B12, selenium',
  },
  {
    id: 'beans',
    name: 'Beans or lentils with rice',
    calories: 520,
    protein: 22,
    carbs: 78,
    fat: 10,
    vitamins: 'Potential sources: folate, iron, magnesium',
  },
  {
    id: 'sandwich',
    name: 'Sandwich',
    calories: 450,
    protein: 24,
    carbs: 48,
    fat: 18,
    vitamins: 'Potential sources vary by filling and bread',
  },
  {
    id: 'yogurt',
    name: 'Yogurt with fruit',
    calories: 280,
    protein: 16,
    carbs: 38,
    fat: 7,
    vitamins: 'Potential sources: calcium, vitamin B12, vitamin C',
  },
  {
    id: 'soup',
    name: 'Vegetable soup',
    calories: 260,
    protein: 10,
    carbs: 38,
    fat: 8,
    vitamins: 'Potential sources vary by ingredients',
  },
  {
    id: 'pizza',
    name: 'Pizza',
    calories: 620,
    protein: 26,
    carbs: 72,
    fat: 24,
    vitamins: 'Nutrient content varies by toppings and portion',
  },
];

function BloomWellDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('Today');
  const [selectedRange, setSelectedRange] = useState<string>('15d');
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [cycleEntries, setCycleEntries] = useState<CycleEntry[]>([]);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>(defaultReminders);
  const [localDataLoaded, setLocalDataLoaded] = useState(false);
  const [localDataError, setLocalDataError] = useState('');
  const [localLoadAttempt, setLocalLoadAttempt] = useState(0);
  const [localDataSaveState, setLocalDataSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [localDataSaveError, setLocalDataSaveError] = useState('');
  const [todaySaveMessage, setTodaySaveMessage] = useState('');
  const [saveAttempt, setSaveAttempt] = useState(0);
  const saveTodayRequested = useRef(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mealImagePreview, setMealImagePreview] = useState<string | null>(null);
  const [mealEstimateDetails, setMealEstimateDetails] = useState<MealEstimateDetails | null>(null);
  const [mealPhotoError, setMealPhotoError] = useState('');
  const [selectedMealPreset, setSelectedMealPreset] = useState('');
  const [newCycleEntry, setNewCycleEntry] = useState({
    date: getLocalDateInputValue(),
    flow: 'medium' as Flow,
    cramps: 3,
    mood: 'steady',
    notes: '',
  });
  const [newMealEntry, setNewMealEntry] = useState({
    date: getLocalDateInputValue(),
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    vitamins: '',
    nutritionSource: 'manual' as NutritionSource,
  });
  useEffect(() => {
    return () => {
      if (mealImagePreview) URL.revokeObjectURL(mealImagePreview);
    };
  }, [mealImagePreview]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      try {
        const restored = loadLocalUserData(window.localStorage);
        if (!active) return;
        setProfile({ ...defaultProfile, ...restored.profile });
        setCycleEntries(restored.cycleEntries ?? []);
        setMealEntries(restored.mealEntries ?? []);
        setReminders(restored.reminders ?? defaultReminders);
        setLocalDataLoaded(true);
      } catch (error) {
        if (active) {
          setLocalDataError(
            error instanceof Error
              ? `Could not read this device’s BloomWell data: ${error.message}`
              : 'Could not read this device’s BloomWell data.',
          );
        }
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [localLoadAttempt]);

  useEffect(() => {
    if (!localDataLoaded || localDataError) return;

    const timer = window.setTimeout(() => {
      setLocalDataSaveState('saving');
      setLocalDataSaveError('');
      try {
        saveLocalUserData(window.localStorage, { profile, cycleEntries, mealEntries, reminders });
        setLocalDataSaveState('saved');
        if (saveTodayRequested.current) {
          setTodaySaveMessage('Today’s check-in is saved on this device.');
          saveTodayRequested.current = false;
        }
      } catch (error) {
        setLocalDataSaveError(error instanceof Error ? error.message : 'Could not save this device’s data.');
        setLocalDataSaveState('idle');
        if (saveTodayRequested.current) {
          setTodaySaveMessage('This check-in was not saved. Check available device storage and retry.');
          saveTodayRequested.current = false;
        }
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, [profile, cycleEntries, mealEntries, reminders, localDataLoaded, localDataError, saveAttempt]);

  const observedCycleRange = useMemo(() => {
    const data = getObservedCycleData(cycleEntries);
    if (data.length === 0) return [];
    return data.slice(-Math.min(data.length, 6));
  }, [cycleEntries]);

  const observedAverageCycleLength = useMemo(() => {
    if (observedCycleRange.length === 0) return null;
    const average =
      observedCycleRange.reduce((sum, entry) => sum + entry.days, 0) / observedCycleRange.length;
    return Math.round(average);
  }, [observedCycleRange]);
  const forecastCycleLength = observedAverageCycleLength ?? profile.cycleLength;
  const cycleDay = useMemo(() => getCycleDay(profile.lastPeriod), [profile.lastPeriod]);
  const nextPeriod = useMemo(
    () => getNextPeriodDate(profile.lastPeriod, forecastCycleLength),
    [forecastCycleLength, profile.lastPeriod],
  );
  const cycleChartData = useMemo(
    () => getCycleForecastData(profile.lastPeriod, forecastCycleLength, selectedRange),
    [forecastCycleLength, profile.lastPeriod, selectedRange],
  );

  const today = getLocalDateInputValue();
  const mealTotals = useMemo(
    () => getMealTotalsForDate(mealEntries, today),
    [mealEntries, today],
  );

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

  const exportUserData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      profile,
      cycleEntries,
      mealEntries,
      reminders,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bloomwell-data-${getLocalDateInputValue()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearLocalData = () => {
    if (!window.confirm('Permanently clear BloomWell health records saved on this device? This cannot be undone. Export a backup first if you need one.')) {
      return;
    }

    try {
      window.localStorage.removeItem(LOCAL_USER_DATA_KEY);
      window.localStorage.removeItem(LEGACY_USER_DATA_KEY);
      setProfile(defaultProfile);
      setCycleEntries([]);
      setMealEntries([]);
      setReminders(defaultReminders);
      setLocalDataSaveError('');
      setLocalDataSaveState('saved');
      setTodaySaveMessage('Local BloomWell records were cleared from this device.');
    } catch (error) {
      setLocalDataSaveError(error instanceof Error ? error.message : 'Could not clear local data.');
    }
  };

  const addCycleEntry = () => {
    const date = newCycleEntry.date || getLocalDateInputValue();
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
      date: getLocalDateInputValue(),
      flow: 'medium',
      cramps: 3,
      mood: 'steady',
      notes: '',
    });

    if (!profile.lastPeriod) {
      setProfile((current) => ({ ...current, lastPeriod: date }));
    }
  };

  const handleMealImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setMealImagePreview(null);
    setMealPhotoError('');
    setMealEstimateDetails(null);
    setSelectedMealPreset('');

    setNewMealEntry((current) => {
      if (current.nutritionSource === 'manual') return current;
      return {
        ...current,
        name: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        vitamins: '',
        nutritionSource: 'manual',
      };
    });

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMealPhotoError('Please choose an image file.');
      return;
    }

    if (file.size > MAX_MEAL_IMAGE_BYTES) {
      setMealPhotoError('Choose an image smaller than 8 MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMealPhotoError('Use a JPEG, PNG, or WebP image.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setMealImagePreview(objectUrl);
  };

  const applyMealPreset = () => {
    const preset = mealPresets.find((item) => item.id === selectedMealPreset);
    if (!preset) return;

    setNewMealEntry((current) => ({
      ...current,
      name: preset.name,
      calories: preset.calories,
      protein: preset.protein,
      carbs: preset.carbs,
      fat: preset.fat,
      vitamins: preset.vitamins,
      nutritionSource: 'generic-estimate',
    }));
    setMealEstimateDetails(null);
  };

  const updateMealNutrition = (
    changes: Partial<Pick<typeof newMealEntry, 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'vitamins'>>,
  ) => {
    setNewMealEntry((current) => ({
      ...current,
      ...changes,
      nutritionSource: current.nutritionSource === 'generic-estimate'
        ? 'adjusted-estimate'
        : current.nutritionSource === 'ai-estimate'
          ? 'adjusted-ai-estimate'
          : current.nutritionSource,
    }));
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
      vitamins: newMealEntry.vitamins || 'Not entered',
      nutritionSource: newMealEntry.nutritionSource,
      estimateConfidence: mealEstimateDetails?.confidence,
      estimateAssumptions: mealEstimateDetails?.assumptions,
    };

    setMealEntries((prev) => [item, ...prev]);
    setNewMealEntry({
      date: getLocalDateInputValue(),
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      vitamins: '',
      nutritionSource: 'manual',
    });
    setSelectedMealPreset('');
    setMealEstimateDetails(null);
    setMealImagePreview(null);
    setMealPhotoError('');
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
          <div className="text-3xl font-semibold text-slate-900">
            {nextPeriod ? formatShortDate(getLocalDateInputValue(nextPeriod)) : 'Data needed'}
          </div>
          <p className="mt-2 text-sm text-slate-500">Estimated window based on your history</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <div className="rounded-[32px] border border-white/70 bg-white/75 p-5 shadow-[0_22px_55px_rgba(121,96,150,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cycle overview</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Cycle forecast</h3>
              <p className="mt-1 text-xs text-slate-500">Estimated cycle day using your entered dates and cycle length.</p>
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
            {cycleChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center text-sm leading-6 text-slate-500">
                Add a valid last period start date to see a cycle forecast based on your own details.
              </div>
            ) : (
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
                  <YAxis
                    domain={[1, 'dataMax']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    label={{ value: 'Cycle day', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                  />
                  <Tooltip formatter={(value) => [`Cycle day ${value}`, 'Estimate']} />
                  <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={3} fill="url(#cycleFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
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
                  onChange={(event) => {
                    setProfile((current) => ({ ...current, lastPeriod: event.target.value }));
                    setTodaySaveMessage('');
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>

              <label className="block text-sm font-medium text-slate-600">
                Weight check-in (kg)
                <input
                  type="number"
                  step="0.1"
                  value={profile.weightKg || ''}
                  onChange={(event) => {
                    setProfile((current) => ({ ...current, weightKg: Number(event.target.value) || 0 }));
                    setTodaySaveMessage('');
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                saveTodayRequested.current = true;
                setTodaySaveMessage('Saving this check-in to your BloomWell account…');
                setSaveAttempt((attempt) => attempt + 1);
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800"
            >
              Save today
            </button>
            {todaySaveMessage ? <p role="status" className="mt-2 text-center text-sm text-emerald-700">{todaySaveMessage}</p> : null}
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
            <button
              type="button"
              onClick={() => setActiveTab('Nutrition')}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500"
            >
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
              {nextPeriod ? formatLongDate(getLocalDateInputValue(nextPeriod)) : 'Waiting for start date'}
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

        <div className="mb-5 rounded-[24px] border border-violet-100 bg-violet-50/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-600">Optional meal photo analysis</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-900">Capture image</h4>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-500">
              Preview photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={handleMealImageUpload}
              />
            </label>
          </div>

          <p role="status" className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-sm leading-6 text-slate-700">
            Photo preview stays on this device. Automatic photo analysis needs a remote service and is unavailable in this local-only app. Use manual entry or a typical-meal estimate instead.
          </p>

          {mealImagePreview ? (
            <div className="mt-3 overflow-hidden rounded-[20px] border border-violet-200 bg-white">
              <Image
                src={mealImagePreview}
                alt="Meal preview"
                width={960}
                height={320}
                unoptimized
                className="h-48 w-full object-cover"
              />
            </div>
          ) : null}

          {mealImagePreview ? (
            <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-sm leading-6 text-slate-700">
              Photo preview is local only and has not been uploaded. Nutrition estimates remain manual or typical-meal estimates.
            </p>
          ) : null}
          {mealPhotoError ? <p role="alert" className="mt-2 text-sm font-medium text-rose-700">{mealPhotoError}</p> : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium text-slate-600">
              Optional generic estimate
              <select
                value={selectedMealPreset}
                onChange={(event) => setSelectedMealPreset(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300"
              >
                <option value="">Choose a typical meal</option>
                {mealPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={applyMealPreset}
              disabled={!selectedMealPreset}
              className="self-end rounded-2xl bg-violet-100 px-4 py-3 font-medium text-violet-800 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use estimate
            </button>
          </div>

          {newMealEntry.nutritionSource !== 'manual' ? (
            <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {newMealEntry.nutritionSource === 'generic-estimate'
                      ? 'Generic estimate · typical serving'
                      : newMealEntry.nutritionSource === 'adjusted-estimate'
                        ? 'Adjusted generic estimate'
                        : newMealEntry.nutritionSource === 'ai-estimate'
                          ? 'Gemini estimate · review before saving'
                          : 'Adjusted Gemini estimate'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Approximate values only. Actual nutrition varies with portion size, ingredients, and preparation.
                  </p>
                  {mealEstimateDetails ? (
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      Confidence: {mealEstimateDetails.confidence}. {mealEstimateDetails.assumptions}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Calories', value: `${newMealEntry.calories} kcal` },
                  { label: 'Protein', value: `${newMealEntry.protein} g` },
                  { label: 'Carbs', value: `${newMealEntry.carbs} g` },
                  { label: 'Fat', value: `${newMealEntry.fat} g` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-amber-800">{item.label}</p>
                    <p className="mt-1 font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-900">{newMealEntry.vitamins}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-medium text-slate-600 md:col-span-2">
            Meal name
            <input
              value={newMealEntry.name}
              onChange={(event) => updateMealNutrition({ name: event.target.value })}
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
              min={0}
              value={newMealEntry.calories || ''}
              onChange={(event) => updateMealNutrition({ calories: Number(event.target.value) || 0 })}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Protein
            <input
              type="number"
              min={0}
              step="0.1"
              value={newMealEntry.protein || ''}
              onChange={(event) => updateMealNutrition({ protein: Number(event.target.value) || 0 })}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Carbs
            <input
              type="number"
              min={0}
              step="0.1"
              value={newMealEntry.carbs || ''}
              onChange={(event) => updateMealNutrition({ carbs: Number(event.target.value) || 0 })}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600">
            Fat
            <input
              type="number"
              min={0}
              step="0.1"
              value={newMealEntry.fat || ''}
              onChange={(event) => updateMealNutrition({ fat: Number(event.target.value) || 0 })}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="text-sm font-medium text-slate-600 md:col-span-2 xl:col-span-3">
            Vitamins / nutrients
            <input
              value={newMealEntry.vitamins}
              onChange={(event) => updateMealNutrition({ vitamins: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <div className="flex items-end md:col-span-2 xl:col-span-3">
            <button
              type="button"
              onClick={addMealEntry}
              disabled={!newMealEntry.name.trim()}
              className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">{entry.name}</p>
                    <span className="text-sm text-slate-500">{entry.calories} kcal</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{formatShortDate(entry.date)}</span>
                    {entry.nutritionSource === 'generic-estimate' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Generic estimate</span>
                    ) : null}
                    {entry.nutritionSource === 'adjusted-estimate' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Adjusted estimate</span>
                    ) : null}
                    {entry.nutritionSource === 'ai-estimate' ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">Gemini estimate</span>
                    ) : null}
                    {entry.nutritionSource === 'adjusted-ai-estimate' ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">Adjusted Gemini estimate</span>
                    ) : null}
                  </div>
                  {entry.estimateConfidence ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Gemini confidence: {entry.estimateConfidence}
                      {entry.estimateAssumptions ? ` · ${entry.estimateAssumptions}` : ''}
                    </p>
                  ) : null}
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

  const renderHealth = () => (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">My health</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Conditions, symptoms, and care notes</h3>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600">
            Conditions or diagnoses
            <textarea
              rows={4}
              value={profile.conditions}
              onChange={(event) => setProfile((current) => ({ ...current, conditions: event.target.value }))}
              placeholder="PCOS, thyroid, anemia, endometriosis, etc."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>

          <label className="block text-sm font-medium text-slate-600">
            Notes for your clinician
            <textarea
              rows={4}
              value={profile.notes}
              onChange={(event) => setProfile((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Symptoms, questions, recent changes, doctors, medications..."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Check-in</p>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{profile.conditions ? 'Recorded' : 'No entries yet'}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Add conditions or symptom patterns to keep your care history organized.</p>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Symptoms</p>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{cycleEntries.length}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your cycle logs give you a timeline of symptoms and patterns to review.</p>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Care note</p>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{profile.notes ? 'Saved' : 'Add note'}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Keep appointment questions, medication notes, and symptom changes in one place.</p>
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

  const renderProfile = () => (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Account and data</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your health records are stored only in this browser or installed app on this device. They do not sync to other devices. Clearing app data or uninstalling BloomWell can permanently remove them.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={exportUserData} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Export my data
          </button>
          <button type="button" onClick={clearLocalData} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">
            Clear data on this device
          </button>
        </div>
      </section>
      <section className="rounded-[30px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_60px_rgba(118,107,155,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Profile</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Your details</h3>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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

          <label className="text-sm font-medium text-slate-600 md:col-span-2">
            Time zone
            <input
              value={profile.timezone}
              onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </label>
        </div>
      </section>
    </div>
  );

  if (!localDataLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff8fb,_#f8f4ff_38%,_#f5f7ff_100%)] p-5">
        <section className="w-full max-w-xl rounded-[32px] border border-white bg-white/90 p-7 shadow-[0_24px_70px_rgba(118,95,146,0.14)]">
          {localDataError ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Could not load this device’s records</h1>
              <p role="alert" className="mt-3 text-sm leading-6 text-rose-700">{localDataError}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">BloomWell did not replace the saved data. Check device storage availability, then retry.</p>
              <button type="button" onClick={() => { setLocalDataError(''); setLocalLoadAttempt((attempt) => attempt + 1); }} className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 font-medium text-white">
                Try again
              </button>
            </>
          ) : (
            <p role="status" className="text-sm text-slate-600">Loading records stored on this device…</p>
          )}
        </section>
      </main>
    );
  }

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
                        : label === 'Health'
                          ? HeartPulse
                          : label === 'Profile'
                            ? Settings
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
              Your records stay on this device. Anyone with access to this device or its unlocked app profile may be able to open them.
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
                <button
                  type="button"
                  aria-label="Open reminders"
                  onClick={() => setActiveTab('Reminders')}
                  className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50"
                >
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>{localDataSaveState === 'saving' ? 'Saving on this device…' : localDataSaveState === 'saved' ? 'Saved on this device' : 'Device storage ready'}</span>
              <span>Local only · no account sync</span>
            </div>
          </header>

          {localDataSaveError ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>Could not save your local records: {localDataSaveError}</span>
              <button type="button" onClick={() => setSaveAttempt((attempt) => attempt + 1)} className="rounded-full bg-white px-3 py-1.5 font-medium text-rose-700">
                Retry save
              </button>
            </div>
          ) : null}

          {todaySaveMessage ? <p role="status" className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{todaySaveMessage}</p> : null}
          {activeTab === 'Today' && renderToday()}
          {activeTab === 'Cycle' && renderCycle()}
          {activeTab === 'Nutrition' && renderNutrition()}
          {activeTab === 'Insights' && renderInsights()}
          {activeTab === 'Health' && renderHealth()}
          {activeTab === 'Reminders' && renderReminders()}
          {activeTab === 'Profile' && renderProfile()}
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-white/70 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Profile</p>
                <h3 id="profile-dialog-title" className="mt-1 text-xl font-semibold text-slate-900">Personal details</h3>
              </div>
              <button type="button" onClick={() => setProfileOpen(false)} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
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

export default function Home() {
  return <BloomWellDashboard />;
}

function formatLongDate(value: string) {
  if (!value) return '—';
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '—';
}

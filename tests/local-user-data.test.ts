import { describe, expect, it } from 'vitest';
import {
  loadLocalUserData,
  LOCAL_USER_DATA_KEY,
  LEGACY_USER_DATA_KEY,
  saveLocalUserData,
} from '../lib/local-user-data';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('device-only health record storage', () => {
  it('saves and reloads records across app restarts using persistent local storage', () => {
    const storage = createMemoryStorage();
    const record = {
      profile: { name: 'Asha', weightKg: 61.5 },
      cycleEntries: [{ id: 'cycle-1', date: '2026-10-01', flow: 'medium' as const, cramps: 2, mood: 'steady', notes: '' }],
      mealEntries: [{
        id: 'meal-1',
        date: '2026-10-18',
        name: 'Dal',
        calories: 420,
        protein: 20,
        carbs: 62,
        fat: 9,
        vitamins: 'Potential sources: folate and iron',
        nutritionSource: 'manual' as const,
      }],
      reminders: [{ id: 'checkin', title: 'Cycle check-in', detail: 'Log symptoms', enabled: false }],
    };

    saveLocalUserData(storage, record);

    expect(loadLocalUserData(storage)).toEqual(record);
    expect(storage.getItem(LOCAL_USER_DATA_KEY)).not.toBeNull();
  });

  it('preserves and merges legacy local records without deleting the old copy', () => {
    const oldValue = JSON.stringify({
      profile: { name: 'Old local profile', notes: 'Old notes' },
      cycleEntries: [{ id: 'cycle-old', date: '2026-09-01', flow: 'light', cramps: 0, mood: 'calm', notes: '' }],
    });
    const currentValue = JSON.stringify({
      profile: { name: 'Current local profile' },
      mealEntries: [{
        id: 'meal-current',
        date: '2026-10-18',
        name: 'Rice',
        calories: 200,
        protein: 4,
        carbs: 40,
        fat: 1,
        vitamins: '',
      }],
    });
    const storage = createMemoryStorage({
      [LEGACY_USER_DATA_KEY]: oldValue,
      [LOCAL_USER_DATA_KEY]: currentValue,
    });

    const loaded = loadLocalUserData(storage);

    expect(loaded.profile).toEqual({ name: 'Current local profile', notes: 'Old notes' });
    expect(loaded.cycleEntries?.[0].id).toBe('cycle-old');
    expect(loaded.mealEntries?.[0].id).toBe('meal-current');
    expect(storage.getItem(LEGACY_USER_DATA_KEY)).toBe(oldValue);
  });

  it('rejects malformed records instead of treating them as empty data', () => {
    const malformed = '{not-json';
    const storage = createMemoryStorage({ [LOCAL_USER_DATA_KEY]: malformed });

    expect(() => loadLocalUserData(storage)).toThrow();
    expect(storage.getItem(LOCAL_USER_DATA_KEY)).toBe(malformed);
  });
});

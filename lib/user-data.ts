import { z } from 'zod';

export const savedUserDataSchema = z.object({
  profile: z.object({
    name: z.string().optional(),
    dob: z.string().optional(),
    cycleLength: z.number().optional(),
    periodLength: z.number().optional(),
    lastPeriod: z.string().optional(),
    weightKg: z.number().optional(),
    heightCm: z.number().optional(),
    timezone: z.string().optional(),
    conditions: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  cycleEntries: z.array(z.object({
    id: z.string(),
    date: z.string(),
    flow: z.enum(['light', 'medium', 'heavy']),
    cramps: z.number(),
    mood: z.string(),
    notes: z.string(),
  })).optional(),
  mealEntries: z.array(z.object({
    id: z.string(),
    date: z.string(),
    name: z.string(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    vitamins: z.string(),
    estimateConfidence: z.enum(['low', 'medium', 'high']).optional(),
    estimateAssumptions: z.string().optional(),
    nutritionSource: z.enum([
      'manual',
      'generic-estimate',
      'adjusted-estimate',
      'ai-estimate',
      'adjusted-ai-estimate',
    ]).optional(),
  })).optional(),
  reminders: z.array(z.object({
    id: z.string(),
    title: z.string(),
    detail: z.string(),
    enabled: z.boolean(),
  })).optional(),
});

export type SavedUserData = z.infer<typeof savedUserDataSchema>;

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

export function mergeSavedUserData(current: SavedUserData, incoming: SavedUserData): SavedUserData {
  return {
    profile: { ...current.profile, ...incoming.profile },
    cycleEntries: mergeById(current.cycleEntries ?? [], incoming.cycleEntries ?? []),
    mealEntries: mergeById(current.mealEntries ?? [], incoming.mealEntries ?? []),
    reminders: mergeById(current.reminders ?? [], incoming.reminders ?? []),
  };
}

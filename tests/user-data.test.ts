import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { mergeSavedUserData, savedUserDataSchema } from '../lib/user-data';

describe('BloomWell account data', () => {
  it('accepts an empty new account record', () => {
    expect(savedUserDataSchema.parse({})).toEqual({});
  });

  it('validates and retains profile, cycle, meal, and reminder records', () => {
    const result = savedUserDataSchema.parse({
      profile: { name: 'Sam', cycleLength: 30 },
      cycleEntries: [{ id: 'cycle-1', date: '2026-10-01', flow: 'medium', cramps: 2, mood: 'steady', notes: '' }],
      mealEntries: [{
        id: 'meal-1',
        date: '2026-10-18',
        name: 'Lentils',
        calories: 450,
        protein: 22,
        carbs: 70,
        fat: 9,
        vitamins: 'Potential sources: folate and iron',
        nutritionSource: 'manual',
      }],
      reminders: [{ id: 'check-in', title: 'Cycle check-in', detail: 'Log symptoms', enabled: true }],
    });

    expect(result.profile?.name).toBe('Sam');
    expect(result.cycleEntries?.[0].flow).toBe('medium');
    expect(result.mealEntries?.[0].calories).toBe(450);
    expect(result.reminders?.[0].enabled).toBe(true);
  });

  it('rejects malformed health records instead of silently replacing them', () => {
    const result = savedUserDataSchema.safeParse({
      cycleEntries: [{ id: 'cycle-1', date: '2026-10-01', flow: 'unknown', cramps: 2, mood: 'steady', notes: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('merges old device records without discarding account records', () => {
    const merged = mergeSavedUserData(
      {
        profile: { name: 'Account name', conditions: 'Account notes' },
        cycleEntries: [{ id: 'same', date: '2026-09-01', flow: 'light', cramps: 1, mood: 'steady', notes: '' }],
        reminders: [{ id: 'cycle', title: 'Cycle', detail: 'Account detail', enabled: false }],
      },
      {
        profile: { name: 'Device name' },
        cycleEntries: [
          { id: 'same', date: '2026-09-01', flow: 'heavy', cramps: 5, mood: 'tired', notes: 'Updated on device' },
          { id: 'older', date: '2026-08-01', flow: 'medium', cramps: 2, mood: 'steady', notes: '' },
        ],
        reminders: [{ id: 'cycle', title: 'Cycle', detail: 'Device detail', enabled: true }],
      },
    );

    expect(merged.profile).toEqual({ name: 'Device name', conditions: 'Account notes' });
    expect(merged.cycleEntries?.map((entry) => entry.id)).toEqual(['same', 'older']);
    expect(merged.cycleEntries?.[0].flow).toBe('heavy');
    expect(merged.reminders?.[0].enabled).toBe(true);
  });

  it('requires per-user row-level security and conflict-safe writes in the database migration', async () => {
    const migration = await readFile(
      new URL('../supabase/migrations/20261018000000_create_bloomwell_user_data.sql', import.meta.url),
      'utf8',
    );

    expect(migration).toMatch(/enable row level security/i);
    expect((migration.match(/select auth\.uid\(\)/gi) ?? []).length).toBe(4);
    expect(migration).toMatch(/revoke all on public\.bloomwell_user_data from public, anon, authenticated/i);
    expect(migration).toMatch(/where existing\.updated_at = p_expected_updated_at/i);
    expect(migration).toMatch(/BLOOMWELL_DATA_CONFLICT/);
    expect(migration).toMatch(/grant execute on function public\.save_my_bloomwell_data\(jsonb, timestamptz\) to authenticated/i);
    expect(migration).toMatch(/delete from auth\.users/i);
    expect(migration).toMatch(/grant execute on function public\.delete_my_bloomwell_account\(\) to authenticated/i);
  });

  it('restricts every data operation and private-file path to the authenticated owner', async () => {
    const migration = await readFile(
      new URL('../supabase/migrations/20261018000100_lock_down_user_data_storage.sql', import.meta.url),
      'utf8',
    );
    const isolationTest = await readFile(new URL('./rls-isolation.sql', import.meta.url), 'utf8');

    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/grant select, insert, update, delete on public\.bloomwell_user_data to authenticated/i);
    expect(migration).toMatch(/for select to authenticated[\s\S]*?auth\.uid\(\)[\s\S]*?user_id/i);
    expect(migration).toMatch(/for insert to authenticated[\s\S]*?with check[\s\S]*?auth\.uid\(\)[\s\S]*?user_id/i);
    expect(migration).toMatch(/for update to authenticated[\s\S]*?using[\s\S]*?auth\.uid\(\)[\s\S]*?user_id[\s\S]*?with check[\s\S]*?auth\.uid\(\)[\s\S]*?user_id/i);
    expect(migration).toMatch(/for delete to authenticated[\s\S]*?using[\s\S]*?auth\.uid\(\)[\s\S]*?user_id/i);
    expect((migration.match(/as restrictive[\s\S]*?for (?:select|insert|update|delete) to public/gi) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(migration).toMatch(/insert into storage\.buckets[\s\S]*?'bloomwell-private'[\s\S]*?false/i);
    const privateStoragePolicies = migration.match(/create policy "Users can [^\r\n"]+ private BloomWell files"[\s\S]*?on storage\.objects[\s\S]*?;/gi) ?? [];
    expect(privateStoragePolicies).toHaveLength(4);
    for (const policy of privateStoragePolicies) {
      expect(policy).toMatch(/to authenticated/i);
      expect(policy).toMatch(/bucket_id = 'bloomwell-private'/i);
      expect(policy).toMatch(/storage\.foldername\(name\)/i);
      expect(policy).toMatch(/auth\.uid\(\)/i);
    }
    expect(migration).toMatch(/public,\s*file_size_limit,[\s\S]*?false/i);
    expect(migration).toMatch(/set name = excluded\.name,[\s\S]*?public = false/i);
    expect(isolationTest).toMatch(/User A can read User B data/);
    expect(isolationTest).toMatch(/User A inserted a row for User B/);
    expect(isolationTest).toMatch(/User A updated User B data/);
    expect(isolationTest).toMatch(/User A deleted User B data/);
    expect(isolationTest).toMatch(/rollback;/i);
  });

  it('keeps local-only exports free of server APIs, secrets, and public auth configuration', async () => {
    const environmentTemplate = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
    const nextConfig = await readFile(new URL('../next.config.mjs', import.meta.url), 'utf8');
    const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');

    expect(environmentTemplate).not.toMatch(/(?:GEMINI|SUPABASE|SERVICE_ROLE|SECRET|NEXT_PUBLIC_SITE_URL)/i);
    expect(nextConfig).toMatch(/output:\s*'export'/);
    expect(page).not.toMatch(/@supabase|\.from\(['"]bloomwell_user_data/);
    expect(page).not.toMatch(/fetch\(['"]\/api\//);
  });
});

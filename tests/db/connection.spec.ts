import { test, expect } from '../../src/fixtures';

test.describe('Database', () => {
  test('read-only user can connect and see the app tables', async ({ db }) => {
    const rows = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(['appointments', 'doctors', 'notifications', 'payments', 'users']),
    );
  });

  test('DB user cannot write (guards against accidental mutation)', async ({ db }) => {
    await expect(db.query("update doctors set bio = bio where false")).rejects.toThrow(/permission denied|read-only/i);
  });
});

import { expectCompleteJson } from '../../src/fixtures';
import { expectStoredNotifications } from './dbState';
import { test, expect } from './writes';

test('GET /notifications contains only the user records and maps isRead to is_read', async ({
  api,
  db,
  testUser,
}) => {
  const notifications = await expectCompleteJson(
    await api.listNotifications(),
    200,
    'Notification[]',
  );
  const rows = await db.notificationsForUser(testUser.id);
  expect(notifications.map((n) => n.id).toSorted((a, b) => a - b)).toEqual(rows.map((n) => n.id));
  for (const row of rows) {
    const { is_read, ...stored } = row;
    expect(
      notifications.find((n) => n.id === row.id),
      `notification ${row.id} is listed and matches the DB`,
    ).toMatchObject({
      ...stored,
      isRead: is_read,
    });
  }
  for (const notification of notifications)
    expect(notification.user_id, `notification ${notification.id} belongs to the test user`).toBe(
      testUser.id,
    );
});

// Existing notifications are never changed: only a new one this run can be
// attributed to is marked read, and a repeat must stay idempotent.
test(
  'PUT /notifications/:id/read changes only that read flag and repeats idempotently',
  { tag: '@mutating' },
  async ({ owned, api, db, testUser }) => {
    const baseline = await db.notificationsForUser(testUser.id);
    const booked = await owned.book();
    const current = await db.notificationsForUser(testUser.id);
    const target = current.find(
      (n) =>
        !n.is_read &&
        !baseline.some((b) => b.id === n.id) &&
        (n.message.includes(booked.marker) ||
          new RegExp(`\\bappointment\\s*(?:#|id[: ]*)\\s*${booked.id}\\b`, 'i').test(n.message)),
    );
    test.skip(!target, 'No new unread notification could be attributed to this run');
    if (!target) return;

    const expected = current.map((n) => (n.id === target.id ? { ...n, is_read: true } : n));
    for (const attempt of ['first', 'repeated'] as const) {
      await test.step(`${attempt} read`, async () => {
        await expect(await api.markNotificationRead(target.id)).toHaveStatus(200);
        await expectStoredNotifications(db, testUser.id, expected);
        const notifications = await expectCompleteJson(
          await api.listNotifications(),
          200,
          'Notification[]',
        );
        expect(
          notifications.find((n) => n.id === target.id)?.isRead,
          `notification ${target.id} is read in the API`,
        ).toBe(true);
      });
    }
  },
);

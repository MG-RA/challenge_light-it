import { test, expect } from '../api/writes';
import { isUpcoming } from '../../src/support/dates';

test(
  'dashboard upcoming counter changes after a persisted booking and deletion',
  { tag: '@mutating' },
  async ({ page, dashboardPage, owned, db, testUser }) => {
    const upcoming = async () =>
      (await db.appointmentsForPatient(testUser.id)).filter((row) => isUpcoming(row)).length;
    const counter = dashboardPage.counter('Upcoming appointments');
    const before = await upcoming();
    await dashboardPage.goto();
    await expect.soft(counter, 'baseline DB count').toHaveText(String(before));
    const booked = await owned.book();
    expect(['active', 'pending'], 'new booking qualifies as upcoming').toContain(booked.row.status);
    expect(await upcoming(), 'DB count increased').toBe(before + 1);
    await page.reload();
    await expect
      .soft(counter, 'counter increases after persisted booking and reload')
      .toHaveText(String(before + 1));
    expect((await owned.remove(booked.id)).status, 'delete response status').toBe(200);
    await expect
      .poll(() => db.stateAppointment(booked.id, testUser.id), {
        message: `appointment ${booked.id} is removed from the DB`,
      })
      .toBeUndefined();
    expect(await upcoming(), 'DB count restored').toBe(before);
    await page.reload();
    await expect
      .soft(counter, 'counter returns to baseline after deletion and reload')
      .toHaveText(String(before));
    test.info().annotations.push({
      type: 'observation',
      description: `Verified DB upcoming counts: ${before} -> ${before + 1} -> ${before}`,
    });
    // The owned fixture also verifies cleanup if an earlier assertion fails.
  },
);

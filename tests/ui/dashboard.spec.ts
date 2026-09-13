import { test, expect } from '../../src/fixtures';
import { appointmentStart, dateAfter, isUpcoming } from '../../src/support/dates';

test.describe('Dashboard', () => {
  test('greets the user by first name from the DB', async ({ dashboardPage, testUser }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.greeting).toContainText(testUser.first_name);
  });
  for (const [label, path, heading] of [
    ['Book', '/appointments/new', 'Book Appointment'], ['Doctors', '/doctors', 'Doctors'],
    ['History', '/appointments', 'Appointments'], ['Alerts', '/notifications', 'Notifications'],
  ] as const) {
    test(`Quick Actions opens ${label}`, async ({ page, dashboardPage }) => {
      await dashboardPage.goto();
      const actions = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Quick Actions' }) });
      await actions.getByRole('link', { name: new RegExp(`${label}$`) }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('main').getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    });
  }
  for (const status of ['upcoming', 'completed', 'cancelled'] as const) {
    test(`${status} count reflects patient records`, async ({ page, dashboardPage, db, testUser }) => {
      const rows = await db.appointmentsForPatient(testUser.id);
      // Proposed rule: future active/pending records in the suite time zone, which the browser shares.
      const count = rows.filter((row) => status === 'upcoming' ? isUpcoming(row) : row.status === status).length;
      await dashboardPage.goto();
      const label = status === 'upcoming' ? 'Upcoming appointments' : status === 'completed' ? 'Completed' : 'Cancelled';
      const card = page.getByText(label, { exact: true }).locator('../..');
      await expect(card.locator('.text-headline-lg')).toHaveText(String(count));
    });
  }
  test('next appointment is the earliest future active or pending record',
    { annotation: { type: 'issue', description: 'F-21: the card shows a different appointment from the earliest eligible one (docs/FINDINGS.md)' } },
    async ({ page, dashboardPage, db, testUser }) => {
      const now = new Date();
      const rows = (await db.appointmentsForPatient(testUser.id))
        .filter((row) => isUpcoming(row, now))
        .sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime() || a.id - b.id);
      await dashboardPage.goto();
      const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Your next appointment' }) });
      const next = rows[0];
      if (!next) {
        await expect(panel.getByTestId('next-appointment-doctor')).toHaveCount(0);
        await expect(panel).toContainText(/no upcoming|no appointments/i);
        return;
      }
      const doctor = await db.oneOrThrow<{ first_name: string; last_name: string }>('next doctor',
        'select first_name, last_name from doctors where id = $1', [next.doctor_id]);
      // The card renders an appointment, so only which appointment it shows remains to fail.
      await expect(panel.getByTestId('next-appointment-doctor')).toHaveText(/^Dr\. \S/);
      test.fail(true, 'F-21: only the selected next appointment may fail');
      await expect(panel.getByTestId('next-appointment-doctor')).toHaveText(`Dr. ${doctor.first_name} ${doctor.last_name}`);
      const date = new Date(`${next.appointment_date}T12:00:00`).toLocaleDateString('en-US');
      await expect(panel).toContainText(`${date} at ${next.time_slot}`);
      await expect(panel).toContainText(next.status === 'active' ? 'Confirmed' : 'Pending');
    });
  test('next appointment View all opens appointment history', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    await page.getByRole('link', { name: 'View all', exact: true }).click();
    await expect(page).toHaveURL(/\/appointments$/);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Appointments', level: 1 })).toBeVisible();
  });
});

for (const [label, expected, finding] of [
  ['Upcoming appointments', 2, 'F-23'], ['Completed', 1, undefined], ['Cancelled', 2, undefined],
] as const) {
  const details = finding
    ? { annotation: { type: 'issue', description: `${finding}: the ${label} counter does not follow appointment data (docs/FINDINGS.md)` } }
    : {};
  test(`dashboard ${label} counter updates when appointment data changes`, details, async ({ page, dashboardPage, testUser }) => {
    // Controlled responses isolate UI aggregation from backend lifecycle defects.
    const future = dateAfter(7);
    const past = dateAfter(-7);
    let populated = false;
    let reads = 0;
    const statuses = ['active', 'pending', 'completed', 'cancelled', 'cancelled', 'active'];
    const records = statuses.map((status, index) => ({
      id: 900001 + index, patient_id: testUser.id, doctor_id: 1,
      appointment_date: index === 5 ? past : future, time_slot: '09:00', status,
      notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }));
    await page.route('**/api/appointments*', async (route) => {
      if (new URL(route.request().url()).pathname !== '/api/appointments' || route.request().method() !== 'GET') {
        return route.continue();
      }
      reads++;
      await route.fulfill({ json: populated ? records : [] });
    });
    const count = page.getByText(label, { exact: true }).locator('../..').locator('.text-headline-lg');
    await dashboardPage.goto();
    await expect(count, `${label} counter is rendered`).toHaveText(/^\d+$/);
    const emptyReads = reads;
    expect(emptyReads, 'dashboard reads appointment data on initial load').toBeGreaterThan(0);
    // Completed and Cancelled run this same flow unmarked, so they still guard the reload refresh hard.
    if (finding) test.fail(true, `${finding}: only the ${label} counter values may fail`);
    await expect.soft(count, `${label}: empty dataset`).toHaveText('0');
    populated = true;
    await page.reload();
    await expect.soft(count, `${label}: changed dataset after reload`).toHaveText(String(expected));
    expect.soft(reads, 'dashboard refreshes appointment data on reload').toBeGreaterThan(emptyReads);
    test.info().annotations.push({ type: 'observation', description: `${label}: intercepted appointment reads=${reads}` });
  });
}

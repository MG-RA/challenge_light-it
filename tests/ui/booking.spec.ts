import { test, expect } from '../../src/fixtures';
import { BookingPage } from '../../src/pages/BookingPage';
import { dateAfter } from '../../src/support/dates';

test('booking loads the selected doctor availability into time options without submitting', async ({
  page,
  db,
}) => {
  const doctors = (await db.activeDoctors()).slice(0, 2);
  test.skip(doctors.length < 2, 'Two active doctors needed to verify changing the selected doctor');
  // Enforce read-only exploration even if the application unexpectedly submits.
  await page.route('**/api/**', (route) =>
    route.request().method() === 'GET' ? route.continue() : route.abort(),
  );
  const booking = new BookingPage(page);
  await booking.goto();
  await booking.date.fill(dateAfter(1));
  for (const doctor of doctors) {
    const pending = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/doctors/${doctor.id}/availability` &&
        response.request().method() === 'GET',
    );
    await booking.doctor.selectOption(String(doctor.id));
    const response = await pending;
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual(expect.objectContaining({ time_slots: expect.any(Array) }));
    const slots = (body as { time_slots: string[] }).time_slots;
    for (const slot of slots) expect(slot).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    await expect(booking.slots).toHaveText(slots);
  }
});

for (const missing of ['doctor_id', 'appointment_date', 'time_slot'] as const) {
  test(`booking validates missing ${missing} before submitting`, async ({ page }) => {
    let submissions = 0;
    await page.route('**/api/doctors/*/availability*', (route) =>
      route.fulfill({ json: { time_slots: ['09:00'] } }),
    );
    await page.route('**/api/appointments', async (route) => {
      if (route.request().method() === 'GET') return route.continue();
      submissions++;
      await route.fulfill({ status: 400, json: { error: 'Unexpected submission' } });
    });
    const booking = new BookingPage(page);
    await booking.goto();
    if (missing !== 'doctor_id') await booking.doctor.selectOption({ index: 1 });
    // A relative future date stays valid once the form gains a minimum date (F-12 fix).
    if (missing !== 'appointment_date') await booking.date.fill(dateAfter(30));
    if (missing !== 'time_slot' && missing !== 'doctor_id')
      await booking.timeSlot.selectOption('09:00');
    await booking.submit.click();
    const field = {
      doctor_id: booking.doctor,
      appointment_date: booking.date,
      time_slot: booking.timeSlot,
    }[missing];
    await expect(field).toBeFocused();
    expect(await field.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
    expect(submissions).toBe(0);
    await expect(page).toHaveURL(/\/appointments\/new$/);
  });
}

test('switching doctors replaces slots and clears the previous selection', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/doctors/*/availability*', (route) =>
    route.fulfill({
      json: { time_slots: ++calls === 1 ? ['09:00'] : ['14:30'] },
    }),
  );
  const booking = new BookingPage(page);
  await booking.goto();
  await booking.doctor.selectOption({ index: 1 });
  await booking.timeSlot.selectOption('09:00');
  await booking.doctor.selectOption({ index: 2 });
  await expect(booking.slots).toHaveText(['14:30']);
  await expect(booking.timeSlot).toHaveValue('');
});

test('availability failure has feedback and recovers after changing doctor', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/doctors/*/availability*', (route) =>
    ++calls === 1
      ? route.fulfill({
          status: 500,
          json: { error: 'Availability unavailable. Please try again.' },
        })
      : route.fulfill({ json: { time_slots: ['14:30'] } }),
  );
  const booking = new BookingPage(page);
  await booking.goto();
  await booking.doctor.selectOption({ index: 1 });
  await expect(
    page.getByText(/availability unavailable|unable to load|failed to.*availability/i),
  ).toBeVisible();
  await expect(booking.slots).toHaveCount(0);
  await booking.doctor.selectOption({ index: 2 });
  await expect(booking.slots).toHaveText(['14:30']);
});

test(
  'booking rejects a past date in the UI',
  {
    annotation: {
      type: 'issue',
      description:
        'F-12: the date input has no minimum and a past date is not blocked (docs/FINDINGS.md)',
    },
  },
  async ({ page }) => {
    let submissions = 0;
    await page.route('**/api/doctors/*/availability*', (route) =>
      route.fulfill({ json: { time_slots: ['09:00'] } }),
    );
    await page.route('**/api/appointments', async (route) => {
      if (route.request().method() === 'GET') return route.continue();
      submissions++;
      await route.fulfill({ status: 400, json: { error: 'Past date' } });
    });
    const booking = new BookingPage(page);
    await booking.goto();
    await booking.doctor.selectOption({ index: 1 });
    await booking.date.fill('2000-01-01');
    await booking.timeSlot.selectOption('09:00');
    // The form is fully populated, so only the missing past-date validation remains to fail.
    await expect(booking.date).toHaveValue('2000-01-01');
    await expect(booking.timeSlot).toHaveValue('09:00');
    await booking.submit.click();
    test.fail(true, 'F-12: only the missing past-date validation may fail');
    await expect(booking.date).toBeFocused();
    expect(
      await booking.date.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow),
    ).toBe(true);
    expect(submissions).toBe(0);
  },
);

import { test, expect } from '../../src/fixtures';
import type { BookingField, BookingForm } from '../../src/pages/BookingPage';
import { dateAfter } from '../../src/support/dates';

test('booking loads the selected doctor availability into time options without submitting', async ({
  page,
  db,
  bookingPage,
}) => {
  const doctors = (await db.activeDoctors()).slice(0, 2);
  test.skip(doctors.length < 2, 'Two active doctors needed to verify changing the selected doctor');
  // Enforce read-only exploration even if the application unexpectedly submits.
  await page.route('**/api/**', (route) =>
    route.request().method() === 'GET' ? route.continue() : route.abort(),
  );

  await bookingPage.goto();
  await bookingPage.date.fill(dateAfter(1));

  for (const doctor of doctors) {
    const response = await bookingPage.chooseDoctorAndWaitForSlots(doctor.id);
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual(expect.objectContaining({ time_slots: expect.any(Array) }));
    const slots = (body as { time_slots: string[] }).time_slots;
    for (const slot of slots) expect(slot).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    await expect(bookingPage.slots).toHaveText(slots);
  }
});

// A relative future date stays valid once the form gains a minimum date (F-12 fix).
const requiredFields: { missing: BookingField; form: BookingForm }[] = [
  // Without a doctor no time slots load, so the slot stays empty as well.
  { missing: 'doctor_id', form: { date: dateAfter(30) } },
  { missing: 'appointment_date', form: { doctor: { index: 1 }, slot: '09:00' } },
  { missing: 'time_slot', form: { doctor: { index: 1 }, date: dateAfter(30) } },
];

for (const { missing, form } of requiredFields) {
  test(`booking validates missing ${missing} before submitting`, async ({ page, bookingPage }) => {
    let submissions = 0;
    await page.route('**/api/doctors/*/availability*', (route) =>
      route.fulfill({ json: { time_slots: ['09:00'] } }),
    );
    await page.route('**/api/appointments', async (route) => {
      if (route.request().method() === 'GET') return route.continue();
      submissions++;
      await route.fulfill({ status: 400, json: { error: 'Unexpected submission' } });
    });

    await bookingPage.goto();
    await bookingPage.fill(form);
    await bookingPage.submit.click();

    const field = bookingPage.field(missing);
    await expect(field).toBeFocused();
    expect(await field.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
    expect(submissions).toBe(0);
    await expect(page).toHaveURL(/\/appointments\/new$/);
  });
}

test('switching doctors replaces slots and clears the previous selection', async ({
  page,
  bookingPage,
}) => {
  let calls = 0;
  await page.route('**/api/doctors/*/availability*', (route) =>
    route.fulfill({
      json: { time_slots: ++calls === 1 ? ['09:00'] : ['14:30'] },
    }),
  );

  await bookingPage.goto();
  await bookingPage.fill({ doctor: { index: 1 }, slot: '09:00' });
  await bookingPage.chooseDoctor({ index: 2 });

  await expect(bookingPage.slots).toHaveText(['14:30']);
  await expect(bookingPage.timeSlot).toHaveValue('');
});

test('availability failure has feedback and recovers after changing doctor', async ({
  page,
  bookingPage,
}) => {
  let calls = 0;
  await page.route('**/api/doctors/*/availability*', (route) =>
    ++calls === 1
      ? route.fulfill({
          status: 500,
          json: { error: 'Availability unavailable. Please try again.' },
        })
      : route.fulfill({ json: { time_slots: ['14:30'] } }),
  );

  await bookingPage.goto();
  await bookingPage.chooseDoctor({ index: 1 });
  await expect(bookingPage.availabilityError).toBeVisible();
  await expect(bookingPage.slots).toHaveCount(0);

  await bookingPage.chooseDoctor({ index: 2 });
  await expect(bookingPage.slots).toHaveText(['14:30']);
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
  async ({ page, bookingPage }) => {
    let submissions = 0;
    await page.route('**/api/doctors/*/availability*', (route) =>
      route.fulfill({ json: { time_slots: ['09:00'] } }),
    );
    await page.route('**/api/appointments', async (route) => {
      if (route.request().method() === 'GET') return route.continue();
      submissions++;
      await route.fulfill({ status: 400, json: { error: 'Past date' } });
    });

    await bookingPage.goto();
    await bookingPage.fill({ doctor: { index: 1 }, date: '2000-01-01', slot: '09:00' });
    // The form is fully populated, so only the missing past-date validation remains to fail.
    await expect(bookingPage.date).toHaveValue('2000-01-01');
    await expect(bookingPage.timeSlot).toHaveValue('09:00');
    await bookingPage.submit.click();

    test.fail(true, 'F-12: only the missing past-date validation may fail');
    await expect(bookingPage.date).toBeFocused();
    expect(
      await bookingPage.date.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow),
    ).toBe(true);
    expect(submissions).toBe(0);
  },
);

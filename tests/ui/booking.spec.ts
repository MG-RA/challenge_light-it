import { test, expect } from '../../src/fixtures';
import { BookingPage } from '../../src/pages/BookingPage';

test('booking loads the selected doctor availability into time options without submitting', async ({ page, db }) => {
  const doctors = (await db.activeDoctors()).slice(0, 2);
  test.skip(doctors.length < 2, 'Two active doctors needed to verify changing the selected doctor');
  // Enforce read-only exploration even if the application unexpectedly submits.
  await page.route('**/api/**', (route) => route.request().method() === 'GET'
    ? route.continue() : route.abort());
  const booking = new BookingPage(page);
  await booking.goto();
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  await booking.date.fill(tomorrow.toISOString().slice(0, 10));
  for (const doctor of doctors) {
    const pending = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/doctors/${doctor.id}/availability`
      && response.request().method() === 'GET');
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

import { test, expect } from '../../src/fixtures';
import { apiCalendarDate, displayDate } from '../../src/support/dates';

test('a patient books an appointment and finds it in their list', async ({
  page,
  sidebar,
  bookingPage,
  appointmentsPage,
  testAppointments,
}) => {
  const slot = await testAppointments.freeSlot();
  const notes = testAppointments.newMarker();

  await test.step('open the booking form from the sidebar', async () => {
    await page.goto('/dashboard');
    await sidebar.newAppointmentLink.click();
    await expect(page).toHaveURL(/\/appointments\/new$/);
  });

  await test.step('choose a doctor, a date, a time and add a note', async () => {
    const slots = await bookingPage.fill({ ...slot, notes });
    expect(slots.status(), `availability for doctor ${slot.doctorId}`).toBe(200);
  });

  await test.step('submit and see the confirmation', async () => {
    await bookingPage.submit.click();
    await expect(bookingPage.confirmation).toBeVisible();
  });

  await test.step('the new appointment is listed with the chosen date, time and status', async () => {
    await bookingPage.viewAppointments.click();
    await expect(appointmentsPage.heading).toBeVisible();
    const card = appointmentsPage.card(notes);
    await expect(appointmentsPage.schedule(card)).toHaveText(
      `${displayDate(slot.date)} • ${slot.time}`,
    );
    await expect(card).toContainText('Active');
  });

  await test.step('the API stores exactly what the patient chose', async () => {
    const stored = await testAppointments.findByMarker(notes);
    expect(stored, 'appointment found by its note').toBeDefined();
    expect(
      {
        doctor: stored!.doctor_id,
        date: apiCalendarDate(stored!.appointment_date),
        time: stored!.time_slot,
        status: stored!.status,
      },
      'stored appointment',
    ).toEqual({ doctor: slot.doctorId, date: slot.date, time: slot.time, status: 'active' });
  });
});

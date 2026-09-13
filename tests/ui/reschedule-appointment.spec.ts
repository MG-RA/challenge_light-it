import type { Appointment } from '../../src/api/types';
import { test, expect } from '../../src/fixtures';
import { apiCalendarDate, displayDate } from '../../src/support/dates';

// The user story tested in Part 1: "reschedule an existing appointment to another available time
// slot, without having to cancel and book from scratch".

test('a patient reschedules an appointment to another time slot', async ({
  page,
  api,
  appointmentsPage,
  testAppointments,
}) => {
  const original = await testAppointments.create(await testAppointments.freeSlot());
  const target = await testAppointments.freeSlot(original);
  const card = appointmentsPage.card(original.marker);

  await test.step('the existing appointment is listed with its current date and time', async () => {
    await appointmentsPage.goto();
    await expect(appointmentsPage.schedule(card)).toHaveText(
      `${displayDate(original.date)} • ${original.time}`,
    );
  });

  await test.step('choose a new date and time and confirm', async () => {
    const response = await appointmentsPage.reschedule(card, target);
    expect(response.status(), 'reschedule response status').toBe(200);
    await expect(appointmentsPage.rescheduledMessage).toBeVisible();
  });

  await test.step('after a reload, the same appointment shows the new date and time', async () => {
    await page.reload();
    await expect(appointmentsPage.schedule(card)).toHaveText(
      `${displayDate(target.date)} • ${target.time}`,
    );
    await expect(card).toContainText('Active');
  });

  await test.step('the API stores the new slot on the same appointment, without cancelling it', async () => {
    const stored = (await (await api.getAppointment(original.id)).json()) as Appointment;
    expect(
      {
        id: stored.id,
        doctor: stored.doctor_id,
        date: apiCalendarDate(stored.appointment_date),
        time: stored.time_slot,
        status: stored.status,
      },
      'stored appointment',
    ).toEqual({
      id: original.id,
      doctor: original.doctorId,
      date: target.date,
      time: target.time,
      status: 'active',
    });
  });
});

test(
  'the rescheduled appointment shows its new date without reloading',
  {
    annotation: {
      type: 'issue',
      description:
        'BUG-04 (part-1-functional-testing): the card keeps the old date until the page is reloaded',
    },
  },
  async ({ appointmentsPage, testAppointments }) => {
    const original = await testAppointments.create(await testAppointments.freeSlot());
    const target = await testAppointments.freeSlot(original);
    const card = appointmentsPage.card(original.marker);

    await appointmentsPage.goto();
    const response = await appointmentsPage.reschedule(card, target);
    expect(response.status(), 'reschedule response status').toBe(200);
    await expect(appointmentsPage.rescheduledMessage).toBeVisible();

    // Everything above must pass; only the known stale card may fail. A fix shows up as an unexpected pass.
    test.fail(true, 'BUG-04: only the card date right after confirming may fail');
    await expect(appointmentsPage.schedule(card)).toHaveText(
      `${displayDate(target.date)} • ${target.time}`,
    );
  },
);

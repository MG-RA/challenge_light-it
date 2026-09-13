import { test, expect } from '../../extras/api-tests/writes';

test(
  'booked doctor date and slot cannot be selected again',
  { tag: '@mutating' },
  async ({ owned, bookingPage }) => {
    const booked = await owned.book();

    await bookingPage.goto();
    await bookingPage.date.fill(booked.row.appointment_date);
    const availability = await bookingPage.chooseDoctorAndWaitForSlots(booked.row.doctor_id);
    expect(availability.status(), 'availability response status').toBe(200);

    const option = bookingPage.slot(booked.row.time_slot);
    await expect(async () => {
      expect(
        (await option.count()) === 0 || (await option.isDisabled()),
        'occupied slot is absent or disabled',
      ).toBe(true);
    }).toPass({ timeout: 7000 });
    // The owned fixture removes only this run's marked appointment, including on failure.
  },
);

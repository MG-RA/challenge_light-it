import { test, expect } from '../api/writes';
import { BookingPage } from '../../src/pages/BookingPage';

test(
  'booked doctor date and slot cannot be selected again',
  { tag: '@mutating' },
  async ({ page, owned }) => {
    const booked = await owned.book();
    const booking = new BookingPage(page);
    await booking.goto();
    await booking.date.fill(booked.row.appointment_date);
    const response = page.waitForResponse(
      (res) => new URL(res.url()).pathname === `/api/doctors/${booked.row.doctor_id}/availability`,
    );
    await booking.doctor.selectOption(String(booked.row.doctor_id));
    expect((await response).status()).toBe(200);
    const option = booking.slot(booked.row.time_slot);
    await expect(async () => {
      expect(
        (await option.count()) === 0 || (await option.isDisabled()),
        'occupied slot is absent or disabled',
      ).toBe(true);
    }).toPass({ timeout: 7000 });
    // owned fixture removes only this run's marked appointment, including on failure.
  },
);

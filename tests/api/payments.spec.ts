import { expectCompleteJson } from '../../src/fixtures';
import { expectStoredPayments } from './dbState';
import { test, expect } from './writes';

test('GET /payments matches payments for the patient appointments', async ({ api, db, testUser }) => {
  const payments = await expectCompleteJson(await api.listPayments(), 200, 'Payment[]');
  const rows = await db.paymentsForPatient(testUser.id);
  expect(payments.map((p) => p.id).toSorted((a, b) => a - b)).toEqual(rows.map((p) => p.id));
  for (const row of rows) {
    const payment = payments.find((p) => p.id === row.id)!;
    const { amount, ...stored } = row;
    expect(payment).toMatchObject(stored);
    expect(payment.amount).toMatch(/^-?\d+(?:\.\d+)?$/);
    expect(Number.isFinite(Number(payment.amount))).toBe(true);
    expect(Number(payment.amount)).toBe(Number(amount));
  }
});

// Payments cannot be removed through the API: this uses one dedicated owned
// appointment and the four capped submissions, and declares any residue.
test('POST /payments stores one valid payment and rejects invalid amounts', { tag: '@mutating' },
  async ({ owned, db }) => {
    const booked = await owned.book();
    const fee = Number(booked.doctor.consultation_fee);
    expect(Number.isFinite(fee) && fee > 0, 'the doctor has a usable consultation fee').toBe(true);

    const valid = await owned.pay(booked.id, { amount: fee, method: 'cash' });
    expect(valid.status).toBe(200);
    expect(valid.before, 'a fresh appointment starts without payments').toEqual([]);
    const [payment] = await expectStoredPayments(db, booked.id, [{ appointment_id: booked.id, method: 'cash' }]);
    expect(Number(payment!.amount)).toBe(fee);
    expect(['pending', 'paid', 'refunded']).toContain(payment!.status);
    expect(valid.body, 'the response reports the stored payment').toMatchObject({ success: true, payment_id: payment!.id });

    for (const [label, amount] of [['zero', 0], ['negative', -1], ['duplicate', fee]] as const) {
      await test.step(`rejects a ${label} amount`, async () => {
        const result = await owned.pay(booked.id, { amount, method: 'cash' });
        expect.soft([400, 409], `${label} payment rejection is a proposed business expectation`).toContain(result.status);
        await expectStoredPayments(db, booked.id, [payment!]);
      });
    }
  });

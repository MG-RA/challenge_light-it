import type { APIResponse } from '@playwright/test';
import { missingFields } from '../../src/api/contract';
import { expect } from '../../src/fixtures/matchers';
import { expectJson, expectCompleteJson } from '../../src/fixtures/expectJson';
import { readAppointments } from './appointmentResponse';

// Run before test.fail: unrelated HTTP/data failures must remain unexpected.
export async function doctorCompletenessGaps(response: APIResponse) {
  const doctors = await expectJson(response, 200, 'Doctor[]');
  const gaps = missingFields('Doctor[]', doctors);
  expect(gaps.filter(({ field }) => !['is_active', 'consultation_fee'].includes(field)),
    'unrelated missing doctor fields').toEqual([]);
  return { doctors, gaps };
}

export async function cacheHeaderForCheck(response: APIResponse, schema: 'User' | 'Appointment[]') {
  if (schema === 'Appointment[]') await readAppointments(response, 'list');
  else await expectCompleteJson(response, 200, schema);
  const header = response.headers()['cache-control'] ?? '';
  if (/\bpublic\b/i.test(header)) {
    expect(header, 'known F-14 header signature').toBe('public, max-age=0, must-revalidate');
  } else {
    expect(header, 'a different unsafe cache policy is not F-14').toMatch(/\b(private|no-store)\b/i);
  }
  return header;
}

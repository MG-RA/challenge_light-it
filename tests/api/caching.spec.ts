import { test, expect } from '../../src/fixtures';
import { cacheHeaderForCheck } from './knownDefectChecks';

test.describe('HTTP caching', () => {
  for (const endpoint of ['profile', 'appointments'] as const) {
    test(
      `${endpoint} response is not cacheable by shared caches`,
      {
        annotation: {
          type: 'issue',
          description: 'F-14: Cache-Control is public (docs/FINDINGS.md)',
        },
      },
      async ({ api }) => {
        const response = await (endpoint === 'profile' ? api.getMe() : api.listAppointments());
        const header = await cacheHeaderForCheck(
          response,
          endpoint === 'profile' ? 'User' : 'Appointment[]',
        );
        test.fail(true, 'F-14: only the known public-cache assertion below may fail');
        expect(header, 'Cache-Control has no public directive').not.toMatch(/\bpublic\b/i);
      },
    );
  }
});

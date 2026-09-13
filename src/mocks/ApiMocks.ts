import type { Page, Route } from '@playwright/test';

/** How many requests a stub intercepted. Read it after the action under test. */
export type RequestCount = { readonly count: number };

/** One availability answer: time slots for a 200, or an error status with a message. */
export type AvailabilityReply = string[] | { status: number; error: string };

/** An appointment list served from memory. `serve` replaces it for the next request. */
export type AppointmentListStub = { readonly reads: number; serve(records: object[]): void };

const isRead = (route: Route) => route.request().method() === 'GET';
const pathOf = (route: Route) => new URL(route.request().url()).pathname;

/**
 * Network stubs for UI tests that control what the backend answers. A test that uses one
 * proves UI behavior only, never a backend rule. Stubs registered later are consulted first;
 * a stub that does not handle a request passes it on with `route.fallback()`.
 */
export class ApiMocks {
  constructor(private readonly page: Page) {}

  /** Lets reads through and aborts every other API call, so the test cannot write remotely. */
  async allowOnlyReads(): Promise<void> {
    await this.page.route('**/api/**', (route) =>
      isRead(route) ? route.fallback() : route.abort(),
    );
  }

  /** Answers availability requests with these replies in order; the last reply repeats. */
  async availability(...replies: AvailabilityReply[]): Promise<RequestCount> {
    let count = 0;
    await this.page.route('**/api/doctors/*/availability*', (route) => {
      const reply = replies[Math.min(count, replies.length - 1)]!;
      count++;
      return Array.isArray(reply)
        ? route.fulfill({ json: { time_slots: reply } })
        : route.fulfill({ status: reply.status, json: { error: reply.error } });
    });
    return counter(() => count);
  }

  /** Rejects booking submissions with 400 and counts them; appointment reads pass through. */
  blockBookingSubmissions(): Promise<RequestCount> {
    return this.rejectAndCount('**/api/appointments', (route) => !isRead(route));
  }

  /** Rejects every login submission with 400 and counts them. */
  blockLoginSubmissions(): Promise<RequestCount> {
    return this.rejectAndCount('**/api/auth/login', () => true);
  }

  /** Answers every login attempt with this reply, e.g. a 429 with Retry-After. */
  async answerLogin(reply: {
    status: number;
    headers?: Record<string, string>;
    json: unknown;
  }): Promise<void> {
    await this.page.route('**/api/auth/login', (route) => route.fulfill(reply));
  }

  /** Serves `GET /api/appointments` from memory, starting with `records`. */
  async appointmentList(records: object[] = []): Promise<AppointmentListStub> {
    let current = records;
    let reads = 0;
    await this.page.route('**/api/appointments*', (route) => {
      if (!isRead(route) || pathOf(route) !== '/api/appointments') return route.fallback();
      reads++;
      return route.fulfill({ json: current });
    });
    return {
      get reads() {
        return reads;
      },
      serve(next) {
        current = next;
      },
    };
  }

  private async rejectAndCount(
    url: string,
    handles: (route: Route) => boolean,
  ): Promise<RequestCount> {
    let count = 0;
    await this.page.route(url, (route) => {
      if (!handles(route)) return route.fallback();
      count++;
      return route.fulfill({ status: 400, json: { error: 'Unexpected submission' } });
    });
    return counter(() => count);
  }
}

function counter(read: () => number): RequestCount {
  return {
    get count() {
      return read();
    },
  };
}

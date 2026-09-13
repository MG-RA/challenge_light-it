import type { Locator, Page } from '@playwright/test';

/** The app sidebar, present on every signed-in page. */
export class Sidebar {
  readonly newAppointmentLink: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    const root = page.getByRole('complementary').describe('Sidebar');
    this.newAppointmentLink = root
      .getByRole('link', { name: 'New Appointment' })
      .describe('Sidebar "New Appointment" link');
    this.logoutButton = root.getByRole('button', { name: /logout/i }).describe('Logout button');
  }
}

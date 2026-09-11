import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly greeting: Locator;
  readonly nav: Locator;
  readonly newAppointmentLink: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.greeting = page.getByRole('main').getByRole('heading', { level: 1 });
    this.nav = page.getByRole('complementary').getByRole('navigation');
    this.newAppointmentLink = page.getByRole('link', { name: 'New Appointment' }).first();
    this.logoutButton = page.getByRole('button', { name: /logout/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  navLink(name: 'Dashboard' | 'Doctors' | 'Appointments' | 'Notifications'): Locator {
    return this.nav.getByRole('link', { name: new RegExp(`${name}$`) });
  }
}

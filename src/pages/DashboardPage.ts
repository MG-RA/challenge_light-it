import type { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly greeting: Locator;
  readonly nav: Locator;
  readonly newAppointmentLink: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.greeting = page.getByRole('main').getByRole('heading', { level: 1 }).describe('Dashboard greeting');
    this.nav = page.getByRole('complementary').getByRole('navigation').describe('Sidebar navigation');
    // Main content has a second "New Appointment" link; this is the sidebar one.
    this.newAppointmentLink = page
      .getByRole('complementary')
      .getByRole('link', { name: 'New Appointment' })
      .describe('Sidebar "New Appointment" link');
    this.logoutButton = page.getByRole('button', { name: /logout/i }).describe('Logout button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  navLink(name: 'Dashboard' | 'Doctors' | 'Appointments' | 'Notifications'): Locator {
    // Accessible names include the icon ligature text (e.g. "medical_services Doctors").
    return this.nav.getByRole('link', { name: new RegExp(`${name}$`) }).describe(`"${name}" nav link`);
  }
}

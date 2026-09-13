import type { Locator, Page } from '@playwright/test';

export type SidebarSection = 'Dashboard' | 'Doctors' | 'Appointments' | 'Notifications';

/** The app sidebar, present on every logged-in page. Pages compose it rather than inherit it. */
export class Sidebar {
  readonly root: Locator;
  readonly nav: Locator;
  readonly newAppointmentLink: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('complementary').describe('Sidebar');
    this.nav = this.root.getByRole('navigation').describe('Sidebar navigation');
    this.newAppointmentLink = this.root
      .getByRole('link', { name: 'New Appointment' })
      .describe('Sidebar "New Appointment" link');
    this.logoutButton = this.root
      .getByRole('button', { name: /logout/i })
      .describe('Logout button');
  }

  link(name: SidebarSection): Locator {
    // Accessible names include the icon ligature text (e.g. "medical_services Doctors").
    return this.nav
      .getByRole('link', { name: new RegExp(`${name}$`) })
      .describe(`"${name}" nav link`);
  }
}

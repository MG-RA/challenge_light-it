import type { Locator, Page } from '@playwright/test';
import { Sidebar } from './components/Sidebar';

export type DashboardCounter = 'Upcoming appointments' | 'Completed' | 'Cancelled';
export type QuickAction = 'Book' | 'Doctors' | 'History' | 'Alerts';

export class DashboardPage {
  readonly sidebar: Sidebar;
  readonly greeting: Locator;
  readonly nextAppointment: Locator;
  readonly nextAppointmentDoctor: Locator;
  readonly viewAllAppointments: Locator;
  private readonly main: Locator;

  constructor(private readonly page: Page) {
    this.sidebar = new Sidebar(page);
    this.main = page.getByRole('main');
    this.greeting = this.main.getByRole('heading', { level: 1 }).describe('Dashboard greeting');
    this.nextAppointment = this.main.locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Your next appointment' }) })
      .describe('Next appointment panel');
    this.nextAppointmentDoctor = this.nextAppointment.getByTestId('next-appointment-doctor').describe('Next appointment doctor');
    this.viewAllAppointments = this.main.getByRole('link', { name: 'View all', exact: true }).describe('"View all" appointments link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  /** A Quick Actions link; accessible names include the icon ligature text (e.g. "add_circleBook"). */
  quickAction(label: QuickAction): Locator {
    return this.main.locator('section')
      .filter({ has: this.page.getByRole('heading', { name: 'Quick Actions' }) })
      .getByRole('link', { name: new RegExp(`${label}$`) })
      .describe(`Quick Actions "${label}" link`);
  }

  /** The number shown on a summary card. */
  counter(label: DashboardCounter): Locator {
    if (label === 'Upcoming appointments') return this.main.getByTestId('upcoming-count').describe('Upcoming appointments count');
    // Only Upcoming has a test id. The other cards hold the label and the number in sibling blocks,
    // so go up to the card from its label, then take the purely numeric text.
    return this.main.getByText(label, { exact: true }).locator('xpath=../..').getByText(/^\d+$/)
      .describe(`${label} count`);
  }
}

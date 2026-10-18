import { expect, type Page } from '@playwright/test';
export class TicketPage {
  private readonly page: Page;
  constructor(page: Page) { this.page = page; }
  async open(url: string) { await this.page.goto(url); await expect(this.page.getByRole('heading', { name: 'Evening concert' })).toBeVisible(); }
  async reserve() { await this.page.getByRole('button', { name: 'Reserve ticket' }).click(); }
  async expectConfirmation() { await expect(this.page.getByRole('status')).toHaveText('Reservation confirmed: 1 ticket'); await expect(this.page.getByRole('button')).toBeDisabled(); }
}

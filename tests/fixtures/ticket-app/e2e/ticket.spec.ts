import type { TicketPage } from './ticket.pom.ts';
export async function reserveTicket(pom: TicketPage, url: string, step: (id: string, title: string, action: () => Promise<void>) => Promise<void>) {
  await step('given-ticket', 'Given an available evening concert ticket', () => pom.open(url));
  await step('when-reserve', 'When the visitor reserves one ticket', () => pom.reserve());
  await step('then-confirmed', 'Then a reservation for one ticket is confirmed', () => pom.expectConfirmation());
}

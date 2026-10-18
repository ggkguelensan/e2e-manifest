# Сценарии в Playwright

Читай только для выбранного Playwright. Общая норма — [сценарии](../../docs/scenarios.md). Используй *.spec.ts и fixtures runner; основные пути помещай в *.main.spec.ts, альтернативы и ошибки — в *.secondary.spec.ts.

### Полный пример

Пример интерфейсов для приложения с обычной браузерной сессией. Fixture предоставляет перечисленные POM и backend control; `prepare` задаёт серверные данные и сессию, но не открывает страницы и не публикует билет.

```gherkin
Feature: Публикация билета
  Scenario: Продавец публикует билет и видит его в активных продажах
    Given продавец авторизован
    And у него один доступный для продажи билет на «Концерт»
    And комиссия составляет 10%
    When продавец открывает главную страницу
    And открывает «Мои билеты»
    And открывает заказ «Концерт»
    And начинает продажу
    Then он видит один доступный билет, выбранный для продажи
    When он переходит к цене
    And указывает цену 12000
    Then он видит комиссию 10%, сумму комиссии 1200 и выплату 10800
    When он публикует билет
    Then он видит подтверждение публикации
    When он переходит в «Мои продажи»
    Then он видит активную продажу «Концерт» с ценой «12 000 ₸»
```

```ts
import { test } from './seller.fixture';

test('продавец публикует билет и видит его в активных продажах', async ({
  sellerOrders, home, myTickets, orderDetails, ticketSelection,
  salePrice, saleSummary, publication, publicationResult, mySales,
}) => {
  await sellerOrders.prepare({
    authorized: true,
    eventName: 'Концерт',
    availableTicketCount: 1,
    commissionPercent: 10,
  });

  await home.open();
  await home.openMyTickets();
  await myTickets.openOrder('Концерт');
  await orderDetails.startSale();
  await ticketSelection.expectSingleAvailableTicketSelected();
  await ticketSelection.continueToPricing();
  await salePrice.enterAmount(12_000);
  await saleSummary.expectPayout({
    commissionPercent: 10,
    commissionAmount: 1_200,
    payoutAmount: 10_800,
  });
  await publication.publish();
  await publicationResult.expectPublished();
  await publicationResult.openMySales();
  await mySales.expectActiveSale({
    eventName: 'Концерт',
    price: '12 000 ₸',
  });
});
```

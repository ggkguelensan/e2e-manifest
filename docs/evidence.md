# Данные запуска и доказательств

Читай при capture, проверке результатов или построении отчёта. Владелец форматов — E2E Manifest: [run](../schemas/run.schema.json) и [evidence](../schemas/evidence.schema.json). Формат обеих схем — 1; неизвестная версия отклоняется без миграции. Схемы не копируются в приложение или Design Manifest.

```text
<target-root>/e2e/tmp/
├── workspace.json
├── adaptation.json
├── coverage.csv
├── debt.csv
├── coverage-links.json              # отношения сценариев и долга
├── index.json                       # производный индекс
├── runs/<run-id>/
│   ├── run.json                     # авторитетный результат
│   ├── evidence.json                # авторитетный каталог артефактов
│   ├── assets/
│   ├── diagnostics/
│   └── reports/                     # производные HTML
└── design-review/<review-id>/
    ├── request.json
    ├── snapshot.json
    ├── comparison.json
    ├── assets/
    └── reports/
```

Создавай каталоги по необходимости. Хранение и ignore определены [локальной политикой](local-workflow.md). Review-форматы принадлежат подключённому Design Manifest. Не веди параллельный runs.json: агрегат строится из run.json. Прежние пользовательские данные сохраняются до явного решения об их переносе.

## Идентичность и время

`run.json` фиксирует repository/target IDs, физический worktree, target_path относительно него (`.` для корня), revision и dirty на момент запуска. Это наблюдение, не изменяемая копия реестра Project Manifest. Смена HEAD не переписывает прошлый результат.

Case — конкретные scenario_id, profile и attempt. Сохраняй spec path относительно target, его hash, название сценария и упорядоченные шаги. Устройства и повторы не создают новые scenario IDs покрытия. Steps имеют устойчивые ID, использованные при capture; соответствие Gherkin определяется [нормой сценариев](scenarios.md).

Сначала запиши running с finished_at=null. При завершении запиши конечные статусы; при остановке — interrupted и ограничения. Если процесс погиб до финализации, оставшееся running является незавершённым запуском. Отчёт не исправляет его в passed. Passed требует успешного case и не допускает failed/interrupted/running; skipped не означает проверенное поведение.

Evidence ссылается на case_id/step_id: repository, spec, profile и attempt выводятся через run, а не копируются в каждый объект. Каждый артефакт имеет время, описание, вид, MIME, hash и путь внутри своего run. Условия capture записываются по факту, не берутся из предположений о config. Сейчас conditions обязательны для каждого артефакта; для логов указываются условия связанного шага.

## Проверка

Из checkout закреплённой базы:

```sh
npm run validate:evidence -- --target /absolute/worktree/apps/web --run checkout-mobile
```

Проверяются схемы, уникальность IDs/attempts, связи, статусы, хронология, физические границы worktree/target/run, наличие и hashes файлов. Screenshot MIME сверяется с PNG/JPEG signature; это не полная проверка декодирования изображения. Spec hash сохраняет происхождение; валидатор исторических данных не требует совпадения с изменившимся текущим spec. Перед повторным использованием результата отдельно проверь revision/dirty и hashes текущих источников.

Проверка JSON не доказывает, что тест действительно выполнялся или screenshot показывает ожидаемый экран. Для этого нужны фактический runner, осмотр и сквозная проверка capture. Перенос run в другой worktree не сохраняет локальную валидность автоматически; исходное происхождение не переписывается ради зелёной проверки.

## Локальная браузерная проверка инструментов

`npm run test:browser` создаёт отдельное Git-приложение из `tests/fixtures/ticket-app` внутри игнорируемого e2e/tmp базы. Установи соответствующий Chromium через `npx playwright install chromium`, если его нет в кеше. Закреплённая версия Playwright находится в package.json.

Проверка исполняет пользовательский сценарий через Playwright browser API и public POM: Given доступный билет → When резервирование → Then подтверждён один билет. Сначала mobile, затем desktop. Capture-обвязка отдельно сохраняет кадры и run/evidence, запускает валидатор и рендерер, открывает HTML в браузере на двух ширинах, проверяет загрузку изображений, отсутствие горизонтального overflow и keyboard focus. Исходники fixture после запуска остаются чистыми; результаты и browser-verification.json сохраняются для осмотра.

Это проверка локального client-only примера и инструментов capture/reporting. Она использует явный Node runner; интеграция с Playwright Test reporter, SSR, backend и Design Manifest этой командой не подтверждается. Выбор target/worktree и контекста harness проверяется отдельно. Unit tests `npm test` не запускают браузер и не скачивают его автоматически.

## Проектные предпочтения

Точка расширения для `settings.evidence_priority` из [проектного патча](project-patches.md): mobile-first, desktop-first или equal. Это порядок сбора согласованных доказательств, не копия viewport/device проектов runner и не разрешение пропускать остальные выбранные форм-факторы. При отсутствии значения уточни неизвестное предпочтение пользователя; не выводи его из размеров одного screenshot.

`npm run test:worktree -- <project-manifest-checkout>` проверяет передачу выбора из чистого Project checkout в browser probe: создаёт отдельный repository с вложенным приложением, выбирает зарегистрированный task worktree, запускает capture именно в target и сверяет provenance. Проверяет отказ основного checkout и повторной записи run. Исходники остаются неизменными; proof и HTML находятся в target/e2e/tmp. До capture вызывает native Pi offline RPC и проверяет, что зарегистрированы ровно реальные skills capture/report. Нужен установленный Pi; модель не вызывается. Полный prompt, исполнение skills и создание через wt этой проверкой не подтверждаются.

`test:browser` также принимает `<fixture-target-root> <repository-id> <target-id>` для существующего fixture. Это не универсальный сервер приложения: probe принимает только синтетическое ticket-приложение и не адаптирует продуктовый runtime.

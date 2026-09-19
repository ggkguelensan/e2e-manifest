---
name: visualize-playwright-flows
description: Visualize a passing Playwright user flow as annotated screenshot evidence in a standalone HTML report or an MR/PR gallery. Use when asked to demonstrate or document a tested browser journey; not for visual-regression baselines.
---

# Visualize Playwright flows

Создай визуальные доказательства из существующего проходящего behavioral scenario. Каждый кадр подтверждает конкретное наблюдаемое ожидание и дополняет semantic assertion.

## Результат

Определи формат по запросу и контексту:

- **HTML report** — локальный автономный HTML с относительными PNG assets.
- **MR/PR gallery** — галерея в описании конкретного merge/pull request.
- **Оба формата** — одна съёмка и один evidence manifest для двух представлений.

Если формат не определён, уточни его до запуска capture. Явно выбранный формат повторно не согласовывай. Подготовь материал для галереи до запроса недостающего разрешения на изменение описания; уже данное поручение обновить конкретный MR/PR является разрешением.

## Работа

1. Прочитай [capture-evidence.md](references/capture-evidence.md): предусловия, порядок capture и формат evidence manifest.
2. Найди запрошенный spec, его journeys/POM, Playwright config и команды проекта. Запусти целевой сценарий в нужных device projects и подтверди, что он проходит. Если сценарий падает, сообщи о блокирующей ошибке; не выдавай частичные кадры за доказательство успешного flow.
3. Выведи пользовательские шаги из сценария. Создай временный capture harness только при необходимости, используя публичные интерфейсы journeys/POM. После каждого существенного assertion и визуальной готовности сними отдельный аннотированный кадр.
4. Собери один manifest с последовательностью scenario → device → steps. Используй synthetic данные и временные кадры `*.tmp.png`.
5. Прочитай инструкцию только для выбранного формата:
   - [standalone-html-report.md](references/standalone-html-report.md) — генератор [render-flow-report.ts](scripts/render-flow-report.ts), относительные assets и проверка HTML в браузере;
   - [review-gallery.md](references/review-gallery.md) — загрузка кадров, сохранение остальных разделов описания и проверка опубликованных ссылок.
6. Проверь результат и передай путь HTML или ссылку на обновлённый MR/PR. Укажи, какие сценарии и устройства представлены. Удали временный harness и ненужные captures; assets готового HTML сохраняются вместе с отчётом.

## Границы

- Скриншоты не заменяют assertions; не добавляй `toHaveScreenshot`, baselines или PNG в test suite.
- Не добавляй screenshot/reporting-код в specs, journeys, POM или приложение.
- Capture ждёт наблюдаемую готовность, без произвольных sleeps. Annotation не перекрывает UI и не меняет layout.
- В кадрах нет devtools, debug overlays, токенов, cookies, реальных персональных данных и приватной конфигурации.
- Генерируемые отчёты остаются временными, если пользователь явно не запросил repository artifacts.
- Скилл не привязан к конкретному проекту. Команды тестов, fixture и способ запуска приложения определяются по целевому репозиторию; bundled renderer получает только manifest и каталог вывода.

---
name: visualize-playwright-flows
description: Visualize a passing Playwright user flow as annotated screenshot evidence in a standalone HTML report or an MR/PR gallery. Use when asked to demonstrate or document a tested browser scenario; not for visual-regression baselines.
---

# Visualize Playwright flows

Создай визуальное доказательство проходящего behavioral scenario. Journey необязателен: шаги определяются по spec, а capture использует публичные POM, Journey и controls из fixture. Скилл применяется к целевому репозиторию; команды, profiles и окружение берутся из его конфигурации.

## Порядок работы

1. Определи формат по запросу и контексту: локальный HTML, галерея в конкретном MR/PR или оба. Если формат не определён, уточни его до capture; уже выбранный формат повторно не согласовывай.
2. Прочитай [capture-evidence.md](references/capture-evidence.md): обязательные правила подготовки, съёмки, безопасности, manifest и очистки. Подтверди прохождение целевого сценария на нужных profiles. При падении сообщи причину; частичные кадры не являются доказательством успешного flow.
3. Выведи шаги и ожидания из spec. Собери одну съёмку и один evidence manifest, используя временный harness только при необходимости.
4. Прочитай только выбранную инструкцию:
   - [standalone-html-report.md](references/standalone-html-report.md) — локальный HTML через [render-flow-report.ts](scripts/render-flow-report.ts) и проверка в браузере;
   - [review-gallery.md](references/review-gallery.md) — авторизация обновления, upload и проверка галереи.
5. Выполни проверки выбранного формата. Передай абсолютный путь HTML или ссылку на обновлённый MR/PR, укажи представленные сценарии и устройства. Очисти временные материалы по правилам capture, сохранив assets используемого отчёта.

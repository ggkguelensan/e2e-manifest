---
name: create-e2e-report
description: Create a local HTML report or prepare and publish an explicitly requested MR/PR report from existing E2E results, screenshots and design-comparison findings. Use for reporting; capture missing evidence separately.
---

# Create E2E report

Вход: реальные результаты запусков, область проверки, ревизии, profiles и доступные artifacts. Выход: локальный HTML или подготовленный/опубликованный раздел конкретного MR/PR. Вход в базу — [AGENTS.md](../../AGENTS.md), разрешения и хранение — [локальная политика](../../docs/local-workflow.md).

1. Определи формат и аудиторию. Если формат не выбран — локальный HTML. «Создай MR/PR-отчёт» допускает подготовку; публикация следует только явному поручению обновить конкретное описание или отправить конкретный комментарий. Не заменяй одно место публикации другим.
2. Прочитай [содержание отчёта](references/report-content.md). Проверь существование и происхождение evidence; результаты разных commits/profiles/attempts не объединяй в один успешный запуск. Missing/not-run остаются видимыми.
3. Нужны новые кадры — [capture skill](../visualize-playwright-flows/SKILL.md). Сравнение с дизайном выполняется отдельно по [протоколу интеграции](../../docs/design-comparison.md). Не повторяй тесты ради другого формата отчёта.
4. Читай только нужный формат: [локальный HTML](references/standalone-html-report.md) или [MR/PR](references/review-gallery.md).
5. Проверь итоговые ссылки/изображения и содержание. Верни абсолютный путь локального отчёта либо URL действительно обновлённого MR/PR. Отличай «подготовлен» от «опубликован», статическую проверку от просмотра в браузере. HTML, подготовленный текст и индексы хранятся в e2e/tmp/; текст публикации можно хранить полем JSON, не как отдельный реестр Markdown.

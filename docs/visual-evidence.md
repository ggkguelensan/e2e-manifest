# Визуальные доказательства

**Когда читать:** запрос кадров, MR/PR-галереи или автономного HTML-отчёта.
**Определяет:** выбор процедуры и источников правил визуализации.

Используй [visualize-playwright-flows](../skills/visualize-playwright-flows/SKILL.md). Skill выполняет capture проходящего behavioral scenario и направляет к одному нужному формату. Его ресурсы — единственный источник подробных правил:

| Задача | Документ |
| --- | --- |
| Capture, annotations, безопасность, evidence manifest и cleanup | [Capture evidence](../skills/visualize-playwright-flows/references/capture-evidence.md) |
| Загрузка кадров и обновление описания MR/PR | [Review gallery](../skills/visualize-playwright-flows/references/review-gallery.md) |
| Генерация и проверка автономного HTML | [Standalone report](../skills/visualize-playwright-flows/references/standalone-html-report.md) |

Шаги берутся из публичного сценария независимо от наличия Journey. Capture harness использует предоставленные POM, Journey и controls; reporting-код остаётся вне приложения и behavioral suite. Изображение дополняет semantic assertion и не является baseline. Оба формата строятся из одной съёмки и одного manifest.

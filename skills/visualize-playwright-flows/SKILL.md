---
name: visualize-playwright-flows
description: Capture annotated visual evidence from a passing Playwright scenario using its public spec and fixtures. Use when new browser captures are needed; existing results are formatted by create-e2e-report.
---

# Capture Playwright flows

1. Прочитай [capture-evidence](references/capture-evidence.md) и [локальную политику](../../docs/local-workflow.md). Получи выбранный spec, профили и ревизию; Journey необязателен.
2. Подтверди прохождение целевого сценария. Существенные шаги извлекаются из публичного spec без чтения реализации helpers. При падении сохрани диагностику, не выдавая её за успешный flow.
3. Используй публичные POM/Journey/controls из fixture. Отдельный временный harness допустим, когда штатных artifacts недостаточно. Не добавляй screenshot hooks в продукт, spec или POM.
4. Собери один evidence manifest с кадрами в e2e/tmp/. Дополнительный capture-прогон фиксируется как отдельное выполнение; он не является кадрами предшествующего теста.
5. Передай evidence в [create-e2e-report](../create-e2e-report/SKILL.md). Для сравнения с макетом используй [границу Design Manifest](../../docs/design-comparison.md); capture не устанавливает соответствие дизайну.

Skill использует полный комплект E2E Manifest: вход — [AGENTS.md](../../AGENTS.md). Сбор доказательств не включает публикацию.

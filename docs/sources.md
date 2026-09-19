# Источники и покрытие

Манифест извлечён из `apps/web-2/e2e` проекта Afisha, ветка `refactor/e2e-cleanup`, commit `12aaad7dc0b54a656dbc5be5e4f695335ad78564` от 2026-09-18. Дата переноса: 2026-09-19.

В основе — явно записанные правила E2E; runtime, его тесты, Playwright config и CI использованы для уточнения действующих инфраструктурных гарантий. Это не перенос бизнес-сценариев, product fixtures или приватной конфигурации окружений. Адреса сервисов и команды конкретного workspace заменены общими формулировками.

## Карта переноса

Все пути в первом столбце, кроме явно корневых, указаны относительно исходного `apps/web-2/e2e/`.

| Исходный документ или реализация | Раздел манифеста |
| --- | --- |
| `AGENTS.md` → `.claude/CLAUDE.md`: назначение, слои, инварианты, область E2E, scripts | [README](../README.md) |
| `.claude/agent_docs/behavioral-specs.md` | [Behavioral specs](behavioral-specs.md) |
| `.claude/agent_docs/journeys-and-pom.md` | [Journeys и POM](journeys-and-pom.md) |
| `.claude/agent_docs/api-contracts.md` | [API contracts](api-contracts.md) |
| `.claude/agent_docs/synthetic-backend.md` | [Synthetic backend](synthetic-backend.md) |
| `.claude/agent_docs/verification.md` | [Проверка изменений](verification.md) |
| `runtime/README.md`, `fixtures/msw-test.ts`, `runtime/mock-api.spec.ts` | [HTTP runtime](runtime.md) |
| `.claude/skills/visualize-playwright-flows/SKILL.md` | [Визуальные доказательства: выбор результата](visual-evidence.md#выбор-результата) |
| `.claude/skills/visualize-playwright-flows/references/capture-evidence.md` | [Capture и manifest](visual-evidence.md#подготовка-и-capture) |
| `.claude/skills/visualize-playwright-flows/references/gitlab-mr-gallery.md` | [Галерея MR/PR](visual-evidence.md#галерея-mrpr) |
| `.claude/skills/visualize-playwright-flows/references/standalone-html-report.md` | [Standalone HTML](visual-evidence.md#standalone-html) |
| Корневые `apps/web-2/playwright.config.ts`, `apps/web-2/playwright.runtime.config.ts`, `.gitlab/e2e.yml` | [Запуск и CI](runtime.md#запуск-и-ci) |
| Правила всех перечисленных слоёв | [Чек-лист ревью](review-checklist.md) |

## Разрешение различий версий

Более ранняя ветка `fix/e2e-app-shell-route-patterns` сверена с источником. Её правило «любой неизвестный API-запрос проваливает тест» сохранено для `strict`; актуальная версия дополнительно разрешает явно обозначенный `passthrough` smoke. Старую подмену app shell заменяет настоящее SSR-приложение с общим HTTP API для сервера и браузера.

Общие unit-testing правила проекта не подменяют область E2E: Playwright сохраняет `*.spec.ts`, отдельные behavioral и runtime suites. В частности, исторические screenshot suites не становятся основанием добавлять visual baselines: действующие инструкции E2E явно запрещают их.

В примере старого capture manifest встречались имена `01-start.png`; здесь они приведены к обязательному инварианту `01-start.tmp.png`. Диагностические Playwright screenshots при падении хранятся как временные CI artifacts и не смешиваются с review-кадрами проходящего flow.

## Поддержка манифеста

При изменении принципа обновляй тематический документ, краткую формулировку в README и соответствующий пункт чек-листа. При повторном переносе фиксируй новую исходную ревизию и различия её правил, чтобы устаревшие ограничения не смешивались с актуальной архитектурой.

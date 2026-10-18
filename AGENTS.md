# E2E Manifest

Определи target и текущий worktree. Найди внешнюю адаптацию в workdir закреплённой базы, прочитай [локальные границы](docs/local-workflow.md) и применимые [проектные требования](docs/project-patches.md). Не загружай весь комплект. Для изменения набора возможностей используй новый сеанс и проверь нативную видимость выбранных skills.

| Задача | Следующий документ |
| --- | --- |
| Подключить или создать E2E | [adapt-e2e-manifest](skills/adapt-e2e-manifest/SKILL.md) |
| Определить границы слоёв, Journey/POM | [Архитектура](docs/architecture.md) |
| Написать сценарий, проверить Gherkin ↔ spec | [Сценарии](docs/scenarios.md) |
| Подготовить состояние, fixture, внешнее событие | [Окружение](docs/environment.md) |
| Добавить HTTP-операцию, установить достоверность DTO | [Контракты](docs/contracts.md) |
| Проверить изменение или разобрать падение | [Проверка](docs/verification.md) |
| Собрать evidence | [Визуальные доказательства](docs/visual-evidence.md) |
| Создать HTML или подготовить PR/MR-отчёт | [create-e2e-report](skills/create-e2e-report/SKILL.md) |
| Сравнить UI с дизайном | [Интеграция Design](docs/design-comparison.md) |

После общей нормы загрузи только выбранный [стековый модуль](stack/README.md), затем условные подробности задачи. Наличие файлов базы не означает доступность всех skills продуктовому агенту.

Установка и обновление базы: [installation](docs/installation.md). Режим независим от ветки; не переключай её автоматически. При изменении базы задай E2E_MANIFEST_DEV=1, выполни [SSOT-аудит](docs/maintenance.md), npm run check, npm test и git diff --check. Инструменты пишутся на TypeScript. Не удаляй workdir и не публикуй изменения без поручения; локальные probes хранятся в игнорируемом e2e/tmp.

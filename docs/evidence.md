# Данные запуска и доказательств

Читай при capture, проверке результатов или построении отчёта. Владелец форматов — E2E Manifest: [run](../schemas/run.schema.json) и [evidence](../schemas/evidence.schema.json). Формат run — 1, evidence — 2; иные версии отклоняются без миграции. Схемы не копируются в приложение или Design Manifest.

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

## Рабочее обследование

[workspace.json](../schemas/workspace.schema.json) — наблюдение Git для выбранного target: repository/target IDs, физический worktree, вложенный путь, revision, branch (null при detached), dirty и время. `npm run discovery -- observe <target-root> <repository-id> <target-id>` выводит JSON без записи; сохрани его в target/e2e/tmp/workspace.json после проверки ignore. IDs получай из Project selection или явного standalone-выбора.

Рабочий [adaptation.json](../schemas/discovery.schema.json) закрепляет workspace по hash и содержит recorded_at, decisions, open_questions и limitations. Решение имеет ID, question, answer, basis и source: user/repository/inference. Это журнал обследования, не постоянная адаптация и не разрешение. Вывод агента с source=inference не подменяет ответ пользователя о стеке, области или доступе; нерешённые вопросы остаются открытыми. Согласованные нормативные настройки переноси к владельцу в workdir, сохраняя здесь только контекст обследования.

`npm run discovery -- validate <target-root> <repository-id> <target-id>` проверяет оба файла, идентичность, связи, hash, время и уникальность решений. Изменившиеся revision/dirty отражаются отдельными флагами; история не переписывается и не выдаётся за текущее состояние. Совпавший dirty не доказывает одинаковые незакоммиченные bytes. Валидатор не устанавливает истинность ответов и не объявляет адаптацию завершённой.

## Производный индекс

`npm run index -- <target-root>` выводит восстанавливаемый индекс, `--write` записывает target/e2e/tmp/index.json. Все найденные runs сначала проходят validate:evidence; повреждённый запуск прерывает построение и сохраняет прежний индекс. Каждый элемент содержит run_id и пути/hashes run.json и evidence.json. Статусы не копируются: потребитель читает авторитетный run по ссылке и проверяет hash. Изменение источника делает индекс устаревшим; пересоздай его после capture, не одновременно с записью запуска.

Пустой список означает отсутствие запусков, не успешное покрытие. Индекс соответствует [схеме](../schemas/index.schema.json), имеет schema_version 1 и generated_by e2e-manifest:index; автоматически заменяется только совместимый производный индекс этого инструмента. Неизвестный пользовательский файл и symlinks не перезаписываются. Review-данные принадлежат Design и в индекс запусков не включаются.

## Идентичность и время

`run.json` фиксирует repository/target IDs, физический worktree, target_path относительно него (`.` для корня), revision и dirty на момент запуска. Это наблюдение, не изменяемая копия реестра Project Manifest. Смена HEAD не переписывает прошлый результат.

Case — конкретные scenario_id, profile и attempt. Сохраняй spec path относительно target, его hash, название сценария и упорядоченные шаги. Устройства и повторы не создают новые scenario IDs покрытия. Steps имеют устойчивые ID, использованные при capture; соответствие Gherkin определяется [нормой сценариев](scenarios.md).

Сначала запиши running с finished_at=null. При завершении запиши конечные статусы; при остановке — interrupted и ограничения. Если процесс погиб до финализации, оставшееся running является незавершённым запуском. Отчёт не исправляет его в passed. Passed требует успешного case и не допускает failed/interrupted/running; skipped не означает проверенное поведение.

Evidence ссылается на case_id/step_id: repository, spec, profile и attempt выводятся через run, а не копируются в каждый объект. Каждый артефакт имеет время, описание, вид, MIME, hash и путь внутри своего run. Условия capture записываются по факту, не берутся из предположений о config. Conditions обязательны для каждого артефакта. Для screenshot нужны фактические UI-условия. Небраузерный log/attachment/trace использует `{ "execution": "non-browser", "environment": "<согласованная среда>", "state": "<проверенное состояние>" }`; не придумывай viewport, DPR, тему и locale. Environment — безопасный идентификатор среды без credentials; детали операции и проверенных samples находятся в артефакте. Лог браузерного шага сохраняет его UI-условия.

## Проверка

Из checkout закреплённой базы:

```sh
npm run validate:evidence -- --target /absolute/worktree/apps/web --run checkout-mobile
```

Проверяются схемы, уникальность IDs/attempts, связи, статусы, хронология, физические границы worktree/target/run, наличие и hashes файлов. Screenshot MIME сверяется с PNG/JPEG signature; это не полная проверка декодирования изображения. Spec hash сохраняет происхождение; валидатор исторических данных не требует совпадения с изменившимся текущим spec. Перед повторным использованием результата отдельно проверь revision/dirty и hashes текущих источников.

Проверка JSON не доказывает, что тест действительно выполнялся или screenshot показывает ожидаемый экран. Для этого нужны фактический runner, осмотр и сквозная проверка capture. Перенос run в другой worktree не сохраняет локальную валидность автоматически; исходное происхождение не переписывается ради зелёной проверки.

## Проектные предпочтения

Точка расширения для `settings.evidence_priority` из [проектного патча](project-patches.md): mobile-first, desktop-first или equal. Это порядок сбора согласованных доказательств, не копия viewport/device проектов runner и не разрешение пропускать остальные выбранные форм-факторы. При отсутствии значения уточни неизвестное предпочтение пользователя; не выводи его из размеров одного screenshot.

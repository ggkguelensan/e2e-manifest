# Данные запуска и доказательств

Читай при capture, проверке результатов или построении отчёта. Владелец форматов — E2E Manifest: [run](../schemas/run.schema.json) и [evidence](../schemas/evidence.schema.json). Формат обеих схем — 1; неизвестная версия отклоняется без миграции. Схемы не копируются в приложение или Design Manifest.

```text
<target-root>/e2e/tmp/
├── workspace.json
├── adaptation.json
├── coverage.csv
├── debt.csv
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

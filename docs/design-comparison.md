# Сравнение UI с дизайном

**Когда читать:** нужно оценить фактический UI относительно макета. E2E Manifest владеет выполнением/capture и [отчётами](../skills/create-e2e-report/SKILL.md). [Design Manifest](https://github.com/ggkguelensan/design-manifest) владеет источниками дизайна, ресурсами, методикой сравнения и skill `compare-ui-with-design`.

Найди явно подключённую локальную поставку Design Manifest и её AGENTS.md; зафиксируй revision. Не рассчитывай на соседний каталог или автоматически скачиваемый main. Пока подключения нет, можно подготовить E2E evidence; методику сравнения нельзя считать выполненной.

Передай выбранный run/attempt/profile, точный spec и шаг, hash spec и screenshot, время capture, viewport/DPR, тему, locale, состояние UI и ограничения. Evidence и сравнение живут в e2e/tmp/ текущего worktree. Исходники приложения и макеты не меняются в задаче ревью.

Обратно получи `comparison.json` по схеме выбранной поставки Design Manifest и проверенные ссылки на snapshots/assets. E2E не копирует эту schema и не вычисляет новый verdict: report отображает полученные findings и ограничения. Functional pass, визуальное соответствие и a11y — отдельные результаты.

## Локальный HTML

Из закреплённой базы E2E:

```sh
npm run report:design -- --target /absolute/worktree/apps/web --review review-id --design /absolute/design-manifest --revision <full-commit>
```

Рендерер проверяет точный commit и чистоту Design checkout, вызывает его `scripts/validate.ts`, затем читает comparison v2 и snapshot v1. Он не копирует схемы и не скачивает зависимости. Путь указывается явно: это запуск доверенного локального кода выбранной поставки, не обнаружение произвольного соседнего репозитория.

Для UI с run_id дополнительно проверяются исходные E2E run/evidence: revision, dirty, spec path/hash, step, profile, attempt, время, hash картинки и условия. Подменённая копия отклоняется. UI без run_id остаётся внешним источником с указанным provenance; E2E-запуск для него не подразумевается.

Выход — `design-review/<review-id>/reports/comparison-<hash>.html`. Отсутствующие источники показаны явно; все пары, статусы, findings, comparability и ограничения сохраняются. Оригиналы подключены относительными ссылками. PNG/JPEG отображаются, остальные ресурсы доступны как файлы без inline SVG. Форматирование не разрешает публикацию и не меняет verdict.

`npm run test:design -- <target-root> <run-id> <design-checkout>` проверяет интеграцию на существующих UI-кадрах: создаёт отдельный review с отсутствующим design reference, проверяет inconclusive/not-reviewed, отказ неверного pin, подменённого step и matched без источника; открывает HTML в Chromium на двух ширинах. Эта проверка подтверждает транспорт и честное отображение неполных данных, но не выполнение визуального сравнения с независимым дизайном.

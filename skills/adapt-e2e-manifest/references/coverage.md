# Данные покрытия и индексации

**Когда читать:** обследование, первый сценарий и каждое новое ограничение. **Результат:** связанные CSV/JSON в `e2e/tmp/`, без Markdown-реестров и автоматической публикации.

Хранение, `.gitignore`, локальный режим и разрешения определены в [локальной политике](../../../docs/local-workflow.md). Существующий реестр импортируй в этот формат с provenance; не веди второй рабочий источник истины и не удаляй оригинал пользователя без поручения.

## Файлы

Полная структура — в [данных evidence](../../../docs/evidence.md). Покрытие хранится в coverage.csv, долг в debt.csv, обследованные контракты при необходимости в contracts.csv. index.json — производный индекс связей; adaptation.json содержит рабочие решения и ограничения.

Создавай файл, когда для него есть данные; отсутствие файла означает «ещё не обследовано», а не пустое покрытие. CSV — UTF-8, заголовок обязателен, стандартное quoting запятых/кавычек/переносов; пустое поле означает неизвестное/неприменимое значение, не успех. JSON — UTF-8, `schema_version: 1`; IDs и ссылки проверяются перед сохранением. Не кодируй списки через произвольные разделители в CSV: отношения хранятся в JSON.

## Таблицы CSV

| Файл | Обязательные колонки |
| --- | --- |
| `coverage.csv` | `scenario_id,capability,scenario,spec,boundary,implementation,last_run_id` |
| `debt.csv` | `debt_id,kind,status,location,gap,workaround,risk,resolution,evidence_ref` |
| `contracts.csv` | `operation_id,service,method,path,source,source_revision,validation_status,evidence_ref,limitation` |

Одна строка coverage — самостоятельный сценарий, включая вариант параметризации. ID стабилен при переименовании; устройства учитываются в runs, не как новые сценарии. `implementation`: `planned`, `implemented`, `blocked`; planned без существующего spec имеет пустой `spec`, blocked связан с конкретным debt. `boundary`: `browser` или `browser+ssr`; исключения раскрываются в index.

`debt.kind`: `a11y`, `contract`, `topology`, `ssr`, `infrastructure`; `status`: `open`, `resolved`. Для a11y запиши компонент/POM-метод, отсутствующий accessible name/role/label, фактический fallback, проверку уникальности и целевой semantic locator. Functional pass не закрывает a11y-долг. Ненадёжная идентификация объекта означает blocked, а не произвольный `first()`/`nth()`.

`contracts.validation_status`: `not-run`, `passed-for-samples`, `mismatch`; source и статус не взаимозаменяемы. Источники, schema revision, среда/время и проверенные варианты раскрываются через evidence. Не выдумывай owner/issue и не создавай удалённые задачи.

## Разметка JSON

| Файл | Обязательная структура помимо `schema_version` |
| --- | --- |
| `index.json` | `repository` (HEAD и признаки локальных изменений), `manifest` (base revision, patch revisions, время/результат проверки актуальности и hashes загруженных MD-ресурсов), `scope` (приложения, включённые/исключённые пути, completeness), `files` (относительный path, роль, content hash), `operations` (operation ID, caller layer/origin/interceptor/state owner), `relations` (scenario ID → operation IDs/debt IDs) |
| `adaptation.json` | `decisions` (вопрос, выбранное значение, основание/ответ пользователя), `open_questions`, `limitations`; не хранит секреты и не выдаёт записанное разрешение за бессрочную авторизацию |

Пути к source (`spec`, `location`, `files.path`) относительны корню проекта; пути к evidence/report — `e2e/tmp/`. Не допускай выход из tmp для evidence и отчётов. Ссылки связываются по IDs; dangling/duplicate IDs считаются ошибкой индекса. Одна операция имеет одного владельца synthetic state в данном runtime; index показывает обнаруженные конфликты, не скрывает их слиянием записей.

До использования результатов сверь HEAD, content hashes затронутых файлов и base/patch revisions. Неполное обследование маркируется в scope, устаревший результат не переносится как passed. Discovery runner сверяет реальные specs с coverage без real-backend запросов.

## Учёт результата

Наличие spec не означает passed; прохождение нескольких samples не подтверждает полный контракт; количество device runs не равно числу сценариев. Run/evidence являются авторитетными данными запуска; HTML и индексы производны. CSV описывает покрытие, а не дублирует результаты отдельных попыток. Храни данные локально и не удаляй их при обычном cleanup. Изменение приложения для закрытия a11y-долга, запросы к real backend и публикация требуют соответствующего отдельного поручения.

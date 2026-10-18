# Стековые модули

Каталог модулей и их зависимости — `stack/catalog.json`. Выбирай возможности для конкретного target. [Setup](../docs/installation.md) проверяет явный список `E2E_MANIFEST_STACKS`, не удаляет файлы и не настраивает обнаружение skills.

- `playwright`: [локаторы, UI assertions и синхронизация](playwright/ui-abstractions.md). Общие права слоёв определены в [архитектуре](../docs/architecture.md).
- `msw`: [HTTP runtime и его lifecycle](msw/http-runtime.md).

Общие docs и skills пока требуют дальнейшего отделения Playwright/MSW от общих норм. Выбор модуля не доказывает поддержку другого runner/backend. Не объявляй невыбранные модули продуктовому агенту; подключение контекста проверяется отдельно.

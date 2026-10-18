# Сравнение UI с дизайном

**Когда читать:** нужно оценить фактический UI относительно макета. E2E Manifest владеет выполнением/capture и [отчётами](../skills/create-e2e-report/SKILL.md). [Design Manifest](https://github.com/ggkguelensan/design-manifest) владеет источниками дизайна, ресурсами, методикой сравнения и skill `compare-ui-with-design`.

Найди явно подключённую локальную поставку Design Manifest и её AGENTS.md; зафиксируй revision. Не рассчитывай на соседний каталог или автоматически скачиваемый main. Пока подключения нет, можно подготовить E2E evidence; методику сравнения нельзя считать выполненной.

Передай выбранный run/attempt/profile, точный spec и шаг, hash spec и screenshot, время capture, viewport/DPR, тему, locale, состояние UI и ограничения. Evidence и сравнение живут в e2e/tmp/ текущего worktree. Исходники приложения и макеты не меняются в задаче ревью.

Обратно получи `comparison.json` по схеме выбранной поставки Design Manifest и проверенные ссылки на snapshots/assets. E2E не копирует эту schema и не вычисляет новый verdict: report отображает полученные findings и ограничения. Functional pass, визуальное соответствие и a11y — отдельные результаты.

Схемы comparison не применяются к прежнему flow manifest: это отдельные артефакты, связанные явными source refs. В отчёте фиксируется версия каждого входа, а не предполагается совместимость по совпадению имени файла.

# Кампания «Конструкт-инженер» — мастер-таблица

Смотрим перед каждой рабочей сессией. Один уровень = одна строка.

## Поток данных (прототип)

Архитектурный слой таблиц — папка [`new/`](../new/README.md). После правок в CSV:

1. `node scripts/build-game-data.mjs` — пересборка [`game-data.json`](../game-data.json)
2. `node scripts/validate-levels.mjs` — проверка статики и сценариев

Симуляция движка и валидатора общая: [`lib/simulate.mjs`](../lib/simulate.mjs).

**Статусы:** `draft` → `data-in` → `validated` → `playtested` → `done`

| ID | Slug | Заказчик | One-liner задачи | Технологический смысл | Блок | Новая концепция | Монеты | Аура | maxOptional | Критические статусы | Путей | Статус |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1_MILLER_BARN | L1_miller_barn | Мельник Проспер | Добавить аудит входа в амбар | Access logging | A | Базовый цикл, долг→статус, закрытие долга, наследованный долг, обряд-субсидия (R_AI_BUFF) | 4 | 5 | — | F1_OVERFLOW, F4_BLINDNESS, F7_CONFUSION | 1 | `validated` |
| L2_KESHA_CACHE | L2_kesha_cache | Иннокентий «Кеша» | Превратить личный кэш в шареный сервис | Cache-as-a-Service: квоты, изоляция, AUTHZ | B | Опц. матрицы (maxOptional=1), выбор arch vs org пути, R_ONBOARDING (обряд-снижение-ауры) | 6 | 3 | 1 | F1_OVERFLOW, F3_COMPROMISE | 2 | `validated` |
| L3_GENNADY_LIGHTHOUSE | L3_gennady_lighthouse | Геннадий (Маяк) | Умные указатели с роутингом + фильтрация трафика | LBaaS: TLS, healthcheck, traffic routing, conflict resolution | B | Конфликты решений, разрешители конфликтов, наследованный D_NEEDS_HEALTHCHECK | 14 | 2 | — | F2_CONTRADICTION, F5_FRAGILITY | 2 | `validated` |
| L4_ANASTASIA_GOLDEN | L4_anastasia_golden | Анастасия (платформа) | Золотой стандарт: TLS + AuthZ + наблюдаемость | Golden Path: TLS, RBAC, healthcheck, observability | C | Обряды-лимит-Ауры (R_PATRON_SEAL +2 auraLimit) | 15 | 3 | — | F4_BLINDNESS, F5_FRAGILITY | 2 | `validated` |
| L5_KIRA_API | L5_kira_api | Кира Морозова | API-онбординг с audit trail и CI/CD | API platform: TLS, AuthZ, access logs, API CI/CD pipeline, **MR gates (CD_GATES)**, contract tests | C | reuse: delivery; **3 стартовых долга + cascade: S_API_CICD даёт 2 хвоста, S_API_MR_GATES даёт contract drift** | 18 | 3 | — | F3_COMPROMISE, F5_FRAGILITY, F6_NONDELIVERY, F8_AUDIT_GAP, F9_UNREVIEWED_RELEASE, F10_CONTRACT_DRIFT | 2 | `validated` |
| L6_MARK_SHARDING | L6_mark_sharding | Марк Игоревич | Horizontal sharding с hot-key, dry-run и quorum | Sharding: hash/key routing, schema/migration dry-run, observability, replication quorum | C | **новые стартовые дебафы** F11/F12/F13; 2 проходных решения; сложные cascade chains | 24 | 5 | — | F1_OVERFLOW, **F2_CONTRADICTION**, F5_FRAGILITY, F7_CONFUSION, F11_HOTSPOT, F12_SPLIT_BRAIN, F13_DARK_SHARD | 2 | `validated` |
| L7_EDWARD_MULTIDC | L7_edward_multidc | Эдуард (SRE) | Multi-DC: выбрать 4 контура из 7 | Multi-DC / HA-DR: TLS, AuthZ, global failover, region reconcile, DR drill, reserve capacity | C | **финальный выбор 4/7 матриц**, новые multi-DC дебафы F15/F16, каскады global healthcheck / capacity mirror | 30 | **9** | 4 | F1_OVERFLOW, F3_COMPROMISE, F5_FRAGILITY, F6_NONDELIVERY, F15_FAILOVER_LOOP, F16_CAPACITY_GAP | 2 | `validated` |

## Легенда

- **Блок A** — База: core loop, debt chain, закрытие долга, критические статусы.
- **Блок B** — Компромиссы: опциональные матрицы, некритические статусы (+аура), обряды, наследованные долги.
- **Блок C** — Комбинации: конфликты+разрешители, оба честных пути обязательны (архитектурный vs процессный).
- **Путей** — минимальное число валидных решений с разным типом компромисса (для блока C ≥ 2).

# Кампания «Конструкт-инженер» — мастер-таблица

Смотрим перед каждой рабочей сессией. Один уровень = одна строка.

**Статусы:** `draft` → `data-in` → `validated` → `playtested` → `done`

| ID | Slug | Заказчик | One-liner задачи | Технологический смысл | Блок | Новая концепция | Монеты | Аура | maxOptional | Критические статусы | Путей | Статус |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1_MILLER_BARN | L1_miller_barn | Мельник Проспер | Добавить аудит входа в амбар | Access logging | A | Базовый цикл, долг→статус, закрытие долга, наследованный долг, обряд-субсидия (R_AI_BUFF) | 4 | 5 | — | F1_OVERFLOW, F4_BLINDNESS, F7_CONFUSION | 1 | `validated` |
| L2_KESHA_CACHE | L2_kesha_cache | Иннокентий «Кеша» | Превратить личный кэш в шареный сервис | Cache-as-a-Service: квоты, изоляция, AUTHZ | B | Опц. матрицы (maxOptional=1), выбор arch vs org пути, R_ONBOARDING (обряд-снижение-ауры) | 6 | 3 | 1 | F1_OVERFLOW, F3_COMPROMISE | 2 | `validated` |
| L3_GENNADY_LIGHTHOUSE | L3_gennady_lighthouse | Геннадий (Маяк) | Умные указатели с роутингом + фильтрация трафика | LBaaS: TLS, healthcheck, traffic routing, conflict resolution | B | Конфликты решений, разрешители конфликтов | 14 | 2 | — | F3_COMPROMISE, F5_FRAGILITY, F4_BLINDNESS | 2 | `validated` |
| L4_ANASTASIA_GOLDEN | L4_anastasia_golden | Анастасия (платформа) | Золотой стандарт: TLS + AuthZ + наблюдаемость | Golden Path: TLS, RBAC, healthcheck, observability | C | Обряды-лимит-Ауры (R_PATRON_SEAL +2 auraLimit) | 15 | 3 | — | F4_BLINDNESS, F5_FRAGILITY | 2 | `validated` |
| L5_KIRA_API | L5_kira_api | Кира Морозова | API-онбординг с audit trail и CI/CD | API platform: TLS, AuthZ, access logs, CI/CD pipeline | C | reuse: все типы обрядов, F6_NONDELIVERY, D_NO_CICD | 18 | 4 | — | F3_COMPROMISE, F5_FRAGILITY, F6_NONDELIVERY | 2 | `validated` |
| L6_MARK_SHARDING | L6_mark_sharding | Марк Игоревич | Horizontal sharding с consistent hash и failover | Sharding: consistent hash routing, discovery, CI/CD | C | Опц. матрица + multi-obryad strategy | 17 | 4 | 1 | F1_OVERFLOW, F5_FRAGILITY | 2 | `validated` |
| L7_EDWARD_MULTIDC | L7_edward_multidc | Эдуард (SRE) | Multi-DC: все матрицы, full compliance | Multi-DC / HA-DR: TLS, AuthZ, failover, CI/CD, logging, quotas | C | S_MR_GATES (CD_GATES слот), полный набор обрядов | 24 | 5 | — | F5_FRAGILITY, F1_OVERFLOW, F3_COMPROMISE | 2 | `validated` |

## Легенда

- **Блок A** — База: core loop, debt chain, закрытие долга, критические статусы.
- **Блок B** — Компромиссы: опциональные матрицы, некритические статусы (+аура), обряды, наследованные долги.
- **Блок C** — Комбинации: конфликты+разрешители, оба честных пути обязательны (архитектурный vs процессный).
- **Путей** — минимальное число валидных решений с разным типом компромисса (для блока C ≥ 2).

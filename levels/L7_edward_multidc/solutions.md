# L7 — Эдуард: таблица решений

## Путь A — Edge + Audit + Capacity + Release

Устанавливаем четыре матрицы: `edge_l7`, `audit_l7`, `capacity_l7`, `release_l7`. Это «полный инженерный» путь: отдельный периметр, отдельная наблюдаемость, отдельная ёмкость и полный release-контур.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| `l7_auth` | `S_AUTHZ` | 4 | 1 |
| `l7_tls` | `S_TLS_CERT` | 2 | 1 |
| `l7_disc` | `S_DISCOVERY` | 2 | 1 |
| `l7_heart` | `S_GLOBAL_HEALTHCHECK` | 2 | 0 |
| `l7_logs` | `S_LOGGING` | 2 | 1 |
| `l7_filters` | `S_LOG_FILTER` | 2 | 0 |
| `l7_capacity` | `S_CAPACITY_MIRROR` | 2 | 0 |
| `l7_quota` | `S_QUOTAS` | 2 | 1 |
| `l7_pipe` | `S_CICD` | 2 | 1 |
| `l7_rb` | `S_ROLLBACK` | 2 | 1 |
| `l7_gate` | `S_REGION_RECONCILER` | 2 | 0 |
| `l7_drill` | `S_MULTI_REGION_DRILL` | 2 | 0 |
| Матрицы | 4 × 1 | 4 | 0 |
| **Итого** | | **30** | **7** |

**Активные долги**: нет.

**DoD**: TLS ✓, AuthZ ✓, Failover ✓, CI/CD ✓, Logs ✓, Quotas ✓, Region reconcile ✓, DR drill ✓, Reserve capacity ✓.

**Итог**: PASS (30 монет / 7 ауры).

## Путь B — Edge + Compliance + Reserve + Release

Устанавливаем `edge_l7`, `compliance_l7`, `reserve_l7`, `release_l7`. Это более плотный путь: логи, сверка регионов и DR-учение сидят в комплаенс-контуре, а резервная матрица совмещает ёмкость, квоты и аварийный routing.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| `l7_auth` | `S_AUTHZ` | 4 | 1 |
| `l7_tls` | `S_TLS_CERT` | 2 | 1 |
| `l7_disc` | `S_DISCOVERY` | 2 | 1 |
| `l7_heart` | `S_GLOBAL_HEALTHCHECK` | 2 | 0 |
| `l7_comp_logs` | `S_LOGGING` | 2 | 1 |
| `l7_comp_gate` | `S_REGION_RECONCILER` | 2 | 0 |
| `l7_comp_drill` | `S_MULTI_REGION_DRILL` | 2 | 0 |
| `l7_reserve_capacity` | `S_CAPACITY_MIRROR` | 2 | 0 |
| `l7_reserve_quota` | `S_QUOTAS` | 2 | 1 |
| `l7_pipe` | `S_CICD` | 2 | 1 |
| `l7_rb` | `S_ROLLBACK` | 2 | 1 |
| Матрицы | 4 × 1 | 4 | 0 |
| **Итого** | | **28** | **8** |

**Активные долги**: нет (`D_LOG_VOLUME` и `D_MIRROR_QUOTA_GAP` закрыты `S_QUOTAS`).

**Итог**: PASS (28 монет / 8 ауры).

## Ловушки

| Ловушка | Что пропущено | Итог |
|---|---|---|
| Нет `S_GLOBAL_HEALTHCHECK` | `D_FAILOVER_LOOP` и хвост `D_NEEDS_HEALTHCHECK` | FAIL: `F15_FAILOVER_LOOP`, `F5_FRAGILITY`, нет `REQ_FAIL` |
| Нет `S_REGION_RECONCILER` | Не выполнена обязательная сверка перед релизом | FAIL: нет `REQ_REGION_RECONCILE` |
| Нет `S_MULTI_REGION_DRILL` | Хвост `D_UNTESTED_FAILOVER` после глобального healthcheck | FAIL: `F5_FRAGILITY`, нет `REQ_DR_DRILL` |
| Нет `S_CAPACITY_MIRROR` | Стартовый `D_RESERVE_CAPACITY_GAP` | FAIL: `F16_CAPACITY_GAP`, нет `REQ_RESERVE_CAPACITY` |
| Есть `S_CAPACITY_MIRROR`, но нет `S_QUOTAS` | `D_MIRROR_QUOTA_GAP` и `D_LOG_VOLUME` | FAIL: `F1_OVERFLOW`, нет `REQ_QUOTA` |

## Что должен понять игрок

L7 не про «поставь всё». Семь матриц создают давление выбора: четыре контура должны одновременно закрыть стартовые долги, DoD и каскады от собственных решений. Самые важные хвосты: global healthcheck требует DR drill, capacity mirror требует квоты.

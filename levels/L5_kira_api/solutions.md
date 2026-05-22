# L5 — Кира: таблица решений

Источник истины по числам: `game-data.json` + `scripts/level-fixtures/L5_KIRA_API.expected.json`.  
Бюджет: **18 ⚗ / 3 ☠** (базовый лимит ауры; `R_PATRON_SEAL` даёт **+2** к лимиту на обоих проходных путях).

Матрицы (все опциональные, стоимость установки суммируется): `net_l5` (2), `obs_l5` (1), `chronicle_l5` (1), `cd_l5` (1), `resilience_l5` (2).

Конвейер `cd_l5`: слоты **CD_PIPELINE**, **CD_GATES**, **CD_TESTING**, **CD_ROLLBACK**, **RITUAL_CD** — зрелая доставка: пайплайн, гейты MR, контрактные тесты, откат, ритуал. Стартовых долгов три; delivery-долги раскрываются каскадом после `S_API_CICD` и `S_API_MR_GATES`.

---

## Путь A — Стандарт compliance (фильтр логов)

Матрицы: `net_l5` + `obs_l5` + `cd_l5` → **4** монеты установки.

| Слот | Карта | Монеты | Аура |
|---|---|---:|---:|
| l5_auth | S_AUTHZ | 4 | +1 |
| l5_logs | S_ACCESS_LOGS | 3 | +1 |
| l5_filters | S_LOG_FILTER | 2 | −1 |
| l5_pipe | S_API_CICD | 2 | +1 |
| l5_gate | S_API_MR_GATES | 2 | +1 |
| l5_contract | S_CONTRACT_TESTS | 1 | 0 |
| l5_rb | S_ROLLBACK | 2 | +1 |
| l5_cd_rit | R_PATRON_SEAL | −2 | +1 |

**Карты:** 14 ⚗ **+ матрицы 4** = **18** ⚗. **Аура:** 1+1−1+1+1+0+1+1 = **5** при **лимите 5** (`R_PATRON_SEAL`: `auraLimitDelta` +2). D_ACCESS_LOG_VOLUME снят фильтром — некритичного переполнения нет.

**Итог:** PASS.

**Урок:** аудит через `S_ACCESS_LOGS` + технический контроль объёма (`S_LOG_FILTER`); `S_API_CICD` лечит недоставку, но сразу открывает два хвоста — откат и MR-гейт. `S_API_MR_GATES` закрывает гейт и открывает следующий хвост — контрактные тесты.

---

## Путь B — Релизный контур (MR gates + Печать Мецената)

Матрицы: `net_l5` + `obs_l5` + `cd_l5` → **4** монеты установки.

| Слот | Карта | Монеты | Аура |
|---|---|---:|---:|
| l5_auth | S_AUTHZ | 4 | +1 |
| l5_logs | S_ACCESS_LOGS | 3 | +1 |
| l5_obs_rit | R_LOG_ARCHIVE | 2 | −2 |
| l5_pipe | S_API_CICD | 2 | +1 |
| l5_gate | S_API_MR_GATES | 2 | +1 |
| l5_contract | S_CONTRACT_TESTS | 1 | 0 |
| l5_rb | S_ROLLBACK | 2 | +1 |
| l5_cd_rit | R_PATRON_SEAL | −2 | +1 |

**Карты (нетто по золоту):** 4+3+2+2+2+1+2−2 = **14** ⚗ **+ матрицы 4** = **18** ⚗. **Аура карт:** 1+1−2+1+1+0+1+1 = **4** при **лимите 5** (`R_PATRON_SEAL`: `auraLimitDelta` +2).

**Итог:** PASS.

**Урок:** release contour разворачивается цепочкой: `S_API_CICD` → `S_ROLLBACK` + `S_API_MR_GATES` → `S_CONTRACT_TESTS`. Печать Мецената в **RITUAL_CD** покупает запас по ауре под весь каскад.

---

## Ловушки (см. fixture)

| # | Суть | Результат |
|---|------|-----------|
| 1 | `resilience_l5`: `S_DISCOVERY` без `S_HEALTHCHECK` | F5_FRAGILITY |
| 2 | `chronicle_l5`: `S_ACCESS_LOGS` без `R_LOG_ARCHIVE` | аура выше лимита (volume) |
| 3 | `S_API_CICD` без `S_ROLLBACK` | F5_FRAGILITY |
| 4 | Нет `S_AUTHZ` | F3_COMPROMISE |
| 5 | `S_API_MR_GATES` без `S_API_CICD` | F6_NONDELIVERY |
| 6 | `S_LOGGING` + фильтр вместо `S_ACCESS_LOGS` — объём под контролем, аудита доступа нет | F8_AUDIT_GAP |
| 7 | `S_API_CICD` породил `D_NO_REVIEW_GATES`, но `S_API_MR_GATES` не поставлен | F9_UNREVIEWED_RELEASE |
| 8 | `S_API_MR_GATES` породил `D_PARTNER_CONTRACT_DRIFT`, но `S_CONTRACT_TESTS` не поставлены | F10_CONTRACT_DRIFT |

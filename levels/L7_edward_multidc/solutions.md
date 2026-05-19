# L7 — Эдуард: таблица решений

## Путь A — Классический Multi-DC (без обрядов)

Стандартная сборка: S_LOGGING (Перо Летописца) + S_QUOTAS (Предел Закромов) закрывают D_LOG_VOLUME через M_STORAGE (Матрица Хранения). D_NO_CICD закрыт S_CICD (Ритуал Доставки) + S_ROLLBACK (Ключ Отката).

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| l7_auth | S_AUTHZ (Страж Порогов) | 3 | 0 |
| l7_tls | S_TLS_CERT (Печать Серта) | 2 | 0 |
| l7_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 |
| l7_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 |
| l7_logs | S_LOGGING (Перо Летописца) | 2 | +1 |
| l7_quota | S_QUOTAS (Предел Закромов) | 2 | +1 |
| l7_pipe | S_CICD (Ритуал Доставки) | 2 | +1 |
| l7_rb | S_ROLLBACK (Ключ Отката) | 2 | 0 |
| **Итого** | | **17** | **4** |

**Активные долги**: нет
**Capabilities**: HAS_AUTHZ, HAS_TLS, HAS_DISCOVERY, HAS_HEALTHCHECK, HAS_FAILOVER, HAS_LOGS, HAS_QUOTAS, HAS_CICD, HAS_ROLLBACK
**DoD**: HAS_TLS ✓, HAS_AUTHZ ✓, HAS_FAILOVER ✓, HAS_CICD ✓, HAS_LOGS ✓, HAS_QUOTAS ✓
**Итог**: PASS (17 монет / 4 ауры)

**Что понимает игрок**: минималистичный путь оставляет 7 монет запаса. Аура = 4 из 5. Есть пространство для обрядов и дополнительных карт, если нужен S_MR_GATES (Страж Врат MR).

---

## Путь B — Multi-DC с Канарейкой и LOG_FILTER

Расширенная сборка: добавляет S_LOG_FILTER (фильтрация логов) и R_CANARY (-1 ауры) для максимального контроля наблюдаемости.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| l7_auth | S_AUTHZ (Страж Порогов) | 3 | 0 |
| l7_tls | S_TLS_CERT (Печать Серта) | 2 | 0 |
| l7_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 |
| l7_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 |
| l7_logs | S_LOGGING (Перо Летописца) | 2 | +1 |
| l7_filters | S_LOG_FILTER (Сито Смыслов) | 2 | 0 |
| l7_quota | S_QUOTAS (Предел Закромов) | 2 | +1 |
| l7_pipe | S_CICD (Ритуал Доставки) | 2 | +1 |
| l7_rb | S_ROLLBACK (Ключ Отката) | 2 | 0 |
| l7_obs_rit | R_CANARY (Канарейка в шахте) | 1 | −1 |
| **Итого** | | **20** | **3** |

**Активные долги**: нет (D_LOG_VOLUME закрыт S_LOG_FILTER (Сито Смыслов) и S_QUOTAS (Предел Закромов))
**DoD**: HAS_TLS ✓, HAS_AUTHZ ✓, HAS_FAILOVER ✓, HAS_CICD ✓, HAS_LOGS ✓, HAS_QUOTAS ✓
**Итог**: PASS (20 монет / 3 ауры)

**Что понимает игрок**: добавление S_LOG_FILTER (Сито Смыслов) стоит 2 монеты и ничего по ауре — это «бесплатное» улучшение по ауре. R_CANARY (Канарейка в шахте) снижает аура-давление, давая запас для будущих долгов. Комфортный запас ауры (2 единицы).

---

## Ловушка — Нет квот (F1_OVERFLOW + REQ_QUOTA)

| Слот | Карта |
|---|---|
| l7_auth | S_AUTHZ (Страж Порогов) |
| l7_tls | S_TLS_CERT (Печать Серта) |
| l7_disc1 | S_DISCOVERY (Зов Разведчика) |
| l7_disc2 | S_HEALTHCHECK (Сердцебиение) |
| l7_logs | S_LOGGING (Перо Летописца) |
| l7_pipe | S_CICD (Ритуал Доставки) |
| l7_rb | S_ROLLBACK (Ключ Отката) |

**Активные долги**: D_LOG_VOLUME → F1_OVERFLOW (критический!); D_NO_CICD закрыт
**Аура**: 1(DISC)+1(LOG)+1(CICD) + 2(F1_OVERFLOW non-crit? или crit?) ...

> F1_OVERFLOW входит в criticalStatuses L7 → это критический статус!

**Итог**: FAIL — F1_OVERFLOW (критический) + REQ_QUOTA не закрыт (HAS_QUOTAS отсутствует)

**Что понимает игрок**: в Multi-DC без квот рост данных немедленно критичен. S_QUOTAS (Предел Закромов) — обязательная карта, а не опциональная. D_LOG_VOLUME без резолвера убивает систему.

# L6 — Марк: таблица решений

## Путь A — Классический шардинг (S_LOG_FILTER (Сито Смыслов), без M_STORAGE (Матрица Хранения))

Чистое решение без опциональной матрицы: S_LOGGING (Перо Летописца) + S_LOG_FILTER (Сито Смыслов) закрывают долг журналирования.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| l6_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 |
| l6_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 |
| l6_route1 | S_HASH_ROUTING (Якорь Сессии) | 2 | +1 |
| l6_logs | S_LOGGING (Перо Летописца) | 2 | +1 |
| l6_filters | S_LOG_FILTER (Сито Смыслов) | 2 | 0 |
| l6_pipe | S_CICD (Ритуал Доставки) | 2 | +1 |
| l6_rb | S_ROLLBACK (Ключ Отката) | 2 | 0 |
| **Итого** | | **14** | **4** |

**Активные долги**: нет
**Capabilities**: HAS_DISCOVERY, HAS_HEALTHCHECK, HAS_FAILOVER, HAS_HASH_ROUTING, HAS_LOGS, HAS_LOG_FILTERING, HAS_CICD, HAS_ROLLBACK
**DoD**: HAS_HASH_ROUTING ✓, HAS_FAILOVER ✓, HAS_LOGS ✓, HAS_CICD ✓
**Итог**: PASS (14 монет / 4 ауры = лимит)

**Что понимает игрок**: стандартный путь работает без опциональной матрицы. Аура ровно на лимите — свободных монет много (17-14=3), но аура не позволяет добавить что-то тяжёлое.

---

## Путь B — Субсидия (M_STORAGE (Матрица Хранения) + R_LIBRARY_GRANT (Академический Грант) + R_GUARD_TO_BAR (Стражника в бар))

M_STORAGE (Матрица Хранения) открывает S_QUOTAS (резолвер D_LOG_VOLUME) и RITUAL_ST для R_LIBRARY_GRANT (-3 монеты). R_GUARD_TO_BAR (Стражника в бар) снижает ауру на 2, компенсируя доп. расходы по ауре.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| l6_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 |
| l6_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 |
| l6_route1 | S_HASH_ROUTING (Якорь Сессии) | 2 | +1 |
| l6_logs | S_LOGGING (Перо Летописца) | 2 | +1 |
| l6_quota | S_QUOTAS (Предел Закромов) | 2 | +1 |
| l6_pipe | S_CICD (Ритуал Доставки) | 2 | +1 |
| l6_rb | S_ROLLBACK (Ключ Отката) | 2 | 0 |
| l6_st_rit | R_LIBRARY_GRANT (Академический Грант) | 1 (−3 coinsDelta) | 0 |
| l6_net_rit | R_GUARD_TO_BAR (Стражника в бар) | 0 | −2 |
| M_STORAGE (st_l6) | — | +2 | — |
| **Итого** | | **15** | **3** |

*Расчёт монет: (2+2+2+2+2+2+2) + (1−3) + 0 + 2 = 13 + (−2) + 2 = 13c... wait:*
*Карты: 2+2+2+2+2+2+2+1+0 = 15, coinsDelta = −3, matrix = 2 → итого 15−3+2 = 14*

| **Пересчёт** | | **14** | **3** |

**Активные долги**: нет (D_LOG_VOLUME закрыт S_QUOTAS (Предел Закромов))
**DoD**: HAS_HASH_ROUTING ✓, HAS_FAILOVER ✓, HAS_LOGS ✓, HAS_CICD ✓
**Итог**: PASS (14 монет / 3 ауры)

**Что понимает игрок**: покупка M_STORAGE (Матрица Хранения) + R_LIBRARY_GRANT (Академический Грант) суммарно «стоит» -1 монету (2 за матрицу − 3 от обряда), но открывает слот для S_QUOTAS (Предел Закромов). Два обряда вместе (R_LIBRARY_GRANT (Академический Грант) + R_GUARD_TO_BAR (Стражника в бар)) — первый пример многосоставной стратегии с обрядами.

---

## Ловушка — S_DISCOVERY (Зов Разведчика) без S_HEALTHCHECK (F5_FRAGILITY)

| Слот | Карта |
|---|---|
| l6_disc1 | S_DISCOVERY (Зов Разведчика) |
| l6_route1 | S_HASH_ROUTING (Якорь Сессии) |
| l6_logs | S_LOGGING (Перо Летописца) |
| l6_filters | S_LOG_FILTER (Сито Смыслов) |
| l6_pipe | S_CICD (Ритуал Доставки) |
| l6_rb | S_ROLLBACK (Ключ Отката) |

**Активные долги**: D_NEEDS_HEALTHCHECK → F5_FRAGILITY (критический!), D_LOG_VOLUME → закрыт S_LOG_FILTER (Сито Смыслов)
**Итог**: FAIL — F5_FRAGILITY + REQ_FAILOVER не закрыт

**Что понимает игрок**: шардинг без healthcheck — хрупкость. При падении шарда нет механизма failover. DISCOVERY всегда нужен HEALTHCHECK.

# L5 — Кира: таблица решений

## Путь A — Полный контур + R_CANARY (Канарейка в шахте)

ACCESS_LOGS создаёт некритический F1_OVERFLOW (+2 ауры). R_CANARY (Канарейка в шахте) в OBS компенсирует -1. Баланс ауры: 2 (карты) + (-1) (R_CANARY (Канарейка в шахте)) + 2 (F1) = 3. Без R_CANARY (Канарейка в шахте) аура = 4 — ровно на лимите; с любым дополнительным долгом провал.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| l5_tls | S_TLS_CERT (Печать Серта) | 2 | 0 |
| l5_auth | S_AUTHZ (Страж Порогов) | 3 | 0 |
| l5_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 |
| l5_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 |
| l5_logs | S_ACCESS_LOGS (Книга Доступа) | 3 | +1 |
| l5_pipe | S_CICD (Ритуал Доставки) | 2 | +1 |
| l5_rb | S_ROLLBACK (Ключ Отката) | 2 | 0 |
| l5_obs_rit | R_CANARY (Канарейка в шахте) | 1 | −1 |
| Некрит. F1_OVERFLOW | — | — | +2 |
| **Итого** | | **17** | **4** |

**Активные долги**: D_ACCESS_LOG_VOLUME → F1_OVERFLOW (некритический)
**Capabilities**: HAS_TLS, HAS_AUTHZ, HAS_FAILOVER, HAS_ACCESS_LOGS, HAS_CICD, HAS_ROLLBACK
**DoD**: HAS_TLS ✓, HAS_AUTHZ ✓, HAS_FAILOVER ✓, HAS_CICD ✓, HAS_ACCESS_LOGS ✓
**Итог**: PASS (17 монет / 4 ауры = лимит)

**Что понимает игрок**: аура стоит ровно на лимите. R_CANARY (Канарейка в шахте) даёт запас -1, и только это позволяет пройти. Compliance всегда стоит обряда.

---

## Путь B — R_GUARD_TO_BAR (экономия ауры, нет монет)

R_GUARD_TO_BAR (Стражника в бар) в RITUAL_NET — бесплатный обряд (-2 ауры). Итоговая аура = 3, запас 1.

| Слот | Карта | Монеты | Аура |
|---|---|---|---|
| l5_tls | S_TLS_CERT (Печать Серта) | 2 | 0 |
| l5_auth | S_AUTHZ (Страж Порогов) | 3 | 0 |
| l5_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 |
| l5_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 |
| l5_logs | S_ACCESS_LOGS (Книга Доступа) | 3 | +1 |
| l5_pipe | S_CICD (Ритуал Доставки) | 2 | +1 |
| l5_rb | S_ROLLBACK (Ключ Отката) | 2 | 0 |
| l5_net_rit | R_GUARD_TO_BAR (Стражника в бар) | 0 | −2 |
| Некрит. F1_OVERFLOW | — | — | +2 |
| **Итого** | | **16** | **3** |

**DoD**: HAS_TLS ✓, HAS_AUTHZ ✓, HAS_FAILOVER ✓, HAS_CICD ✓, HAS_ACCESS_LOGS ✓
**Итог**: PASS (16 монет / 3 ауры)

**Что понимает игрок**: R_GUARD_TO_BAR (Стражника в бар) стоит 0 монет и сильнее снижает ауру, чем R_CANARY (Канарейка в шахте). Выбор зависит от нужного ресурса — монеты дороже на других уровнях.

---

## Ловушка 1 — Нет CICD (F6_NONDELIVERY)

| Слот | Карта |
|---|---|
| l5_tls | S_TLS_CERT (Печать Серта) |
| l5_auth | S_AUTHZ (Страж Порогов) |
| l5_disc1 | S_DISCOVERY (Зов Разведчика) |
| l5_disc2 | S_HEALTHCHECK (Сердцебиение) |
| l5_logs | S_ACCESS_LOGS (Книга Доступа) |

**Активные долги**: D_NO_CICD → F6_NONDELIVERY (критический!)
**Итог**: FAIL — F6_NONDELIVERY + REQ_CICD не закрыт

**Что понимает игрок**: D_NO_CICD активен с самого старта уровня. Без S_CICD (Ритуал Доставки) провал неизбежен, даже если всё остальное в порядке.

---

## Ловушка 2 — CICD без ROLLBACK (F5_FRAGILITY)

| Слот | Карта |
|---|---|
| l5_tls | S_TLS_CERT (Печать Серта) |
| l5_auth | S_AUTHZ (Страж Порогов) |
| l5_disc1 | S_DISCOVERY (Зов Разведчика) |
| l5_disc2 | S_HEALTHCHECK (Сердцебиение) |
| l5_logs | S_ACCESS_LOGS (Книга Доступа) |
| l5_pipe | S_CICD (Ритуал Доставки) |
| l5_net_rit | R_GUARD_TO_BAR (Стражника в бар) |

**Активные долги**: D_NEEDS_ROLLBACK → F5_FRAGILITY (критический!); D_ACCESS_LOG_VOLUME → F1_OVERFLOW (некрит., +2a)
**Аура**: 0+0+1+0+1+1+(-2)+2 = 3 — достаточно, чтобы пройти по ауре
**Итог**: FAIL — F5_FRAGILITY

**Что понимает игрок**: S_CICD (Ритуал Доставки) всегда добавляет D_NEEDS_ROLLBACK. Пара «CICD → ROLLBACK» обязательна.

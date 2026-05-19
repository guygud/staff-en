# L3 Маяк — Таблица решений

`coinsBudget=14`, `auraLimit=2`, criticalStatuses: F2_CONTRADICTION, F5_FRAGILITY  
Предустановлено: HAS_AUTHZ

---

## Путь A — Простой маяк (TRAFFIC_SPLIT)

| Слот | Карта | Монеты | Аура | Эффект |
|---|---|---|---|---|
| l3_dns | S_DNS (Глашатай Домена) | 2 | 0 | HAS_DNS |
| l3_tls | S_TLS_CERT (Печать Серта) | 2 | 0 | HAS_TLS |
| l3_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | +1 | HAS_DISCOVERY, D_NEEDS_HEALTHCHECK |
| l3_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | 0 | HAS_FAILOVER, resolves D_NEEDS_HEALTHCHECK |
| l3_route1 | S_TRAFFIC_SPLIT (Весы Потоков) | 2 | +1 | HAS_TRAFFIC_SPLIT |

coinsSpent: **10** ≤ 14 ✓ · auraTotal: **2** ≤ 2 ✓ · fatalStatuses: нет → **PASS**

---

## Путь B — Умный маяк (оба роутинга + Арбитр + Меценат)

| Слот | Карта | Монеты | coinsDelta | Аура | auraLimitDelta |
|---|---|---|---|---|---|
| l3_dns | S_DNS (Глашатай Домена) | 2 | — | 0 | — |
| l3_tls | S_TLS_CERT (Печать Серта) | 2 | — | 0 | — |
| l3_disc1 | S_DISCOVERY (Зов Разведчика) | 2 | — | +1 | — |
| l3_disc2 | S_HEALTHCHECK (Сердцебиение) | 2 | — | 0 | — |
| l3_route1 | S_TRAFFIC_SPLIT (Весы Потоков) | 2 | — | +1 | — |
| l3_route2 | S_HASH_ROUTING (Якорь Сессии) | 2 | — | +1 | — |
| l3_route3 | S_POLICY_RESOLVER (Арбитр Печатей) | 3 | — | 0 | — |
| l3_ritual | R_PATRON_SEAL (Печать Мецената) | 1 | -3 | 0 | +2 |

coinsSpent: 2+2+2+2+2+2+3+1-3 = **13** ≤ 14 ✓  
auraTotal: 1+0+1+1+0 = **3**, auraLimitFinal: 2+2 = **4** → 3 ≤ 4 ✓ · **PASS**

---

## Ловушка 1 — Конфликт без арбитра (F2_CONTRADICTION)

| Слот | Карта |
|---|---|
| l3_dns, l3_tls, l3_disc1, l3_disc2 | DNS, TLS, DISCOVERY, HEALTHCHECK (как в пути A) |
| l3_route1 | S_TRAFFIC_SPLIT (Весы Потоков) |
| l3_route2 | S_HASH_ROUTING (Якорь Сессии) |

coinsSpent: 12 ≤ 14 ✓ · auraTotal: **3** > 2 → аура превышена  
CP_ROUTING_CONFLICT → fatalStatuses: **F2_CONTRADICTION** → **FAIL**

---

## Ловушка 2 — Discovery без Healthcheck (F5_FRAGILITY)

| Слот | Карта |
|---|---|
| l3_dns | S_DNS (Глашатай Домена) |
| l3_tls | S_TLS_CERT (Печать Серта) |
| l3_disc1 | S_DISCOVERY (Зов Разведчика) |
| l3_route1 | S_TRAFFIC_SPLIT (Весы Потоков) |

D_NEEDS_HEALTHCHECK не закрыт → F5_FRAGILITY (крит.)  
missingRequirements: REQ_FAILOVER → **FAIL**

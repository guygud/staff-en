# L7 — Эдуард: Multi-DC

## Нарратив

> «Семь контуров выглядят надёжно на бумаге. Но в машинном зале встанут только четыре. Выбирай так, чтобы второй дата-центр был не декорацией, а настоящим спасением.»
> — Эдуард, SRE principal

Эдуард проектирует финальную multi-DC архитектуру. В отличие от прошлых уровней, здесь открыты семь матриц, но установить можно только четыре. Игрок должен выбрать архитектурный срез: где держать наблюдаемость, где проверять релизы, как закрыть резервную ёмкость и как провести аварийное переключение без ручного героизма.

## Технологический смысл

Multi-datacenter / HA-DR setup: TLS + AuthZ на краю, discovery с глобальным healthcheck, воспроизводимая доставка с rollback, сверка регионов, DR-учение, централизованные логи, квоты и резервная ёмкость.

## DoD — что должен принять Эдуард

| Требование | Capability ID | Источник |
|---|---|---|
| TLS-шифрование | `HAS_TLS` | `S_TLS_CERT` |
| Авторизация | `HAS_AUTHZ` | `S_AUTHZ` |
| Failover | `HAS_FAILOVER` | `S_GLOBAL_HEALTHCHECK` |
| Воспроизводимая доставка | `HAS_CICD` | `S_CICD` |
| Централизованное журналирование | `HAS_LOGS` | `S_LOGGING` |
| Квоты | `HAS_QUOTAS` | `S_QUOTAS` |
| Сверка регионов | `HAS_REGION_RECONCILE` | `S_REGION_RECONCILER` |
| DR-учение | `HAS_DR_DRILL` | `S_MULTI_REGION_DRILL` |
| Резервная ёмкость | `HAS_RESERVE_CAPACITY` | `S_CAPACITY_MIRROR` |

## Ограничения

- **Монеты**: 30
- **Аура**: 9
- **Матрицы**: 7 на выбор, установить можно только 4 (`maxOptionalMatrices = 4`)

## Заказчик не простит

| Статус | Почему критический |
|---|---|
| `F6_NONDELIVERY` | Первый ковчег деплоили вручную; без CI/CD два DC невозможно держать одинаковыми |
| `F15_FAILOVER_LOOP` | Локальные проверки без глобального взгляда гоняют трафик между DC |
| `F16_CAPACITY_GAP` | Резервный DC не выдерживает полный поток основного |
| `F5_FRAGILITY` | Discovery без healthcheck или CI/CD без rollback/DR drill ломают отказоустойчивость |
| `F1_OVERFLOW` | Логи и зеркало ёмкости без квот переполняют резерв |
| `F3_COMPROMISE` | Доступ без защиты недопустим на межрегиональном периметре |

## Стартовые долги

```text
D_NO_CICD -> F6_NONDELIVERY
D_FAILOVER_LOOP -> F15_FAILOVER_LOOP
D_RESERVE_CAPACITY_GAP -> F16_CAPACITY_GAP
```

## Доступные матрицы

| Instance | Название | Слоты | Роль |
|---|---|---|---|
| `edge_l7` | Край Двух Обелисков | `NET_AUTH`, `NET_TLS`, `NET_DISCOVERY`×2 | Базовый периметр и глобальный failover |
| `audit_l7` | Башня Сквозной Летописи | `OBS_LOGS`, `OBS_FILTERS`, `RITUAL_OBS` | Логи + фильтр шума |
| `capacity_l7` | Зеркальные Закрома | `ST_RETENTION`, `ST_QUOTA`, `RITUAL_ST` | Резервная ёмкость + квоты |
| `release_l7` | Двухрегионный Конвейер | `CD_PIPELINE`, `CD_GATES`, `CD_TESTING`, `CD_ROLLBACK`, `RITUAL_CD` | Доставка, rollback, region reconcile, DR drill |
| `traffic_l7` | Весы Межрегионального Трафика | `NET_ROUTING`, `NET_DISCOVERY`, `RITUAL_NET` | Альтернативный traffic-контур |
| `compliance_l7` | Палата Комплаенса | `OBS_LOGS`, `CD_GATES`, `CD_TESTING`, `RITUAL_OBS` | Логи + release-проверки без отдельной audit-башни |
| `reserve_l7` | Резервный Перевал | `ST_RETENTION`, `ST_QUOTA`, `NET_ROUTING`, `RITUAL_NET` | Ёмкость, квоты и аварийный routing |

## Ключевые каскады

```text
D_FAILOVER_LOOP
  -> S_GLOBAL_HEALTHCHECK
    -> D_UNTESTED_FAILOVER -> S_MULTI_REGION_DRILL

D_RESERVE_CAPACITY_GAP
  -> S_CAPACITY_MIRROR
    -> D_MIRROR_QUOTA_GAP -> S_QUOTAS

D_NO_CICD
  -> S_CICD
    -> D_NEEDS_ROLLBACK -> S_ROLLBACK

S_LOGGING
  -> D_LOG_VOLUME -> S_LOG_FILTER или S_QUOTAS
```

## Подсказки игроку

- `S_DISCOVERY` сам по себе не лечит failover: для L7 нужен `S_GLOBAL_HEALTHCHECK`.
- `S_REGION_RECONCILER` остаётся обязательной release-проверкой, но больше не создаёт отдельный debuff.
- `S_CAPACITY_MIRROR` обязателен для резерва, но без `S_QUOTAS` даёт переполнение.
- Два честных пути: отдельные `audit_l7` + `capacity_l7` или более плотные `compliance_l7` + `reserve_l7`.

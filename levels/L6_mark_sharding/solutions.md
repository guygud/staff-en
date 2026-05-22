# L6 — Голуби Марка: Дизайн-документ

**Источник истины по числам:** `game-data.json` + `scripts/level-fixtures/L6_MARK_SHARDING.expected.json`.

## Стартовые долги

| Долг | Статус если не закрыт | Нарратив |
|---|---|---|
| `D_ROUTING_AMBIGUITY` | `F11_HOTSPOT` | Голуби не знают, в какой шард лететь, и перегревают случайный диапазон |
| `D_SCHEMA_DRIFT` | `F12_SPLIT_BRAIN` | Разные шарды отвечают разной схемой |
| `D_NO_OBSERVABILITY` | `F13_DARK_SHARD` | Шард работает в темноте, полёты не записываются |

## Критические статусы

`F1_OVERFLOW`, `F2_CONTRADICTION`, `F5_FRAGILITY`, `F7_CONFUSION`, `F11_HOTSPOT`, `F12_SPLIT_BRAIN`, `F13_DARK_SHARD`.

Конфликт `CP_SHARD_KEY_VS_HASH`: одновременно `S_SHARD_KEY` и `S_HASH_ROUTING` без `S_POLICY_RESOLVER` -> `F2_CONTRADICTION`.

## Каскадные цепочки

```text
D_ROUTING_AMBIGUITY
  -> S_SHARD_KEY
    -> D_SHARD_IMBALANCE -> S_REBALANCER
      -> D_REBALANCE_WINDOW -> S_MIGRATION_DRY_RUN
      -> D_HOT_PARTITION -> S_HOT_KEY_SPLITTER

D_SCHEMA_DRIFT
  -> S_SCHEMA_GUARD
    -> D_NEEDS_MIGRATION -> S_CICD -> D_NEEDS_ROLLBACK -> S_ROLLBACK
    -> D_BACKFILL_UNVERIFIED -> S_MIGRATION_DRY_RUN

D_SCHEMA_DRIFT
  -> S_REPLICATION_MANAGER
    -> D_REPLICATION_LAG -> S_REPLICA_SYNC
    -> D_SPLIT_BRAIN -> S_QUORUM_KEEPER

D_NO_OBSERVABILITY
  -> S_LOGGING
    -> D_LOG_VOLUME -> S_LOG_FILTER или R_GUARD_TO_BAR
```

## Матрицы

| ID | Название | Слоты | Стоимость |
|---|---|---|---|
| `net_l6` | Маршрутизатор Шардов | `NET_ROUTING` x2, `RITUAL_NET` | 2 |
| `obs_l6` | Летопись Событий | `OBS_LOGS`, `OBS_FILTERS`, `RITUAL_OBS` | 1 |
| `st_l6` | Погреб Шардов | `ST_RETENTION`, `ST_QUOTA`, `RITUAL_ST` | 2 |
| `cd_l6` | Конвейер Миграций | `CD_PIPELINE`, `CD_TESTING`, `CD_ROLLBACK`, `RITUAL_CD` | 1 |
| `buffer_l6` | Маршрутно-Складской Буфер | `NET_ROUTING`, `ST_QUOTA`, `RITUAL_NET` | 2 |

Бюджет: **24 монеты / 5 ауры**.

## Валидные пути

### Путь A — Технический

`S_SHARD_KEY` + `S_REBALANCER` + `S_HOT_KEY_SPLITTER`, схема через `S_SCHEMA_GUARD`, миграции через `S_CICD` + `S_MIGRATION_DRY_RUN` + `S_ROLLBACK`, наблюдаемость через `S_LOGGING` + `S_LOG_FILTER`.

Итог: **24 монеты / 5 ауры**.

### Путь B — Ритуал вместо фильтра

То же ядро шардирования и миграций, но `D_LOG_VOLUME` закрывается через `R_GUARD_TO_BAR` вместо `S_LOG_FILTER`.

Итог: **24 монеты / 4 ауры**.

Репликация и ограда больше не считаются валидными путями уровня. Они остаются в колоде как приманки и ловушки: игрок может увидеть, какие дополнительные долги они создают, но два зачётных решения — только A и B.

## Ловушки

| # | Что делает игрок | Результат |
|---|---|---|
| 1 | Берёт `buffer_l6` без `obs_l6` | `F13_DARK_SHARD` |
| 2 | Ставит `S_SHARD_KEY`, но забывает `S_REBALANCER` | `F1_OVERFLOW` |
| 3 | Ставит `S_SCHEMA_GUARD`, но не запускает `S_CICD` | `F5_FRAGILITY` |
| 4 | Ставит `S_SHARD_FENCE` без `S_SHARD_PROBE` | `F7_CONFUSION` |
| 5 | Ставит `S_REPLICATION_MANAGER` без `S_REPLICA_SYNC` | `F5_FRAGILITY` |
| 6 | Смешивает `S_SHARD_KEY` и `S_HASH_ROUTING` без арбитра | `F11_HOTSPOT` + `F2_CONTRADICTION` |
| 7 | Закрывает imbalance через `S_REBALANCER`, но забывает `S_HOT_KEY_SPLITTER` | `F11_HOTSPOT` |
| 8 | Ставит `S_SCHEMA_GUARD` без `S_MIGRATION_DRY_RUN` | `F11_HOTSPOT` |
| 9 | Реплицирует без `S_QUORUM_KEEPER` | `F12_SPLIT_BRAIN` |

## Новые карты L6

| Карта | Слот | Роль |
|---|---|---|
| `S_HOT_KEY_SPLITTER` | `NET_ROUTING` | Лечит `D_HOT_PARTITION` |
| `S_MIGRATION_DRY_RUN` | `CD_TESTING` | Лечит `D_REBALANCE_WINDOW` и `D_BACKFILL_UNVERIFIED` |
| `S_QUORUM_KEEPER` | `NET_ROUTING` | Лечит `D_SPLIT_BRAIN` |

Главный урок уровня: лечение на масштабе часто не завершает проблему, а вскрывает следующий технический долг. Игрок должен читать не только стартовые долги, но и хвосты, которые создают выбранные карты.

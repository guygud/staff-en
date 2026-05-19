# L6 — Марк: Шардинг

## Нарратив

> «Данные растут — один узел уже не справляется. Нужно consistent hashing, чтобы каждый ключ шёл в нужный шард. И если один шард упадёт, система должна продолжать работать с остальными. Я не готов к переполнению и к хрупкости.»
> — Марк, infra lead

Марк масштабирует хранилище горизонтально. Задача: настроить шардированный роутинг с failover, наблюдаемостью и воспроизводимой доставкой. Матрица хранилища опциональна — можно взять субсидию через обряд.

## Технологический смысл

Consistent hashing + service discovery для sharded storage: роутинг ключей по кольцу хешей, healthcheck для failover, observability, CI/CD pipeline. Опциональная матрица M_STORAGE (quota management) требует дополнительного бюджета.

## DoD — что должен принять Марк

| Требование | Capability ID | Источник |
|---|---|---|
| Consistent-hash роутинг | `HAS_HASH_ROUTING` | S_HASH_ROUTING |
| Failover при отказе шарда | `HAS_FAILOVER` | S_HEALTHCHECK |
| Наблюдаемость | `HAS_LOGS` | S_LOGGING |
| Воспроизводимая доставка | `HAS_CICD` | S_CICD |

## Ограничения

- **Монеты**: 17
- **Аура**: 4
- **Опциональные матрицы**: 1 (M_STORAGE, стоит 2 монеты)

## Заказчик не простит

| Статус | Почему критический |
|---|---|
| `F1_OVERFLOW` | Рост данных без квот или фильтрации убьёт хранилище |
| `F5_FRAGILITY` | DISCOVERY без HEALTHCHECK — шард упадёт без failover |

## Предустановки

- **Предустановленные матрицы**: M_CONNECTIVITY (роутинг + discovery), M_OBSERVATION (логи), M_DELIVERY (CI/CD)
- **Долги при старте**: нет

## Доступные матрицы

| Матрица | Статус | Слоты |
|---|---|---|
| M_CONNECTIVITY | preInstalled (0 монет) | NET_DISCOVERY×2, NET_ROUTING×2, RITUAL_NET |
| M_OBSERVATION | preInstalled (0 монет) | OBS_LOGS, OBS_FILTERS, RITUAL_OBS |
| M_DELIVERY | preInstalled (0 монет) | CD_PIPELINE, CD_ROLLBACK, RITUAL_CD |
| M_STORAGE | **optional (2 монеты)** | ST_RETENTION, ST_QUOTA, RITUAL_ST |

## Доступные заговоры

| ID | Стоимость | Аура | Роль |
|---|---|---|---|
| S_DISCOVERY | 2 | +1 | Даёт HAS_DISCOVERY; добавляет D_NEEDS_HEALTHCHECK |
| S_HEALTHCHECK | 2 | 0 | Закрывает D_NEEDS_HEALTHCHECK; даёт HAS_FAILOVER |
| S_HASH_ROUTING | 2 | +1 | Даёт HAS_HASH_ROUTING |
| S_LOGGING | 2 | +1 | Закрывает D_NO_OBSERVABILITY; даёт HAS_LOGS; добавляет D_LOG_VOLUME |
| S_LOG_FILTER | 2 | 0 | Закрывает D_LOG_VOLUME; даёт HAS_LOG_FILTERING |
| S_ACCESS_LOGS | 3 | +1 | Даёт HAS_ACCESS_LOGS; добавляет D_ACCESS_LOG_VOLUME |
| S_TTL | 2 | +2 | Закрывает D_LOG_VOLUME / D_CACHE_GROWTH; **дорого по ауре** |
| S_QUOTAS | 2 | +1 | Закрывает D_LOG_VOLUME / D_ACCESS_LOG_VOLUME / D_CACHE_GROWTH (слот ST_QUOTA) |
| S_CICD | 2 | +1 | Закрывает D_NO_CICD; даёт HAS_CICD; добавляет D_NEEDS_ROLLBACK |
| S_ROLLBACK | 2 | 0 | Закрывает D_NEEDS_ROLLBACK; даёт HAS_ROLLBACK |

## Доступные обряды

| ID | Слот | Стоимость | Эффект |
|---|---|---|---|
| R_CANARY | RITUAL_OBS | 1 | −1 Аура |
| R_LIBRARY_GRANT | RITUAL_ST или RITUAL_OBS | 1 | −3 монеты |
| R_PATRON_SEAL | RITUAL_NET или RITUAL_CD | 1 | +2 лимит Ауры, −3 монеты |
| R_GUARD_TO_BAR | RITUAL_NET | 0 | −2 Аура |

## Заложенный урок / компромисс

Первый уровень с опциональной матрицей: M_STORAGE открывает доступ к S_QUOTAS (ST_QUOTA слот) и R_LIBRARY_GRANT (RITUAL_ST слот). Без M_STORAGE нужно закрыть D_LOG_VOLUME через S_LOG_FILTER (бесплатно по ауре). С M_STORAGE можно использовать S_QUOTAS + R_LIBRARY_GRANT, но это требует инвестиции 2 монеты в матрицу. Урок: «опциональная матрица — это компромисс по монетам, который открывает новые стратегии».

## Подсказки игроку

- S_LOGGING создаёт D_LOG_VOLUME — закрой его S_LOG_FILTER (в FILTERS-слоте) или S_QUOTAS (в QUOTA-слоте, только при установке M_STORAGE).
- M_STORAGE стоит 2 монеты, но RITUAL_ST даёт доступ к R_LIBRARY_GRANT (-3 монеты) — покупка матрицы может окупиться.
- S_DISCOVERY обязан идти в пару с S_HEALTHCHECK — иначе F5_FRAGILITY.

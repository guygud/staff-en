# L7 — Эдуард: Multi-DC

## Нарратив

> «Один ДЦ — одна точка отказа. Нам нужно два дата-центра, с шифрованием, правами, журналами, квотами и пайплайном. Первый ковчег мы деплоили руками — это не повторится. Случайный компромисс или переполнение на таком масштабе — катастрофа.»
> — Эдуард, SRE principal

Эдуард проектирует финальную архитектуру: Multi-DC с полным набором матриц. Все четыре матрицы предустановлены. Первый деплой был ручным — нужно перевести систему на CI/CD стандарт и обеспечить полную наблюдаемость с квотами.

## Технологический смысл

Multi-datacenter setup: TLS + RBAC для inter-DC коммуникации, consistent discovery с healthcheck, centralized logging с quota management, CI/CD pipeline с rollback и gates для контроля MR.

## DoD — что должен принять Эдуард

| Требование | Capability ID | Источник |
|---|---|---|
| TLS-шифрование | `HAS_TLS` | S_TLS_CERT |
| Авторизация | `HAS_AUTHZ` | S_AUTHZ |
| Failover | `HAS_FAILOVER` | S_HEALTHCHECK |
| Воспроизводимая доставка | `HAS_CICD` | S_CICD |
| Централизованное журналирование | `HAS_LOGS` | S_LOGGING |
| Квоты (защита от переполнения) | `HAS_QUOTAS` | S_QUOTAS |

## Ограничения

- **Монеты**: 24
- **Аура**: 5
- **Опциональные матрицы**: нет

## Заказчик не простит

| Статус | Почему критический |
|---|---|
| `F5_FRAGILITY` | DISCOVERY без HEALTHCHECK или CICD без ROLLBACK — хрупкость в Multi-DC = каскадный отказ |
| `F1_OVERFLOW` | Без квот рост данных в двух ДЦ приведёт к переполнению |
| `F3_COMPROMISE` | Конфликт карт нарушает целостность двух ДЦ |

## Предустановки

- **Предустановленные матрицы**: M_CONNECTIVITY, M_OBSERVATION, M_STORAGE, M_DELIVERY
- **Долги при старте**: `D_NO_CICD` → F6_NONDELIVERY (первый ковчег деплоился вручную)

## Доступные матрицы

| Матрица | Статус | Слоты |
|---|---|---|
| M_CONNECTIVITY | preInstalled (0 монет) | NET_AUTH, NET_TLS, NET_DISCOVERY×2, RITUAL_NET |
| M_OBSERVATION | preInstalled (0 монет) | OBS_LOGS, OBS_FILTERS, RITUAL_OBS |
| M_STORAGE | preInstalled (0 монет) | ST_RETENTION, ST_QUOTA, RITUAL_ST |
| M_DELIVERY | preInstalled (0 монет) | CD_PIPELINE, CD_GATES, CD_ROLLBACK, RITUAL_CD |

## Доступные заговоры

| ID | Стоимость | Аура | Роль |
|---|---|---|---|
| S_AUTHZ | 3 | 0 | Закрывает D_OPEN_ACCESS; даёт HAS_AUTHZ |
| S_TLS_CERT | 2 | 0 | Даёт HAS_TLS |
| S_DISCOVERY | 2 | +1 | Даёт HAS_DISCOVERY; добавляет D_NEEDS_HEALTHCHECK |
| S_HEALTHCHECK | 2 | 0 | Закрывает D_NEEDS_HEALTHCHECK; даёт HAS_FAILOVER |
| S_LOGGING | 2 | +1 | Даёт HAS_LOGS; добавляет D_LOG_VOLUME |
| S_LOG_FILTER | 2 | 0 | Закрывает D_LOG_VOLUME; даёт HAS_LOG_FILTERING |
| S_ACCESS_LOGS | 3 | +1 | Даёт HAS_ACCESS_LOGS; добавляет D_ACCESS_LOG_VOLUME |
| S_TTL | 2 | +2 | Закрывает D_CACHE_GROWTH/D_LOG_VOLUME; **дорого по ауре** |
| S_QUOTAS | 2 | +1 | Закрывает D_LOG_VOLUME/D_ACCESS_LOG_VOLUME/D_CACHE_GROWTH (слот ST_QUOTA) |
| S_ROTATION | 2 | 0 | Закрывает D_LOG_VOLUME/D_ACCESS_LOG_VOLUME (слот ST_RETENTION) |
| S_CICD | 2 | +1 | Закрывает D_NO_CICD; даёт HAS_CICD; добавляет D_NEEDS_ROLLBACK |
| S_ROLLBACK | 2 | 0 | Закрывает D_NEEDS_ROLLBACK; даёт HAS_ROLLBACK |
| S_MR_GATES | 2 | 0 | Даёт HAS_MR_GATES; контроль MR перед мержем (слот CD_GATES) |

## Доступные обряды

| ID | Слот | Стоимость | Эффект |
|---|---|---|---|
| R_CANARY | RITUAL_OBS | 1 | −1 Аура |
| R_LIBRARY_GRANT | RITUAL_ST или RITUAL_OBS | 1 | −3 монеты |
| R_GUARD_TO_BAR | RITUAL_NET | 0 | −2 Аура |
| R_PATRON_SEAL | RITUAL_NET или RITUAL_CD | 1 | +2 лимит Ауры, −3 монеты |

## Заложенный урок / компромисс

Финальный уровень: все матрицы открыты, все обряды доступны, карт много. Ключевой выбор — как управлять D_LOG_VOLUME: через S_LOG_FILTER (бесплатно по ауре) или S_QUOTAS (+ возможности квот). S_MR_GATES — новая карта в CD_GATES слоте, вводит концепцию gate-проверок. Урок: «в полной системе важно не брать лишнее — каждая карта добавляет ауру, бюджет ограничен».

## Подсказки игроку

- D_NO_CICD активен с самого начала — S_CICD обязателен; не забудь S_ROLLBACK.
- S_LOGGING + D_LOG_VOLUME — привычная пара. На этом уровне можно закрыть его и S_QUOTAS (через M_STORAGE), и S_LOG_FILTER (через M_OBSERVATION).
- Обряды работают в связке: R_LIBRARY_GRANT возвращает монеты, R_CANARY снижает ауру — используй оба для комфортного запаса.

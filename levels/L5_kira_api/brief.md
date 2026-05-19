# L5 — Кира: API-онбординг

## Нарратив

> «У нас сотни партнёров, которые подключаются к API. Мне нужен audit trail — кто что делал. И я не могу допустить ситуацию, когда мы деплоим вручную: следующий релиз должен выходить воспроизводимо. Любая хрупкость или случайный компромисс — это скандал.»
> — Кира, API platform lead

Кира строит платформу для внешних партнёров. Уже развёрнуты сеть, наблюдаемость и пайплайн доставки, но CI/CD не стандартизирован — первый деплой делался вручную. Теперь нужно полностью автоматизировать доставку и обеспечить audit trail для compliance.

## Технологический смысл

API gateway onboarding: партнёрский доступ с TLS+AuthZ, service discovery для failover, access logs для compliance audit, CI/CD pipeline с rollback-защитой.

## DoD — что должна принять Кира

| Требование | Capability ID | Источник |
|---|---|---|
| TLS-шифрование | `HAS_TLS` | S_TLS_CERT |
| Авторизация | `HAS_AUTHZ` | S_AUTHZ |
| Failover при отказе | `HAS_FAILOVER` | S_HEALTHCHECK |
| Воспроизводимая доставка | `HAS_CICD` | S_CICD |
| Аудит-лог партнёрских запросов | `HAS_ACCESS_LOGS` | S_ACCESS_LOGS |

## Ограничения

- **Монеты**: 18
- **Аура**: 4
- **Опциональные матрицы**: нет

## Заказчик не простит

| Статус | Почему критический |
|---|---|
| `F3_COMPROMISE` | Конфликт карт нарушает целостность системы |
| `F5_FRAGILITY` | DISCOVERY без HEALTHCHECK или CICD без ROLLBACK — хрупкость |
| `F6_NONDELIVERY` | D_NO_CICD не закрыт — ручной деплой, нарушение контракта |

## Предустановки

- **Предустановленные матрицы**: M_CONNECTIVITY, M_OBSERVATION, M_DELIVERY
- **Долги при старте**: `D_NO_CICD` → F6_NONDELIVERY (первый ковчег деплоился вручную)

## Доступные матрицы

| Матрица | Статус | Слоты |
|---|---|---|
| M_CONNECTIVITY | preInstalled (0 монет) | NET_AUTH, NET_TLS, NET_DISCOVERY×2, RITUAL_NET |
| M_OBSERVATION | preInstalled (0 монет) | OBS_LOGS, OBS_FILTERS, RITUAL_OBS |
| M_DELIVERY | preInstalled (0 монет) | CD_PIPELINE, CD_ROLLBACK, RITUAL_CD |

## Доступные заговоры

| ID | Стоимость | Аура | Роль |
|---|---|---|---|
| S_TLS_CERT | 2 | 0 | Даёт HAS_TLS |
| S_AUTHZ | 3 | 0 | Закрывает D_OPEN_ACCESS, даёт HAS_AUTHZ |
| S_DISCOVERY | 2 | +1 | Даёт HAS_DISCOVERY; **добавляет D_NEEDS_HEALTHCHECK** |
| S_HEALTHCHECK | 2 | 0 | Закрывает D_NEEDS_HEALTHCHECK; даёт HAS_FAILOVER |
| S_ACCESS_LOGS | 3 | +1 | Даёт HAS_ACCESS_LOGS; **добавляет D_ACCESS_LOG_VOLUME** (нет резолвера!) |
| S_LOG_FILTER | 2 | 0 | Закрывает D_LOG_VOLUME; даёт HAS_LOG_FILTERING |
| S_CICD | 2 | +1 | Закрывает D_NO_CICD; даёт HAS_CICD; **добавляет D_NEEDS_ROLLBACK** |
| S_ROLLBACK | 2 | 0 | Закрывает D_NEEDS_ROLLBACK; даёт HAS_ROLLBACK |

## Доступные обряды

| ID | Слот | Стоимость | Эффект |
|---|---|---|---|
| R_GUARD_TO_BAR | RITUAL_NET | 0 | −2 Аура |
| R_CANARY | RITUAL_OBS | 1 | −1 Аура |
| R_PATRON_SEAL | RITUAL_NET или RITUAL_CD | 1 | +2 лимит Ауры, −3 монеты |

## Заложенный урок / компромисс

S_ACCESS_LOGS — единственный способ получить HAS_ACCESS_LOGS (требование Киры), но он добавляет D_ACCESS_LOG_VOLUME без доступного резолвера. Это гарантирует F1_OVERFLOW (некритический, +2 ауры). Игрок **обязан** использовать обряд для компенсации — либо снижение ауры (R_GUARD_TO_BAR / R_CANARY), либо расширение лимита (R_PATRON_SEAL). Урок: «в платформе для compliance всегда есть цена — её нужно отработать обрядом, а не игнорировать».

## Подсказки игроку

- D_NO_CICD активен с самого начала — S_CICD обязателен, но за ним идёт D_NEEDS_ROLLBACK: не забудь S_ROLLBACK.
- S_ACCESS_LOGS создаст некритический F1_OVERFLOW (+2 ауры). Один из обрядов поможет остаться в лимите.
- R_PATRON_SEAL в RITUAL_CD даёт и возврат монет, и лимит ауры — лучший выбор если бюджет позволяет.

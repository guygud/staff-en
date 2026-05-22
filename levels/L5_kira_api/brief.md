# L5 — Кира: API-онбординг

## Нарратив

> «У нас сотни партнёров, которые подключаются к API. Мне нужен audit trail — кто что делал. И я не могу допустить ситуацию, когда мы деплоим вручную: следующий релиз должен выходить воспроизводимо. Любая хрупкость или случайный компромисс — это скандал.»
> — Кира, API platform lead

Кира строит платформу для внешних партнёров. С порога есть три долга: открытый доступ, ручная доставка и отсутствие аудита. Когда игрок начинает лечить доставку, появляются каскадные хвосты: откат, MR-гейт и контрактные тесты. Игрок выбирает **compliance-путь** (фильтр логов) или **релизный контур** (архив логов + субсидия мецената).

## Технологический смысл

API gateway: AuthZ, TLS (карты доступны), audit trail (`HAS_ACCESS_LOGS`), воспроизводимая доставка (`HAS_CICD` + `HAS_ROLLBACK`), обязательные **гейты на merge** (`HAS_MR_GATES`, слот `CD_GATES`) и контрактные тесты (`HAS_CONTRACT_TESTS`, слот `CD_TESTING`).

## Условия победы (движок)

Победа через закрытие **унаследованных долгов** `defaultInstalled.addsDebts` и отсутствие критических статусов. Отдельного списка `requirements` на уровне нет — DoD для дизайн-дока ниже.

| Долг | Критический статус | Типичное закрытие |
|---|---|---|
| D_OPEN_ACCESS | F3_COMPROMISE | S_AUTHZ |
| D_NO_CICD | F6_NONDELIVERY | S_API_CICD |
| D_AUDIT_NEEDED | F8_AUDIT_GAP | S_ACCESS_LOGS (журнал доступа, не общий `S_LOGGING`) |
| D_NO_REVIEW_GATES | F9_UNREVIEWED_RELEASE | S_API_MR_GATES |
| D_PARTNER_CONTRACT_DRIFT | F10_CONTRACT_DRIFT | S_CONTRACT_TESTS |

Первые три долга стартуют через `defaultInstalled`. Остальные появляются каскадом: `S_API_CICD` закрывает `D_NO_CICD`, но добавляет **D_NEEDS_ROLLBACK** и **D_NO_REVIEW_GATES**; `S_API_MR_GATES` закрывает review-долг, но добавляет **D_PARTNER_CONTRACT_DRIFT**.

## Ограничения

| Параметр | Значение |
|---|---|
| Монеты | **18** |
| Аура (базовый лимит) | **3** |
| Матрицы | все опциональные; `cd_l5` включает **CD_GATES** и **CD_TESTING** |

## Заказчик не простит

| Статус | Почему |
|---|---|
| F3_COMPROMISE | Открытый доступ (`D_OPEN_ACCESS` не закрыт) |
| F5_FRAGILITY | Discovery без healthcheck; CICD без rollback |
| F6_NONDELIVERY | Нет пайплайна — даже при «гейтах на бумаге» |
| F8_AUDIT_GAP | Нет журнала доступа: общие логи не доказывают партнёрские вызовы |
| F9_UNREVIEWED_RELEASE | Релизный контур без обязательного MR-гейта |
| F10_CONTRACT_DRIFT | Партнёрские API-контракты не сверяются перед релизом |

## Матрица «Конвейер доставки» (`cd_l5`)

| Слот | Тип |
|---|---|
| l5_pipe | CD_PIPELINE |
| l5_gate | **CD_GATES** |
| l5_contract | **CD_TESTING** |
| l5_rb | CD_ROLLBACK |
| l5_cd_rit | RITUAL_CD |

## Ключевые карты

| ID | Роль |
|---|---|
| S_API_MR_GATES | Гейты MR в `CD_GATES`; только после `S_API_CICD` |
| S_CONTRACT_TESTS | Контрактные тесты в `CD_TESTING`; лечат разъезд партнёрских API |
| S_API_CICD / S_ROLLBACK | Пара доставки |
| S_ACCESS_LOGS + S_LOG_FILTER | Технический контроль объёма аудита |
| S_ACCESS_LOGS + R_LOG_ARCHIVE | Архивация в `RITUAL_OBS` |
| R_PATRON_SEAL | `RITUAL_CD`: −2 ⚗, +1 ☠, **+2** к лимиту ауры |

## Подсказки игроку

См. `game-data.json` → `hints` уровня `L5_KIRA_API`.

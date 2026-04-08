Ниже — **краткий GDD (1 документ)** в формате, который можно сразу отдать Cursor/разработчику прототипа. Без лишних подробностей, только ядро, сущности, правила и 2 уровня.

---

# TechnoMage Platform — краткий GDD (MVP прототип)

## 0) Цель продукта
Браузерная промо-игра на 15–20 минут. Игрок решает “инженерные” задачи в фэнтези-сеттинге техно-мага, собирая решения из модулей (матриц) и карт (заговоров). Цель — показать стиль мышления от мидла к стафф-инженеру: trade-offs, техдолг, стандартизация, наблюдаемость, безопасность, устойчивость.

---

## 1) Core Loop (уровень как пазл)
1) Игрок читает **задание** (требования + ограничения + что “критично”).
2) Собирает решение: **устанавливает заговоры в ячейки матриц**.
3) Нажимает **“Отдать клиенту / Запуск в прод”**.
4) Получает **репорт результата** (успех/провал + иносказательная причина).
5) При провале — возвращается к сборке и пробует снова (без ограничений по попыткам).

---

## 2) Условия успеха/провала
### Успех
- Все **требования клиента** выполнены.
- **Бюджет** не превышен.
- **Риск** не превышен.
- Не возник ни один **фатальный статус**, который помечен как “критичный” для этого заказчика (см. ниже).

### Провал
- Не выполнены требования клиента, **или**
- Превышен бюджет, **или**
- Превышен лимит риска, **или**
- Возник “логический конфликт”/фатальный статус, критичный для заказчика.

---

## 3) Ресурсы
- **Золото (Бюджет)**: тратится на установку матриц и заговоров.
- **Риск**: растёт от некоторых заговоров и/или незакрытых долгов. Если риск превышает лимит уровня — провал.

> В MVP дополнительных числовых шкал (latency/storage/traffic) нет. Все “нагрузочные” последствия выражаем через статусы/риски и требования.

---

## 4) Сущности

### 4.1 Матрицы (блоки)
Матрица = модуль системы с набором ячеек (слотов). Матрицы выдаются по сюжету; установка на уровне может стоить золота.

MVP-матрицы:
1) **Матрица Взгляда (Наблюдение)** — логи/трейсы/алерты.
2) **Матрица Хранения** — хранение, TTL, ротация, квоты, индексы.
3) **Матрица Связей (API/интеграции)** — доступ, маршрутизация, discovery, DNS, TLS.
4) **Матрица Копирования (CI/CD)** — delivery, MR-гейты, rollback, тест-раннер.

(Платформенная матрица существует в концепте, но **в первые 3 уровня не выдаётся**.)

### 4.2 Заговоры (карты)
Заговор ставится в подходящую ячейку матрицы:
- Даёт **полезный эффект** (покрывает требование).
- Может создавать **долг/статус** (см. ниже).
- Имеет стоимость в золоте и влияние на риск (числа — в балансе позже).

---

## 5) Статусы (долги) и “чувствительность заказчика”
### 5.1 Универсальные фатальные статусы (коды)
Статусы описывают семантические ошибки/долги. Одинаковые для всех уровней, но **не всегда фатальны**.

- **F1 Переполнение** — бесконтрольный рост данных/логов → система падает.
- **F2 Противоречие** — несовместимые режимы/политики включены одновременно.
- **F3 Компрометация** — критическая дыра безопасности (доступ/секреты/TLS).
- **F4 Слепота** — нет обязательной наблюдаемости там, где она требуется.
- **F5 Хрупкость** — нет отказоустойчивости/проверок живости/отката там, где это критично.
- **F6 Недоставка** — нельзя надёжно доставлять изменения (ручные шаги вместо воспроизводимого контура).

### 5.2 Правило “князь не простит” (профиль уровня)
У каждого уровня есть список **Критичных статусов** (2–4 пункта из F1–F6).  
- Если возникает критичный статус → **немедленный провал**.  
- Если возникает некритичный статус → он **не фейлит сразу**, но **увеличивает риск** (техдолг “пока прокатило”).

### 5.3 Иносказательные репорты
Игрок получает причины провала метафорой, но однозначно привязанной к коду:
- F1: “архив распух / чернила затопили хранилище”
- F2: “печати спорят / руны конфликтуют”
- F3: “калитка без стражи / печать подделана”
- F4: “зеркало ослепло / наблюдатель спит”
- F5: “мост хрупок / один столб упал — всё рухнуло”
- F6: “ритуал доставки рассыпался / каждый раз выходит по-разному”

---

## 6) Каталог заговоров (MVP)
Таблица — логика (без баланса чисел).

| Заговор | Матрица | Даёт | Может создать долг → статус | Чем закрывается |
|---|---|---|---|---|
| Логирование | Взгляд | записи событий | “шум/объём” → F1 | Фильтрация + TTL/ротация |
| Фильтрация логов | Взгляд | чистые логи | — | закрывает долг логов |
| Алертинг | Взгляд | узнаём о сбоях | (нефатально) ложные тревоги → риск | — |
| Трейсинг | Взгляд | путь запроса | (нефатально) накладные расходы → риск | — |
| Access-логи | Взгляд | аудит входа | “объём логов” → F1 | Фильтр + TTL/ротация/квоты |
| TTL | Хранение | авто-истечение | — | лечит F1 |
| Ротация/самоочистка | Хранение | чистка/ротация | — | лечит F1 |
| Индекс | Хранение | быстрый поиск | рост индекса → F1 | TTL/квоты |
| Квоты хранения | Хранение | ограничение роста | — | лечит F1 (может ↑риск “не хватает данных”) |
| Секреты/шифрование в хранении | Хранение | защита | — | лечит F3 (частично) |
| AuthN/AuthZ | Связи | контроль доступа | — | лечит F3 |
| DNS | Связи | доменное имя | — | — |
| TLS сертификат | Связи | TLS | отсутствие при требовании → F3 или “req fail” | — |
| Service discovery | Связи | находим эндпоинты | без проверок живости → F5 | Healthcheck |
| Healthcheck | Связи | проверка живости | — | лечит F5 |
| Traffic splitting (weights) | Связи | распределение по весам | конфликт с hash → F2 | Policy resolver / убрать конфликт |
| Hash routing (sticky) | Связи | привязка к эндпоинту | конфликт с weights → F2 | Policy resolver / убрать конфликт |
| Policy resolver | Связи | согласует политики | — | лечит F2 для указанных пар |
| CI/CD pipeline | Копирование | автодоставка | без отката/гейтов → F5/F6 (по уровню) | Rollback, MR gates |
| Rollback | Копирование | откат | — | лечит F5 |
| MR gates | Копирование | проверенный деплой из MR | — | снижает риск/может быть req |
| DSL/степы тестов | Копирование | сборка тестов | недоставка/невоспроизводимость → F6 | (позже) библиотека степов |
| Раннер на железе | Копирование | прогон на ATM | отсутствие при требовании → req fail | — |

---

## 7) UX/Экраны (MVP)
### 7.1 Экран задания
- Requirements (буллеты)
- Дано (матрицы/заговоры по умолчанию)
- Ограничения: бюджет, риск
- Блок **“Князь не простит”** (иконки F1–F6)

### 7.2 Экран сборки (основной)
- Схема из блоков-матриц с ячейками (слотами)
- Панель доступных заговоров (карты); подсветка валидных слотов
- Счётчики: оставшийся бюджет, текущий риск
- Панель активных долгов/статусов (иконки)

Кнопка: **Запуск / Отдать клиенту**

### 7.3 Экран результата
- Успех/провал
- Иносказательная причина (1–2 предложения)
- (Если успех) краткий “отзыв клиента”
- Кнопки: Retry / Next

---

# 8) Два уровня для прототипа

## Уровень 1: «Шепчущий кэш для лавочников» (Cache as a Service, но без платформы)
**Доступные матрицы:** Хранение, Связи, Взгляд (3)

**Требования:**
- Сделать кэш (совместимый с Redis по протоколу)
- Оградить доступ (только своим)
- (Опционально/по балансу) иметь понятные записи о работе

**Князь не простит (критичные):**
- F1 Переполнение
- F3 Компрометация  
(Если захотим усложнить: добавить F4, но можно оставить некритичным)

**Победные идеи (минимум 2 решения):**
- Вариант A: Auth + логирование/access-логи + TTL/ротация
- Вариант B: Auth + квоты (вместо TTL) + минимум наблюдаемости (если F4 не критичен)

**Типовые провалы:**
- Логи без TTL/ротации → F1
- Нет Auth → F3

---

## Уровень 2: «Служба Врат (LBaaS) для ярмарки»
**Доступные матрицы:** Связи, Взгляд, Хранение, Копирование (4)

**Требования:**
- Единая точка входа (публикация сервиса)
- Домен (DNS) и TLS-сертификат
- Failover при отказе в одном “граде” (ДЦ)
- Access-логи ответственному (можно сделать must-have)

**Князь не простит (критичные):**
- F3 Компрометация
- F5 Хрупкость
- F1 Переполнение (если access-логи включены как требование)

**Победные идеи (минимум 2 решения):**
- Вариант A: DNS+TLS+discovery+healthcheck + access-логи + фильтр + TTL/ротация
- Вариант B: DNS+TLS+discovery+healthcheck + access-логи + квоты (вместо TTL) + фильтр (другая комбинация стоимости/риска)

**Типовые провалы:**
- Discovery без healthcheck → F5
- Access-логи без контроля роста → F1
- Нет TLS/серта при требовании → F3 или req fail

---

## 9) Что не делаем в MVP прототипе
- Нет рандома/событий во время уровня.
- Нет переговоров/соц. веток.
- Нет сложных графиков/мониторинга: только репорт и иконки статусов.
- Нет мета-прогрессии вне выдачи новых матриц/карт по уровням.

---

## 10) Тех. заметки для прототипа (для разработчика)
- Внутренняя модель уровня:
  - requirements: список флагов
  - availableMatrices: список матриц с количеством слотов и типами слотов
  - availableSpells: список карт (валидные слоты, стоимость, риск, эффекты, долги, конфликты)
  - criticalStatuses: подмножество F1–F6
  - eval(): проверка требований + бюджета + риска + статусов/конфликтов
- Конфликты:
  - spellConflictPairs: пары карт, дающие F2 без resolver’а
  - resolverSpell: снимает конфликт для конкретных пар

---

Если хочешь, я могу сразу адаптировать это в JSON-схему (уровень/матрицы/карты/проверки), чтобы Cursor проще сгенерировал прототип.

Ниже — практичная **JSON-схема данных** + **пример наполнения** для 2 уровней и базового набора матриц/заклинаний. Это можно прямо отдать Cursor: он сможет сделать прототип как “data-driven” (рендер по JSON + простая функция eval).

```json
{
  "version": "0.1",
  "meta": {
    "title": "TechnoMage Platform (MVP)",
    "runMode": "alwaysProd",
    "resources": ["gold", "risk"]
  },

  "statusCatalog": [
    {
      "id": "F1_OVERFLOW",
      "name": "Переполнение",
      "reportHints": [
        "Архив распух и треснул по швам.",
        "Чернила затопили хранилище, печати размокли."
      ]
    },
    {
      "id": "F2_CONTRADICTION",
      "name": "Противоречие",
      "reportHints": [
        "Руны спорят и гасят друг друга.",
        "Печати наложены так, что магия конфликтует."
      ]
    },
    {
      "id": "F3_COMPROMISE",
      "name": "Компрометация",
      "reportHints": [
        "Калитка без стражи — любой мог пройти.",
        "Печать подделана: защита не считается защитой."
      ]
    },
    {
      "id": "F4_BLINDNESS",
      "name": "Слепота",
      "reportHints": [
        "Зеркало потускнело — следов не осталось.",
        "Наблюдатель спит: никто не знает, что происходило."
      ]
    },
    {
      "id": "F5_FRAGILITY",
      "name": "Хрупкость",
      "reportHints": [
        "Мост держался на одной опоре — и она рухнула.",
        "Стоило одному узлу захромать, и всё посыпалось."
      ]
    },
    {
      "id": "F6_NONDELIVERY",
      "name": "Недоставка",
      "reportHints": [
        "Ритуал доставки каждый раз получается по‑разному.",
        "Без обряда повторяемости прод не принимает изменения."
      ]
    }
  ],

  "matrixCatalog": [
    {
      "id": "M_OBSERVATION",
      "name": "Матрица Взгляда",
      "slotTypes": ["OBS_LOGS", "OBS_FILTERS", "OBS_ALERTS", "OBS_TRACING"]
    },
    {
      "id": "M_STORAGE",
      "name": "Матрица Хранения",
      "slotTypes": ["ST_RETENTION", "ST_INDEX", "ST_QUOTA", "ST_SECRETS"]
    },
    {
      "id": "M_CONNECTIVITY",
      "name": "Матрица Связей",
      "slotTypes": ["NET_AUTH", "NET_ROUTING", "NET_DISCOVERY", "NET_DNS", "NET_TLS"]
    },
    {
      "id": "M_DELIVERY",
      "name": "Матрица Копирования",
      "slotTypes": ["CD_PIPELINE", "CD_GATES", "CD_ROLLBACK", "CD_TESTING"]
    }
  ],

  "spellCatalog": [
    {
      "id": "S_LOGGING",
      "name": "Перо Летописца",
      "allowedSlotTypes": ["OBS_LOGS"],
      "costGold": 2,
      "riskDelta": 1,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_LOGS" }],
      "addsDebts": [{ "id": "D_LOG_VOLUME", "statusIfUnresolved": "F1_OVERFLOW" }],
      "resolvesDebts": []
    },
    {
      "id": "S_LOG_FILTER",
      "name": "Сито Смыслов",
      "allowedSlotTypes": ["OBS_FILTERS"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_LOG_FILTERING" }],
      "addsDebts": [],
      "resolvesDebts": ["D_LOG_VOLUME"]
    },
    {
      "id": "S_ACCESS_LOGS",
      "name": "Книга Доступа",
      "allowedSlotTypes": ["OBS_LOGS"],
      "costGold": 3,
      "riskDelta": 1,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_ACCESS_LOGS" }],
      "addsDebts": [{ "id": "D_ACCESS_LOG_VOLUME", "statusIfUnresolved": "F1_OVERFLOW" }],
      "resolvesDebts": []
    },
    {
      "id": "S_TTL",
      "name": "Песочные Часы",
      "allowedSlotTypes": ["ST_RETENTION"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_TTL" }],
      "addsDebts": [],
      "resolvesDebts": ["D_LOG_VOLUME", "D_ACCESS_LOG_VOLUME", "D_CACHE_GROWTH", "D_INDEX_GROWTH"]
    },
    {
      "id": "S_ROTATION",
      "name": "Метла Кладовщика",
      "allowedSlotTypes": ["ST_RETENTION"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_ROTATION" }],
      "addsDebts": [],
      "resolvesDebts": ["D_LOG_VOLUME", "D_ACCESS_LOG_VOLUME"]
    },
    {
      "id": "S_QUOTAS",
      "name": "Предел Закромов",
      "allowedSlotTypes": ["ST_QUOTA"],
      "costGold": 2,
      "riskDelta": 1,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_QUOTAS" }],
      "addsDebts": [],
      "resolvesDebts": ["D_LOG_VOLUME", "D_ACCESS_LOG_VOLUME", "D_CACHE_GROWTH", "D_INDEX_GROWTH"]
    },
    {
      "id": "S_INDEX",
      "name": "Клеймо Поиска",
      "allowedSlotTypes": ["ST_INDEX"],
      "costGold": 2,
      "riskDelta": 1,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_INDEX" }],
      "addsDebts": [{ "id": "D_INDEX_GROWTH", "statusIfUnresolved": "F1_OVERFLOW" }],
      "resolvesDebts": []
    },
    {
      "id": "S_AUTHZ",
      "name": "Страж Порогов",
      "allowedSlotTypes": ["NET_AUTH"],
      "costGold": 3,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_AUTHZ" }],
      "addsDebts": [],
      "resolvesDebts": []
    },
    {
      "id": "S_DNS",
      "name": "Глашатай Домена",
      "allowedSlotTypes": ["NET_DNS"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_DNS" }],
      "addsDebts": [],
      "resolvesDebts": []
    },
    {
      "id": "S_TLS_CERT",
      "name": "Печать Серта",
      "allowedSlotTypes": ["NET_TLS"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_TLS" }],
      "addsDebts": [],
      "resolvesDebts": []
    },
    {
      "id": "S_DISCOVERY",
      "name": "Зов Разведчика",
      "allowedSlotTypes": ["NET_DISCOVERY"],
      "costGold": 2,
      "riskDelta": 1,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_DISCOVERY" }],
      "addsDebts": [{ "id": "D_NEEDS_HEALTHCHECK", "statusIfUnresolved": "F5_FRAGILITY" }],
      "resolvesDebts": []
    },
    {
      "id": "S_HEALTHCHECK",
      "name": "Сердцебиение",
      "allowedSlotTypes": ["NET_DISCOVERY"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_HEALTHCHECK" }],
      "addsDebts": [],
      "resolvesDebts": ["D_NEEDS_HEALTHCHECK"]
    },
    {
      "id": "S_CICD",
      "name": "Ритуал Доставки",
      "allowedSlotTypes": ["CD_PIPELINE"],
      "costGold": 2,
      "riskDelta": 1,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_CICD" }],
      "addsDebts": [{ "id": "D_NEEDS_ROLLBACK", "statusIfUnresolved": "F5_FRAGILITY" }],
      "resolvesDebts": []
    },
    {
      "id": "S_ROLLBACK",
      "name": "Ключ Отката",
      "allowedSlotTypes": ["CD_ROLLBACK"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_ROLLBACK" }],
      "addsDebts": [],
      "resolvesDebts": ["D_NEEDS_ROLLBACK"]
    },
    {
      "id": "S_MR_GATES",
      "name": "Страж Врат",
      "allowedSlotTypes": ["CD_GATES"],
      "costGold": 2,
      "riskDelta": 0,
      "effects": [{ "type": "CAPABILITY", "id": "HAS_MR_GATES" }],
      "addsDebts": [],
      "resolvesDebts": []
    }
  ],

  "levelCatalog": [
    {
      "id": "L1_CACHE_FOR_SHOPS",
      "name": "Шепчущий кэш для лавочников",
      "description": "Нужен кэш, совместимый с Redis, и защита от посторонних.",
      "budgetGold": 10,
      "riskLimit": 5,

      "criticalStatuses": ["F1_OVERFLOW", "F3_COMPROMISE"],

      "requirements": [
        { "id": "REQ_REDIS_COMPAT", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_CACHE_REDIS" },
        { "id": "REQ_ACCESS_CONTROL", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_AUTHZ" }
      ],

      "availableMatrices": [
        { "matrixId": "M_STORAGE", "instanceId": "st1", "installCostGold": 0, "slots": [
          { "slotId": "st1_ret", "slotType": "ST_RETENTION" },
          { "slotId": "st1_idx", "slotType": "ST_INDEX" }
        ]},
        { "matrixId": "M_CONNECTIVITY", "instanceId": "net1", "installCostGold": 0, "slots": [
          { "slotId": "net1_auth", "slotType": "NET_AUTH" }
        ]},
        { "matrixId": "M_OBSERVATION", "instanceId": "obs1", "installCostGold": 0, "slots": [
          { "slotId": "obs1_logs", "slotType": "OBS_LOGS" },
          { "slotId": "obs1_filters", "slotType": "OBS_FILTERS" }
        ]}
      ],

      "defaultInstalled": [
        {
          "note": "Кэш как 'дано': считаем, что базовый Redis-совместимый кэш уже развёрнут (не как карта), но без обвеса.",
          "grantsCapabilities": ["HAS_CACHE_REDIS"]
        }
      ],

      "availableSpells": [
        "S_AUTHZ",
        "S_LOGGING",
        "S_LOG_FILTER",
        "S_TTL",
        "S_ROTATION",
        "S_QUOTAS",
        "S_INDEX"
      ],

      "nonCriticalDebtRisk": 2
    },

    {
      "id": "L2_LBAAS_FAIR_GATE",
      "name": "Служба Врат (LBaaS) для ярмарки",
      "description": "Единая точка входа: домен, TLS, обнаружение сервисов, failover, access-логи.",
      "budgetGold": 14,
      "riskLimit": 6,

      "criticalStatuses": ["F3_COMPROMISE", "F5_FRAGILITY", "F1_OVERFLOW"],

      "requirements": [
        { "id": "REQ_DNS", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_DNS" },
        { "id": "REQ_TLS", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_TLS" },
        { "id": "REQ_DISCOVERY", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_DISCOVERY" },
        { "id": "REQ_FAILOVER", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_HEALTHCHECK" },
        { "id": "REQ_ACCESS_LOGS", "type": "CAPABILITY_REQUIRED", "capabilityId": "HAS_ACCESS_LOGS" }
      ],

      "availableMatrices": [
        { "matrixId": "M_CONNECTIVITY", "instanceId": "net1", "installCostGold": 0, "slots": [
          { "slotId": "net1_dns", "slotType": "NET_DNS" },
          { "slotId": "net1_tls", "slotType": "NET_TLS" },
          { "slotId": "net1_disc", "slotType": "NET_DISCOVERY" }
        ]},
        { "matrixId": "M_OBSERVATION", "instanceId": "obs1", "installCostGold": 0, "slots": [
          { "slotId": "obs1_logs", "slotType": "OBS_LOGS" },
          { "slotId": "obs1_filters", "slotType": "OBS_FILTERS" }
        ]},
        { "matrixId": "M_STORAGE", "instanceId": "st1", "installCostGold": 0, "slots": [
          { "slotId": "st1_ret", "slotType": "ST_RETENTION" },
          { "slotId": "st1_quota", "slotType": "ST_QUOTA" }
        ]},
        { "matrixId": "M_DELIVERY", "instanceId": "cd1", "installCostGold": 0, "slots": [
          { "slotId": "cd1_pipe", "slotType": "CD_PIPELINE" },
          { "slotId": "cd1_gate", "slotType": "CD_GATES" },
          { "slotId": "cd1_rb", "slotType": "CD_ROLLBACK" }
        ]}
      ],

      "availableSpells": [
        "S_DNS",
        "S_TLS_CERT",
        "S_DISCOVERY",
        "S_HEALTHCHECK",
        "S_ACCESS_LOGS",
        "S_LOG_FILTER",
        "S_TTL",
        "S_ROTATION",
        "S_QUOTAS",
        "S_CICD",
        "S_ROLLBACK",
        "S_MR_GATES"
      ],

      "nonCriticalDebtRisk": 2
    }
  ],

  "evaluationRules": {
    "spellsMustMatchSlotType": true,

    "debtResolution": {
      "unresolvedDebtCriticalStatusTriggersFailIfCriticalForLevel": true,
      "unresolvedDebtAddsRiskIfNotCriticalForLevel": true
    },

    "riskComputation": {
      "sumSpellRiskDelta": true,
      "riskPerUnresolvedNonCriticalDebt": "level.nonCriticalDebtRisk"
    },

    "budgetComputation": {
      "sumSpellCosts": true,
      "sumMatrixInstallCosts": true
    },

    "requirements": {
      "capabilities": "union(defaultInstalled.grantsCapabilities + spells.effects[CAPABILITY])"
    }
  }
}
```

## Примечания для Cursor (как это интерпретировать)
- **Слоты:** игрок кладёт `spellId` в `slotId`. Валидность: `slot.slotType ∈ spell.allowedSlotTypes`.
- **Capabilities:** собираются из `defaultInstalled.grantsCapabilities` и `spell.effects`.
- **Debts:** собираются из `spell.addsDebts`. Затем вычитаются `spell.resolvesDebts`.
- **Статусы:** у каждого долга есть `statusIfUnresolved` (F1/F5 и т.д.). Если статус в `criticalStatuses` уровня → фейл.
- **Non-critical долги:** не фейлят, но добавляют риск (`nonCriticalDebtRisk` за каждый).

Если хочешь, в следующем шаге я:
1) добавлю в JSON **“reportTemplates”**: маппинг статус→текст+совет,
2) и сделаю “REQ_*” не только capability, но и “запреты/политики” (для будущих конфликтов F2).
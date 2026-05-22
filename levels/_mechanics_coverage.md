# Матрица покрытия механик × уровни

**Обозначения:** `intro` — вводим впервые, `reuse` — переиспользуем, `−` — не задействована.

Цели:
- Каждая механика появляется в правильном блоке прогрессии (A→B→C).
- На одном уровне ≤ 1 новая концепция (ГДД §7.4).
- Ни одна механика не остаётся «мёртвой» на всей кампании.

## Механики

| Механика | L1 | L2 | L3 | L4 | L5 | L6 | L7 |
|---|---|---|---|---|---|---|---|
| Базовый цикл (briefing→assembly→result→retry) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Требования-capability (CAPABILITY_REQUIRED) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Долг → симптом (addsDebts → statusIfUnresolved) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| TreatmentTag лечит симптом-класс (treatmentCatalog) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Точечное закрытие долга (resolvesDebts, исключения) | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Критические статусы (fatalStatuses) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Некритические статусы (+аура) | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Опциональные матрицы (выбор пути) | `−` | `intro` | `−` | `−` | `−` | `reuse` | **`reuse+capstone`** |
| Лимит опциональных матриц (maxOptionalMatrices) | `−` | `intro` | `−` | `−` | `−` | `reuse` | **`reuse+capstone`** |
| Наследованные долги (defaultInstalled.addsDebts) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `−` | `reuse` |
| Ритуальная зона (RITUAL_* слоты) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Обряды-субсидии (coinsDelta < 0) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Обряды-снижение-Ауры (auraDelta < 0) | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` |
| Обряды-лимит-Ауры (auraLimitDelta > 0) | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` |
| Конфликты решений (conflictPairs) | `−` | `−` | `intro` | `−` | `−` | `−` | `−` |
| Разрешители конфликтов (resolvedBy) | `−` | `−` | `intro` | `−` | `−` | **`reuse`** | `−` |
| Два честных пути (arch vs process) | `−` | `reuse` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` |
| Новый тип слота CD_GATES | `−` | `−` | `−` | `−` | **`intro`** | `reuse` | `reuse` |
| Контрактные тесты в delivery-контуре | `−` | `−` | `−` | `−` | **`intro`** | `−` | `−` |
| Карта-лечение порождает 2 каскадных долга | `−` | `−` | `−` | `−` | **`intro`** | `reuse` | `−` |
| Dry-run миграций (`CD_TESTING`) | `−` | `−` | `−` | `−` | `−` | **`intro`** | `−` |
| Репликационный кворум | `−` | `−` | `−` | `−` | `−` | **`intro`** | `−` |
| Выбор 4 из 7 матриц | `−` | `−` | `−` | `−` | `−` | `−` | **`intro`** |
| Multi-DC DR drill | `−` | `−` | `−` | `−` | `−` | `−` | **`intro`** |
| Резервная ёмкость DC | `−` | `−` | `−` | `−` | `−` | `−` | **`intro`** |

## Статусы — должны появиться хотя бы раз в кампании

| Статус | L1 | L2 | L3 | L4 | L5 | L6 | L7 | Итог |
|---|---|---|---|---|---|---|---|---|
| F1_OVERFLOW | ловушка | `intro` | `reuse` | ловушка | `−` | `reuse` | `reuse` | ✓ |
| F2_CONTRADICTION | `−` | `−` | ловушка | `−` | `−` | **`intro`** | `−` | ✓ |
| F3_COMPROMISE | `−` | ловушка | `intro` | `−` | `reuse` | `−` | `reuse` | ✓ |
| F4_BLINDNESS | `intro` | `−` | `reuse` | `reuse` | `−` | `−` | `−` | ✓ |
| F5_FRAGILITY | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | ✓ |
| F6_NONDELIVERY | `−` | `−` | `−` | `−` | `intro` | `−` | `−` | ✓ |
| F7_CONFUSION | ловушка | `−` | `−` | `−` | `−` | **`reuse`** | `−` | ✓ |
| F8_AUDIT_GAP | `−` | `−` | `−` | `−` | **`intro`** | `−` | `−` | ✓ |
| F9_UNREVIEWED_RELEASE | `−` | `−` | `−` | `−` | **`intro`** | `−` | `−` | ✓ |
| F10_CONTRACT_DRIFT | `−` | `−` | `−` | `−` | **`intro`** | `−` | `−` | ✓ |
| F11_HOTSPOT | `−` | `−` | `−` | `−` | `−` | **`intro`** | `−` | ✓ |
| F12_SPLIT_BRAIN | `−` | `−` | `−` | `−` | `−` | **`intro`** | `−` | ✓ |
| F13_DARK_SHARD | `−` | `−` | `−` | `−` | `−` | **`intro`** | `−` | ✓ |
| F15_FAILOVER_LOOP | `−` | `−` | `−` | `−` | `−` | `−` | **`intro`** | ✓ |
| F16_CAPACITY_GAP | `−` | `−` | `−` | `−` | `−` | `−` | **`intro`** | ✓ |

> **F2_CONTRADICTION** используется в L3 (traffic split vs hash) и в **L6** (shard key vs hash routing); резолвер — `S_POLICY_RESOLVER`.
> **F4_BLINDNESS** вводится на L1 как наследованный долг (`defaultInstalled`), а не через ловушку-карту. `S_BROAD_LOGGING` теперь генерирует F7_CONFUSION.
> **F8-F10** вводятся на L5 как production API-дебафы. Стартовых долгов только три: доступ, доставка, аудит. `S_API_CICD` лечит недоставку и порождает два каскадных долга (`D_NEEDS_ROLLBACK`, `D_NO_REVIEW_GATES`), а `S_API_MR_GATES` лечит review gate и порождает `D_PARTNER_CONTRACT_DRIFT`.
> **F11-F13** вводятся на L6 как новые стартовые/шардовые дебафы: `F11_HOTSPOT`, `F12_SPLIT_BRAIN`, `F13_DARK_SHARD`.
> **F15-F16** вводятся на L7 как финальные multi-DC дебафы: петля failover и провал резервной ёмкости. L7 также закрепляет выбор `maxOptionalMatrices=4` из 7 доступных матриц.

## Обряды — должны использоваться хотя бы раз в кампании

| Обряд | L1 | L2 | L3 | L4 | L5 | L6 | L7 | Итог |
|---|---|---|---|---|---|---|---|---|
| R_ONBOARDING | `−` | `intro` | `−` | `−` | `−` | `−` | `−` | ✓ (L2) |
| R_LIBRARY_GRANT | `−` | `intro` | `−` | `−` | `−` | `reuse` | `reuse` | ✓ |
| R_PATRON_SEAL | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | ✓ |
| R_AI_BUFF | `intro` | `reuse` | `−` | `−` | `−` | `−` | `−` | ✓ |
| R_GUARD_TO_BAR | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | ✓ |
| R_CANARY | `−` | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | ✓ |

> Все обряды используются хотя бы раз. R_ONBOARDING только в L2 — если уровень убрать, он станет «мёртвым».

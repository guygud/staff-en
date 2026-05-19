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
| Долг → статус (addsDebts → statusIfUnresolved) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Закрытие долга (resolvesDebts) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Критические статусы (fatalStatuses) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Некритические статусы (+аура) | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Опциональные матрицы (выбор пути) | `−` | `intro` | `−` | `−` | `−` | `reuse` | `−` |
| Лимит опциональных матриц (maxOptionalMatrices) | `−` | `intro` | `−` | `−` | `−` | `reuse` | `−` |
| Наследованные долги (defaultInstalled.addsDebts) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `−` | `reuse` |
| Ритуальная зона (RITUAL_* слоты) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Обряды-субсидии (coinsDelta < 0) | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` | `reuse` |
| Обряды-снижение-Ауры (auraDelta < 0) | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` |
| Обряды-лимит-Ауры (auraLimitDelta > 0) | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` |
| Конфликты решений (conflictPairs) | `−` | `−` | `intro` | `−` | `−` | `−` | `−` |
| Разрешители конфликтов (resolvedBy) | `−` | `−` | `intro` | `−` | `−` | `−` | `−` |
| Два честных пути (arch vs process) | `−` | `reuse` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` |
| Новый тип слота CD_GATES | `−` | `−` | `−` | `−` | `−` | `−` | `intro` |

## Статусы — должны появиться хотя бы раз в кампании

| Статус | L1 | L2 | L3 | L4 | L5 | L6 | L7 | Итог |
|---|---|---|---|---|---|---|---|---|
| F1_OVERFLOW | ловушка | `intro` | `reuse` | ловушка | `−` | `reuse` | `reuse` | ✓ |
| F2_CONTRADICTION | `−` | `−` | `−` | `−` | `−` | `−` | `−` | ⚠ не используется |
| F3_COMPROMISE | `−` | ловушка | `intro` | `−` | `reuse` | `−` | `reuse` | ✓ |
| F4_BLINDNESS | `intro` | `−` | `reuse` | `reuse` | `−` | `−` | `−` | ✓ |
| F5_FRAGILITY | `−` | `−` | `intro` | `reuse` | `reuse` | `reuse` | `reuse` | ✓ |
| F6_NONDELIVERY | `−` | `−` | `−` | `−` | `intro` | `−` | `−` | ✓ |
| F7_CONFUSION | ловушка | `−` | `−` | `−` | `−` | `−` | `−` | ✓ |

> **F2_CONTRADICTION** не задействован ни в одном уровне MVP — добавить в L3 или L6 при следующей итерации (или убрать из statusCatalog).
> **F4_BLINDNESS** вводится на L1 как наследованный долг (`defaultInstalled`), а не через ловушку-карту. `S_BROAD_LOGGING` теперь генерирует F7_CONFUSION.

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

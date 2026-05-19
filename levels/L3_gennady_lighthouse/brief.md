# L3 — Маяк для посланников (`L3_GENNADY_LIGHTHOUSE`)

**Блок прогрессии:** B→C  
**Статус:** `data-in`

---

## Нарратив

**Заказчик:** Геннадий (смотритель маяка)  
**Предмет:** Точка входа для маяка — умный балансировщик нагрузки

**Вступление:**
> Значит так: сторожу маяк на перевале. Посланники жалуются — одни ждут часами, другие теряют сессию на полпути. Маяк отвечает, но без головы. Нужно сделать так, чтобы он сам знал, куда посылать посланников, помнил тех, кто уже в пути, и не падал, если один узел заболел.

**Финал:**
> Умные указатели работают. Один узел упал — маяк сам перенаправил. Вот теперь — настоящий маяк.

---

## Технологический смысл

**Что происходит:** Развёртывание LBaaS (Load Balancer as a Service) с умным роутингом. Нужны: DNS (постоянный адрес), TLS (шифрование), service discovery с healthcheck (живые узлы), стратегия маршрутизации.

**Новые механики (Block B→C):**
- Конфликт решений (S_TRAFFIC_SPLIT + S_HASH_ROUTING → F2_CONTRADICTION без арбитра)
- Разрешитель конфликтов (S_POLICY_RESOLVER)
- auraLimitDelta от R_PATRON_SEAL (Меценат расширяет допустимый лимит ауры)

---

## DoD (требования)

| ID | Capability | Описание |
|---|---|---|
| REQ_DNS | `HAS_DNS` | Постоянный адрес маяка |
| REQ_TLS | `HAS_TLS` | Шифрование писем |
| REQ_DISCOVERY | `HAS_DISCOVERY` | Обнаружение живых узлов |
| REQ_FAILOVER | `HAS_FAILOVER` | Автоматический failover |

---

## Ограничения

| coinsBudget | auraLimit | maxOptionalMatrices |
|---|---|---|
| 14 | 2 | — |

---

## «Заказчик не простит»

| Статус | Почему |
|---|---|
| **F2_CONTRADICTION** | S_TRAFFIC_SPLIT + S_HASH_ROUTING конфликтуют — без Арбитра магия рассыпается |
| **F5_FRAGILITY** | S_DISCOVERY без S_HEALTHCHECK → мёртвые узлы получают трафик |

---

## Предустановки

- `HAS_AUTHZ` — ворота маяка уже защищены (предустановлено)

**Матрица Связей (M_CONNECTIVITY, net_l3) — preInstalled:**

| Слот | Тип |
|---|---|
| l3_dns | NET_DNS |
| l3_tls | NET_TLS |
| l3_disc1 | NET_DISCOVERY |
| l3_disc2 | NET_DISCOVERY |
| l3_route1 | NET_ROUTING |
| l3_route2 | NET_ROUTING |
| l3_route3 | NET_ROUTING |
| l3_ritual | RITUAL_NET |

---

## Доступные заговоры

| ID | Слот | Монеты | Аура | Долг | Capability |
|---|---|---|---|---|---|
| S_DNS | NET_DNS | 2 | 0 | — | HAS_DNS |
| S_TLS_CERT | NET_TLS | 2 | 0 | — | HAS_TLS |
| S_DISCOVERY | NET_DISCOVERY | 2 | +1 | D_NEEDS_HEALTHCHECK→F5 | HAS_DISCOVERY |
| S_HEALTHCHECK | NET_DISCOVERY | 2 | 0 | — (resolves D_NEEDS_HEALTHCHECK) | HAS_HEALTHCHECK, HAS_FAILOVER |
| S_TRAFFIC_SPLIT | NET_ROUTING | 2 | +1 | — | HAS_TRAFFIC_SPLIT |
| S_HASH_ROUTING | NET_ROUTING | 2 | +1 | — | HAS_HASH_ROUTING |
| S_POLICY_RESOLVER | NET_ROUTING | 3 | 0 | — (resolves CP_ROUTING_CONFLICT) | HAS_POLICY_RESOLVER |

## Доступные обряды

| ID | Слот | Монеты | coinsDelta | auraLimitDelta | Примечание |
|---|---|---|---|---|---|
| R_PATRON_SEAL | RITUAL_NET | 1 | -3 | +2 | **ВВОДИТ auraLimitDelta**: расширяет лимит ауры и субсидирует 3 монеты |
| R_GUARD_TO_BAR | RITUAL_NET | 0 | — | — (auraDelta -2) | Снижает общую ауру на 2 |

---

## Урок

**Два пути к маршрутизации:**
- **Путь A** (простой): только S_TRAFFIC_SPLIT. Никакого конфликта. Дешевле.
- **Путь B** (продвинутый): S_TRAFFIC_SPLIT + S_HASH_ROUTING + S_POLICY_RESOLVER + R_PATRON_SEAL. Обе стратегии сосуществуют, но требуют арбитра и субсидии.

**Главная ловушка:** положить оба роутинга без арбитра → F2_CONTRADICTION.

# CSV export (game-data)

Сгенерировано: `node scripts/export-csv-tables.mjs`

| Файл | Содержание |
|------|------------|
| 01_matrices.csv | Шаблоны матриц из matrixCatalog |
| 02_statuses_symptoms.csv | Симптомы F* + чем лечат теги + тексты из reportTemplates |
| 03_treatments.csv | treatmentCatalog |
| 04_debts.csv | Все долги D_* из карт и defaultInstalled |
| 05_cards_spells_and_obryads.csv | Заклинания и обряды |
| 06_capabilities.csv | HAS_* → подпись |
| 07_levels.csv | Уровни: вступление, победы, подсказки, требования |
| 08_level_critical_status_texts.csv | Для каждого крит. статуса уровня — fail/advice |
| 09_level_matrix_instances.csv | Расстановка плиток на уровне: preset_id, цена, override имени |
| 10_conflict_pairs.csv | Пары конфликтующих карт |
| 11_level_default_installed.csv | Стартовые блоки уровня (долги и capabilities) |
| 12_matrix_presets.csv | Каталог конфигураций матриц (matrixPresets) |
| 13_spell_cards.csv | Заклинания: 3 ячейки свойств + introducedAtLevel (spellCardCatalog) |
| 14_inherited_debts.csv | Наследственные/чужие долги, отдельно от дебафов карты |
| 15_obryads.csv | Обряды: 3 ячейки свойств + introducedAtLevel (obryadCardCatalog) |
| 16_level_solutions.csv | Успешные пути по уровням (без ловушек) + «почему» из game-data |

Кодировка: UTF-8 с BOM (Excel на Windows открывает кириллицу корректно).

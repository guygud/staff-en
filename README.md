# staff-en

Игровые данные и плейтест для «алхимии систем».

## Быстрый старт

1. Клонируйте репозиторий.
2. Запустите из корня: `python3 -m http.server 8765`
3. Откройте [playtest.html](http://127.0.0.1:8765/playtest.html) — сборка уровней из `new/*.csv`.

Подробно: **[`new/README.md`](new/README.md)** (как играть, список CSV, сборка `game-data.json`).

```bash
node scripts/build-game-data.mjs
node scripts/validate-levels.mjs
```

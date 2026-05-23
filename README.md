# Task Planner Premium v5 — Telegram ID + PWA + iOS Widget Sync

Основа проекта — ваш текущий `index.html`, расширенный без разрезания основного WebApp на сложный фронтенд-бандл.

## Что добавлено в этой версии

- PWA-режим для iPhone: `manifest.webmanifest`, `sw.js`, иконки, Apple meta tags.
- Раздел меню: **iOS / Виджет / Синхронизация**.
- Блок настроек: **Облачная синхронизация Telegram ↔ iOS**.
- Привязка к Telegram ID через проверенный Telegram WebApp `initData`.
- Единый Sync API для Telegram WebApp, PWA на главном экране iPhone и iOS WidgetKit.
- Ссылки подключения:
  - PWA-ссылка для Safari / «На экран Домой»;
  - `taskplanner://sync?...` deep link для нативного iOS-приложения и виджета.
- Cloudflare Worker + D1 backend в `server/cloudflare-worker`.
- SwiftUI + WidgetKit слой в `ios/TaskPlannerIOS`.

## Важное ограничение iOS

Сайт/PWA можно добавить на главный экран iPhone, но настоящий iOS-виджет на домашнем экране нельзя сделать только HTML-файлом. Для настоящего виджета нужен нативный iOS WidgetKit extension. Поэтому в архиве две части:

1. `index.html` + PWA — работает как приложение с главного экрана.
2. `ios/TaskPlannerIOS` — код настоящего WidgetKit-виджета, который читает те же данные из Sync API.

## Как запустить синхронизацию

### 1. Задеплоить Sync API

```bash
npm i -g wrangler
cd server/cloudflare-worker
wrangler d1 create task_planner_sync
# вставьте database_id в wrangler.toml
wrangler d1 execute task_planner_sync --file=schema.sql
wrangler secret put BOT_TOKEN
wrangler deploy
```

После деплоя получите URL вида:

```text
https://task-planner-sync-api.<account>.workers.dev/api
```

### 2. Подключить WebApp

1. Откройте приложение внутри Telegram.
2. Перейдите: **Настройки → Облачная синхронизация Telegram ↔ iOS**.
3. Вставьте Sync API URL.
4. Нажмите **Связать Telegram ID**.
5. Нажмите **Ссылка для iPhone** и откройте её в Safari.
6. В Safari: **Поделиться → На экран «Домой»**.

Теперь Telegram WebApp и PWA используют один Telegram ID и одну облачную базу задач.

### 3. Подключить настоящий iOS-виджет

1. Соберите `ios/TaskPlannerIOS` в Xcode.
2. Включите App Groups для App target и Widget target.
3. Замените `group.com.example.taskplanner` на свой App Group ID.
4. Скопируйте Widget-ссылку из WebApp.
5. Откройте её на iPhone — приложение сохранит API и токен.
6. Добавьте виджет Task Planner на главный экран.

## Структура архива

```text
index.html                         # основной WebApp/PWA
manifest.webmanifest               # PWA manifest
sw.js                              # service worker
icons/                             # PWA/iOS иконки
server/cloudflare-worker/          # Worker + D1 schema
ios/TaskPlannerIOS/                # SwiftUI app + WidgetKit extension code
```

## Безопасность

- Telegram ID подтверждается через Telegram WebApp `initData` на сервере.
- Sync token хранится как SHA-256 hash в D1.
- Не отправляйте PWA/Widget sync-ссылку публично: она даёт доступ к данным конкретного Telegram ID.

## Почему Telegram CloudStorage оставлен

Telegram CloudStorage по-прежнему используется как быстрый fallback внутри Telegram. Но для PWA/iOS WidgetKit нужен отдельный Sync API, потому что вне Telegram нет доступа к `Telegram.WebApp.CloudStorage` и `initDataUnsafe`.

## Иконка приложения

В эту сборку добавлена выбранная первая премиум-иконка в стиле тёмный navy/indigo + золото. Она уже подключена как:

- PWA icon в `manifest.webmanifest`;
- `apple-touch-icon.png` для добавления на экран «Домой» в iOS;
- favicon 16/32 px;
- набор размеров 120/152/167/180/192/384/512/1024 px;
- `ios/TaskPlannerIOS/Assets.xcassets/AppIcon.appiconset` для нативного iOS-приложения и WidgetKit-сборки.

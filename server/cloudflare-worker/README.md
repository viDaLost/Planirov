# Cloudflare Worker Sync API

Этот API нужен, потому что Telegram CloudStorage доступен только внутри Telegram WebApp. PWA на главном экране iPhone и iOS WidgetKit не имеют доступа к Telegram SDK, поэтому общий сервер синхронизации обязателен.

## Деплой

```bash
npm i -g wrangler
cd server/cloudflare-worker
wrangler d1 create task_planner_sync
# вставьте database_id в wrangler.toml
wrangler d1 execute task_planner_sync --file=schema.sql
wrangler secret put BOT_TOKEN
wrangler deploy
```

После деплоя получите адрес вида:

```text
https://task-planner-sync-api.<account>.workers.dev/api
```

Его нужно вставить в приложении: **Настройки → Облачная синхронизация → Sync API URL**.

/**
 * Task Planner Premium Sync API — Cloudflare Worker + D1
 *
 * Routes:
 *   POST /api/auth/telegram  { initData }
 *   GET  /api/sync           Authorization: Bearer <token>
 *   PUT  /api/sync           Authorization: Bearer <token>, body: { payload, clientRevision }
 *   GET  /api/widget/summary Authorization: Bearer <token> OR ?token=<token>
 *
 * Env:
 *   BOT_TOKEN — Telegram bot token, used to verify WebApp initData.
 *   DB        — D1 database binding.
 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

function corsHeaders(origin = '*') {
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400'
  };
}

function json(data, init = {}, origin = '*') {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin), ...(init.headers || {}) }
  });
}

function getBearerToken(request, url) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return url.searchParams.get('token') || '';
}

function base64url(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
}

function constantTimeEqual(aHex, bHex) {
  if (!aHex || !bHex || aHex.length !== bHex.length) return false;
  let out = 0;
  for (let i = 0; i < aHex.length; i++) out |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  return out === 0;
}

async function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) throw new Error('TELEGRAM_INIT_DATA_OR_BOT_TOKEN_MISSING');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('TELEGRAM_HASH_MISSING');
  params.delete('hash');

  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
  const computed = await hmacSha256(secretKey, dataCheckString);
  const computedHex = [...new Uint8Array(computed)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!constantTimeEqual(computedHex, receivedHash)) throw new Error('TELEGRAM_SIGNATURE_INVALID');

  const authDate = Number(params.get('auth_date') || 0) * 1000;
  // 7 дней: достаточно мягко для WebApp, но защищает от старых перехваченных строк.
  if (!authDate || Date.now() - authDate > 7 * 24 * 60 * 60 * 1000) throw new Error('TELEGRAM_INIT_DATA_EXPIRED');

  const user = JSON.parse(params.get('user') || '{}');
  if (!user.id) throw new Error('TELEGRAM_USER_MISSING');
  return user;
}

async function createAccessToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `tps_${base64url(bytes)}`;
}

async function getAccountByToken(env, token) {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare('SELECT telegram_id, token_hash, created_at, last_used_at FROM device_tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first();
}

async function handleAuthTelegram(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const tgUser = await verifyTelegramInitData(body.initData, env.BOT_TOKEN);
  const telegramId = String(tgUser.id);
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO accounts (telegram_id, created_at, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET updated_at = excluded.updated_at
  `).bind(telegramId, now, now).run();

  const token = await createAccessToken();
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare('INSERT INTO device_tokens (token_hash, telegram_id, label, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)')
    .bind(tokenHash, telegramId, body.label || 'telegram-webapp', now, now)
    .run();

  const dataset = await env.DB.prepare('SELECT revision, updated_at FROM datasets WHERE telegram_id = ?')
    .bind(telegramId)
    .first();

  return json({ ok: true, telegramId, token, revision: dataset?.revision || 0, updatedAt: dataset?.updated_at || null }, {}, origin);
}

async function handleGetSync(request, env, url, origin) {
  const token = getBearerToken(request, url);
  const account = await getAccountByToken(env, token);
  if (!account) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }, origin);

  const row = await env.DB.prepare('SELECT payload, revision, updated_at FROM datasets WHERE telegram_id = ?')
    .bind(account.telegram_id)
    .first();
  if (!row) return json({ ok: true, telegramId: account.telegram_id, payload: null, revision: 0, updatedAt: null }, {}, origin);

  return json({
    ok: true,
    telegramId: account.telegram_id,
    payload: JSON.parse(row.payload || 'null'),
    revision: row.revision || 0,
    updatedAt: row.updated_at
  }, {}, origin);
}

async function handlePutSync(request, env, url, origin) {
  const token = getBearerToken(request, url);
  const account = await getAccountByToken(env, token);
  if (!account) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }, origin);

  const body = await request.json().catch(() => ({}));
  const payload = body.payload;
  if (!payload || !Array.isArray(payload.tasks) || !Array.isArray(payload.projects)) {
    return json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 400 }, origin);
  }

  const now = new Date().toISOString();
  const current = await env.DB.prepare('SELECT revision FROM datasets WHERE telegram_id = ?')
    .bind(account.telegram_id)
    .first();
  const nextRevision = Number(current?.revision || 0) + 1;
  const normalized = {
    ...payload,
    telegramId: account.telegram_id,
    updatedAt: now,
    revision: nextRevision
  };

  await env.DB.prepare(`
    INSERT INTO datasets (telegram_id, payload, revision, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at
  `).bind(account.telegram_id, JSON.stringify(normalized), nextRevision, now).run();

  await env.DB.prepare('UPDATE accounts SET updated_at = ? WHERE telegram_id = ?').bind(now, account.telegram_id).run();
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare('UPDATE device_tokens SET last_used_at = ? WHERE token_hash = ?').bind(now, tokenHash).run();
  }

  return json({ ok: true, telegramId: account.telegram_id, revision: nextRevision, updatedAt: now }, {}, origin);
}

function priorityWeight(p) {
  return ({ critical: 4, high: 3, medium: 2, low: 1 })[p] || 0;
}

async function handleWidgetSummary(request, env, url, origin) {
  const token = getBearerToken(request, url);
  const account = await getAccountByToken(env, token);
  if (!account) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }, origin);

  const row = await env.DB.prepare('SELECT payload, revision, updated_at FROM datasets WHERE telegram_id = ?')
    .bind(account.telegram_id)
    .first();
  const payload = row?.payload ? JSON.parse(row.payload) : { tasks: [], projects: [] };
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const openTasks = tasks.filter((t) => !t.completed && t.status !== 'done');
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = openTasks.filter((t) => t.dueDate === today);
  const next = openTasks
    .slice()
    .sort((a, b) => {
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    })
    .slice(0, 8)
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate || '', priority: t.priority || 'medium', status: t.status || 'backlog' }));

  return json({
    ok: true,
    telegramId: account.telegram_id,
    revision: row?.revision || 0,
    updatedAt: row?.updated_at || null,
    total: tasks.length,
    open: openTasks.length,
    done: tasks.filter((t) => t.completed || t.status === 'done').length,
    today: todayTasks.length,
    next
  }, {}, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '*';
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });

    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/auth/telegram' && request.method === 'POST') return handleAuthTelegram(request, env, origin);
      if (url.pathname === '/api/sync' && request.method === 'GET') return handleGetSync(request, env, url, origin);
      if (url.pathname === '/api/sync' && request.method === 'PUT') return handlePutSync(request, env, url, origin);
      if (url.pathname === '/api/widget/summary' && request.method === 'GET') return handleWidgetSummary(request, env, url, origin);
      return json({ ok: false, error: 'NOT_FOUND' }, { status: 404 }, origin);
    } catch (error) {
      return json({ ok: false, error: error.message || 'INTERNAL_ERROR' }, { status: 500 }, origin);
    }
  }
};

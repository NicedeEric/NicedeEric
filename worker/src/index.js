// =================================================================================
// 王者测试 · Cloudflare Worker 后端
//
// Endpoints
//   public
//     POST /api/track           记录一次访问
//     POST /api/result          记录一次测试结果
//     GET  /api/public/stats    暴露累计测试次数（供首页显示）
//
//   admin (Bearer <JWT>)
//     POST /api/admin/login       {username, password} -> {token, expires}
//     GET  /api/admin/stats       核心 KPI
//     GET  /api/admin/heroes      英雄分布 TOP 30
//     GET  /api/admin/recent      最近 50 条结果
//     GET  /api/admin/timeseries  最近 30 天访问趋势
//
// Cron (daily 03:00 UTC)
//   DELETE visits, results  where ts < now - 30d
//
// Env / Secrets
//   DB                      D1 binding
//   JWT_SECRET              HMAC-SHA256 secret (wrangler secret put)
//   ADMIN_USERNAME          vars
//   ADMIN_PASSWORD          wrangler secret put
//   CORS_ORIGINS            comma-separated allowlist
// =================================================================================

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const JWT_TTL_MS   = 6  * 60 * 60 * 1000;       // 6h admin session

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") return corsResponse(null, request, env, 204);

    try {
      if (path === "/api/track"           && request.method === "POST") return withCors(await trackVisit(request, env), request, env);
      if (path === "/api/result"          && request.method === "POST") return withCors(await trackResult(request, env), request, env);
      if (path === "/api/public/stats"    && request.method === "GET")  return withCors(await publicStats(env), request, env);

      if (path === "/api/admin/login"      && request.method === "POST") return withCors(await adminLogin(request, env), request, env);
      if (path === "/api/admin/stats"      && request.method === "GET")  return withCors(await requireAuth(request, env, adminStats), request, env);
      if (path === "/api/admin/heroes"     && request.method === "GET")  return withCors(await requireAuth(request, env, adminHeroes), request, env);
      if (path === "/api/admin/recent"     && request.method === "GET")  return withCors(await requireAuth(request, env, adminRecent), request, env);
      if (path === "/api/admin/timeseries" && request.method === "GET")  return withCors(await requireAuth(request, env, adminTimeseries), request, env);

      // Health
      if (path === "/") return withCors(json({ ok: true, service: "wzry-api", time: Date.now() }), request, env);

      return withCors(json({ error: "not found" }, 404), request, env);
    } catch (e) {
      return withCors(json({ error: "internal", detail: String(e && e.message || e) }, 500), request, env);
    }
  },

  // Daily cron — purge rows older than 30 days
  async scheduled(event, env, ctx) {
    const cutoff = Date.now() - RETENTION_MS;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM visits  WHERE visited_at < ?").bind(cutoff),
      env.DB.prepare("DELETE FROM results WHERE created_at < ?").bind(cutoff),
    ]);
  },
};

// ---------- Public API ----------

async function trackVisit(request, env) {
  const body = await safeJson(request);
  const vid = sanitize(body.vid, 64) || "anon";
  const path = sanitize(body.path, 200) || "/";
  const ref = sanitize(body.ref, 400) || null;
  const ua  = sanitize(body.ua, 400) || null;

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const country = request.headers.get("CF-IPCountry") || null;
  const ipHash = ip ? (await sha256hex(ip)).slice(0, 16) : null;

  await env.DB.prepare(
    "INSERT INTO visits (visited_at, visitor_id, ip_hash, country, path, referrer, ua) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(Date.now(), vid, ipHash, country, path, ref, ua).run();

  return json({ ok: true });
}

async function trackResult(request, env) {
  const body = await safeJson(request);
  const vid = sanitize(body.vid, 64) || "anon";
  const hero = sanitize(body.hero_id, 40);
  if (!hero) return json({ error: "missing hero_id" }, 400);
  const scoresStr = JSON.stringify(body.scores || {}).slice(0, 400);
  await env.DB.prepare(
    "INSERT INTO results (created_at, visitor_id, hero_id, scores_json) VALUES (?, ?, ?, ?)"
  ).bind(Date.now(), vid, hero, scoresStr).run();
  return json({ ok: true });
}

async function publicStats(env) {
  const { results } = await env.DB.prepare("SELECT COUNT(*) AS c FROM results").all();
  const total = results && results[0] ? results[0].c : 0;
  return json({ total });
}

// ---------- Admin API ----------

async function adminLogin(request, env) {
  const body = await safeJson(request);
  const user = (body.username || "").trim();
  const pass = body.password || "";
  if (!user || !pass) return json({ error: "invalid input" }, 400);

  const expectedUser = env.ADMIN_USERNAME || "admin";
  const expectedPass = env.ADMIN_PASSWORD || "";
  if (!expectedPass) return json({ error: "admin password not configured on server" }, 500);

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(pass, expectedPass)) {
    return json({ error: "invalid username or password" }, 401);
  }

  const exp = Date.now() + JWT_TTL_MS;
  const token = await signJwt({ sub: user, exp }, env.JWT_SECRET || "dev-secret");
  return json({ token, expires: exp });
}

async function requireAuth(request, env, handler) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = auth.slice(7);
  const payload = await verifyJwt(token, env.JWT_SECRET || "dev-secret");
  if (!payload) return json({ error: "invalid token" }, 401);
  if (!payload.exp || payload.exp < Date.now()) return json({ error: "token expired" }, 401);
  return handler(request, env, payload);
}

async function adminStats(request, env) {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const rows = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS c FROM visits"),
    env.DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS c FROM visits"),
    env.DB.prepare("SELECT COUNT(*) AS c FROM results"),
    env.DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE visited_at >= ?").bind(todayStart.getTime()),
  ]);
  return json({
    total_visits: rows[0].results[0].c,
    unique_visitors: rows[1].results[0].c,
    total_results: rows[2].results[0].c,
    today_visits: rows[3].results[0].c,
    server_time: now,
  });
}

async function adminHeroes(request, env) {
  const { results } = await env.DB.prepare(
    "SELECT hero_id, COUNT(*) AS count FROM results GROUP BY hero_id ORDER BY count DESC LIMIT 30"
  ).all();
  return json({ heroes: results || [] });
}

async function adminRecent(request, env) {
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, visitor_id, hero_id FROM results ORDER BY id DESC LIMIT 50"
  ).all();
  return json({ items: results || [] });
}

async function adminTimeseries(request, env) {
  // group visits by UTC date (YYYY-MM-DD) in the last 30 days
  const start = Date.now() - RETENTION_MS;
  const { results } = await env.DB.prepare(
    `SELECT strftime('%Y-%m-%d', visited_at / 1000, 'unixepoch') AS date,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uv
     FROM visits WHERE visited_at >= ?
     GROUP BY date ORDER BY date ASC`
  ).bind(start).all();

  // fill missing days
  const map = new Map((results || []).map(r => [r.date, r]));
  const out = [];
  const d = new Date(); d.setUTCHours(0, 0, 0, 0);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const dd = new Date(d.getTime() - i * 24 * 3600 * 1000);
    days.push(dd.toISOString().slice(0, 10));
  }
  for (const k of days) {
    const r = map.get(k);
    out.push({ date: k, visits: r ? r.visits : 0, uv: r ? r.uv : 0 });
  }
  return json({ series: out });
}

// ---------- helpers ----------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withCors(resp, request, env) {
  const headers = new Headers(resp.headers);
  const origin = request.headers.get("Origin") || "";
  const allowlist = (env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  // Auto-allow any localhost / 127.0.0.1 origin regardless of port (dev convenience)
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (
    allowlist.length === 0 ||
    allowlist.includes(origin) ||
    allowlist.includes("*") ||
    isLocalhost
  ) {
    headers.set("Access-Control-Allow-Origin", origin || "*");
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Credentials", "false");
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return new Response(resp.body, { status: resp.status, headers });
}

function corsResponse(body, request, env, status = 204) {
  const resp = new Response(body, { status });
  return withCors(resp, request, env);
}

async function safeJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

function sanitize(v, maxLen) {
  if (v == null) return null;
  const s = String(v);
  if (s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256hex(s) {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// -------- minimal JWT (HS256) --------
function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}
async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const h64 = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = new TextEncoder().encode(`${h64}.${p64}`);
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return `${h64}.${p64}.${b64url(sig)}`;
}
async function verifyJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h64, p64, s64] = parts;
    const data = new TextEncoder().encode(`${h64}.${p64}`);
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(s64), data);
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(b64urlDecode(p64)));
  } catch (e) { return null; }
}

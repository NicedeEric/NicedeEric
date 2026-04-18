/**
 * API client — talks to the Cloudflare Worker backend.
 * If the backend URL is not configured, all calls silently no-op so the
 * quiz still works as a pure static page during local preview.
 */
(function () {
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // BACKEND URL — change this after deploying the Worker.
  // Leave as empty string to disable analytics tracking.
  // Example: "https://wzry-api.<your-subdomain>.workers.dev"
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  const API_BASE = (window.__API_BASE__ || "https://wzry-api.wzrypersona.workers.dev").replace(/\/$/, "");

  const LS_VID = "wzry_vid";
  function getVisitorId() {
    let v = localStorage.getItem(LS_VID);
    if (!v) {
      v = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(LS_VID, v);
    }
    return v;
  }

  async function post(path, body) {
    if (!API_BASE) return null;
    try {
      const r = await fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!r.ok) {
        let detail = null;
        try { detail = await r.json(); } catch (e) {}
        return { __error: r.status, ...(detail || {}) };
      }
      return await r.json();
    } catch (e) {
      return { __error: -1, message: String(e && e.message || e) };
    }
  }

  async function get(path, token) {
    if (!API_BASE) return null;
    try {
      const headers = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      const r = await fetch(API_BASE + path, { method: "GET", headers });
      if (!r.ok) return { __error: r.status };
      return await r.json();
    } catch (e) {
      return { __error: -1, message: String(e && e.message || e) };
    }
  }

  window.WzryAPI = {
    configured: !!API_BASE,
    baseUrl: API_BASE,
    visitorId: getVisitorId(),

    // public
    trackVisit(path) {
      return post("/api/track", {
        vid: getVisitorId(),
        path: path || (location.pathname + location.search),
        ref: document.referrer || null,
        ua: navigator.userAgent,
      });
    },
    trackResult(heroId, scores) {
      return post("/api/result", {
        vid: getVisitorId(),
        hero_id: heroId,
        scores: scores,
      });
    },
    getPublicStats() {
      if (!API_BASE) return Promise.resolve(null);
      return fetch(API_BASE + "/api/public/stats")
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    },

    // admin
    adminLogin(username, password) {
      return post("/api/admin/login", { username, password });
    },
    adminStats(token)      { return get("/api/admin/stats", token); },
    adminHeroes(token)     { return get("/api/admin/heroes", token); },
    adminRecent(token)     { return get("/api/admin/recent", token); },
    adminTimeseries(token) { return get("/api/admin/timeseries", token); },
  };
})();

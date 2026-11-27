/**
 * Dual-Mode Backend / Static API Client
 * Probes `/api/health` cleanly; activates real server persistence when available,
 * and silently operates in offline/IndexedDB mode when hosted on static CDNs (e.g., GitHub Pages).
 */

let cachedMode = null;
let detectPromise = null;

async function fetchJson(url, opts = {}, timeoutMs = 4000) {
  if (typeof fetch !== 'function') return { ok: false, status: 0, data: null };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {})
      },
      ...opts,
      signal: ctrl ? ctrl.signal : undefined
    });
    if (timer) clearTimeout(timer);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    if (timer) clearTimeout(timer);
    return { ok: false, status: 0, data: null };
  }
}

export async function detectServerMode(force = false) {
  if (!force && cachedMode !== null) return cachedMode === 'server';
  if (!force && detectPromise) return detectPromise;

  detectPromise = (async () => {
    const r = await fetchJson('/api/health', { method: 'GET' }, 900);
    cachedMode = r.ok && r.data && r.data.ok ? 'server' : 'static';
    return cachedMode === 'server';
  })();

  return detectPromise;
}

export function isServerConnected() {
  return cachedMode === 'server';
}

export async function apiMe() {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/auth/me');
  return r.ok && r.data ? r.data.user : null;
}

export async function apiRegister(payload) {
  return fetchJson('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiLogin(payload) {
  return fetchJson('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiUpdateProfile(payload) {
  return fetchJson('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiLogout() {
  return fetchJson('/api/auth/logout', { method: 'POST', body: '{}' });
}

export async function apiListWorks() {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/works');
  return r.ok && r.data ? r.data.works : null;
}

export async function apiSaveWork(work) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/works', { method: 'POST', body: JSON.stringify({ work }) });
  return r.ok && r.data ? r.data.work : null;
}

export async function apiSyncWorks(works) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/works/sync', { method: 'POST', body: JSON.stringify({ works }) });
  return r.ok && r.data ? r.data.works : null;
}

export async function apiDeleteWork(id) {
  if (!(await detectServerMode())) return null;
  return fetchJson(`/api/works/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function apiUploadImage(dataUrl, filename) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/uploads', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, filename })
  }, 10000);
  return r.ok ? r.data : null;
}

export async function apiGetCard(slugOrId) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson(`/api/cards/${encodeURIComponent(slugOrId)}`);
  return r.ok && r.data ? r.data.card : null;
}

export async function apiRecordCardEvent(slugOrId, type) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson(`/api/cards/${encodeURIComponent(slugOrId)}/event`, {
    method: 'POST',
    body: JSON.stringify({ type })
  });
  return r.ok && r.data ? r.data.stats : null;
}

export async function apiGetCustomTemplates() {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/custom-templates');
  return r.ok && r.data ? r.data.templates : null;
}

export async function apiSaveCustomTemplate(tpl) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/custom-templates', {
    method: 'POST',
    body: JSON.stringify(tpl)
  });
  return r.ok && r.data ? r.data.template : null;
}

export async function apiGetFavorites() {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/favorites');
  return r.ok && r.data ? r.data.favorites : null;
}

export async function apiToggleFavorite(templateId) {
  if (!(await detectServerMode())) return null;
  const r = await fetchJson('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ templateId })
  });
  return r.ok ? r.data : null;
}

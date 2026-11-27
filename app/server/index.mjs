import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase, todayIsoDay, build7DayTrend } from './db.mjs';
import {
  hashPassword,
  verifyPassword,
  createSession,
  getUserByToken,
  deleteSession,
  readAuthToken,
  sessionCookieHeader
} from './auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

async function readBodyBuffer(req, maxBytes = 12 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const buf = await readBodyBuffer(req, 12 * 1024 * 1024);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf-8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
}

function cleanSlug(raw, fallback = 'hatsuboshi-p') {
  const s = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  return s || fallback;
}

function ensureUniqueSlug(db, baseSlug, excludeWorkId = null) {
  const base = cleanSlug(baseSlug, 'hatsuboshi-p');
  const exists = (candidate) => {
    const row = excludeWorkId
      ? db.prepare('SELECT id FROM works WHERE slug = ? AND id != ?').get(candidate, excludeWorkId)
      : db.prepare('SELECT id FROM works WHERE slug = ?').get(candidate);
    return Boolean(row);
  };
  if (!exists(base)) return base;
  let i = 2;
  while (exists(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function formatWorkRow(db, row) {
  let parsed = {};
  try {
    parsed = JSON.parse(row.data_json);
  } catch {
    parsed = {};
  }
  parsed.id = row.id;
  parsed.fileName = row.file_name;
  parsed.templateId = row.template_id;
  parsed.h5 = parsed.h5 || {};
  parsed.h5.slug = row.slug;
  parsed.updatedAt = row.updated_at;
  parsed.stats = {
    pv: Number(row.pv || 0),
    saves: Number(row.saves || 0),
    trend: build7DayTrend(db, row.id)
  };
  return parsed;
}

function serveStaticFile(res, rootDir, relPath) {
  const safeRel = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let target = path.join(rootDir, safeRel);
  if (!target.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return false;
  }
  const ext = path.extname(target).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(target).pipe(res);
  return true;
}

export function createAppServer(options = {}) {
  const appRoot = path.resolve(__dirname, '..');
  const publicDir = options.publicDir || path.join(appRoot, 'public');
  const prototypeDir = options.prototypeDir || path.resolve(appRoot, '..', 'prototype');
  const dbPath = options.dbPath || path.join(appRoot, 'data', 'ichiban.sqlite');
  const db = openDatabase(dbPath);

  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(urlObj.pathname);
      const method = (req.method || 'GET').toUpperCase();

      // Shortlink redirect: /p/:slug -> /card.html?slug=:slug
      if (method === 'GET' && pathname.startsWith('/p/')) {
        const slug = cleanSlug(pathname.slice(3));
        res.writeHead(302, { Location: `/card.html?slug=${encodeURIComponent(slug)}` });
        res.end();
        return;
      }

      // API Routes
      if (pathname.startsWith('/api/')) {
        const token = readAuthToken(req);
        const currentUser = getUserByToken(db, token);

        if (method === 'GET' && pathname === '/api/health') {
          return sendJson(res, 200, { ok: true, mode: 'server', version: '1.0.0' });
        }

        // Auth: Register
        if (method === 'POST' && pathname === '/api/auth/register') {
          const body = await readJsonBody(req);
          const username = String(body.username || '').trim().toLowerCase();
          const password = String(body.password || '');
          const displayName = String(body.name || username || '制作人Producer').trim().slice(0, 32);
          const idol = String(body.idol || '').trim().slice(0, 24);
          const color = String(body.color || '#FF7600').trim().slice(0, 24);
          const company = String(body.company || '初星学園').trim().slice(0, 48);

          if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
            return sendJson(res, 400, { error: '用户名需为 3-24 位英文、数字、下划线或短横线' });
          }
          if (password.length < 4) {
            return sendJson(res, 400, { error: '密码长度至少 4 位' });
          }
          const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
          if (dup) {
            return sendJson(res, 409, { error: '该制作人账号已被注册' });
          }

          const userId = 'usr_' + crypto.randomUUID().slice(0, 12);
          db.prepare(
            `INSERT INTO users (id, username, password_hash, display_name, idol, color, company, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(userId, username, hashPassword(password), displayName, idol, color, company, Date.now());

          const newToken = createSession(db, userId);
          return sendJson(
            res,
            201,
            {
              user: { id: userId, username, name: displayName, idol, color, company },
              token: newToken
            },
            { 'Set-Cookie': sessionCookieHeader(newToken) }
          );
        }

        // Auth: Login
        if (method === 'POST' && pathname === '/api/auth/login') {
          const body = await readJsonBody(req);
          const username = String(body.username || '').trim().toLowerCase();
          const password = String(body.password || '');
          const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
          if (!row || !verifyPassword(password, row.password_hash)) {
            return sendJson(res, 401, { error: '用户名或密码错误' });
          }
          const newToken = createSession(db, row.id);
          return sendJson(
            res,
            200,
            {
              user: {
                id: row.id,
                username: row.username,
                name: row.display_name,
                idol: row.idol || '',
                color: row.color || '#FF7600',
                company: row.company || '初星学園'
              },
              token: newToken
            },
            { 'Set-Cookie': sessionCookieHeader(newToken) }
          );
        }

        // Auth: Update profile
        if (method === 'PUT' && pathname === '/api/auth/profile') {
          if (!currentUser) return sendJson(res, 401, { error: '请先登录' });
          const body = await readJsonBody(req);
          const displayName = String(body.name || currentUser.name).trim().slice(0, 32);
          const idol = String(body.idol ?? currentUser.idol).trim().slice(0, 24);
          const color = String(body.color || currentUser.color).trim().slice(0, 24);
          const company = String(body.company || currentUser.company).trim().slice(0, 48);
          db.prepare('UPDATE users SET display_name = ?, idol = ?, color = ?, company = ? WHERE id = ?').run(
            displayName,
            idol,
            color,
            company,
            currentUser.id
          );
          return sendJson(res, 200, {
            user: { ...currentUser, name: displayName, idol, color, company }
          });
        }

        // Auth: Me
        if (method === 'GET' && pathname === '/api/auth/me') {
          return sendJson(res, 200, { user: currentUser });
        }

        // Auth: Logout
        if (method === 'POST' && pathname === '/api/auth/logout') {
          deleteSession(db, token);
          return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookieHeader('', 0) });
        }

        // Works: List (scoped to logged-in user, or guest public works if anonymous)
        if (method === 'GET' && pathname === '/api/works') {
          const rows = currentUser
            ? db.prepare('SELECT * FROM works WHERE user_id = ? ORDER BY updated_at DESC').all(currentUser.id)
            : db.prepare('SELECT * FROM works WHERE user_id IS NULL ORDER BY updated_at DESC LIMIT 40').all();
          return sendJson(res, 200, { works: rows.map((r) => formatWorkRow(db, r)) });
        }

        // Works: Create or Upsert
        if (method === 'POST' && pathname === '/api/works') {
          const body = await readJsonBody(req);
          const work = body && body.work ? body.work : body;
          if (!work || typeof work !== 'object') {
            return sendJson(res, 400, { error: 'Missing work payload' });
          }
          const now = Date.now();
          const workId = String(work.id || 'wk_' + crypto.randomUUID().slice(0, 10));
          const existing = db.prepare('SELECT id, user_id, pv, saves, created_at FROM works WHERE id = ?').get(workId);
          if (existing && existing.user_id && (!currentUser || existing.user_id !== currentUser.id)) {
            return sendJson(res, 403, { error: '无权覆盖他人的作品方案' });
          }

          const desiredSlug = cleanSlug((work.h5 && work.h5.slug) || 'hatsuboshi-p');
          const slug = ensureUniqueSlug(db, desiredSlug, workId);
          work.h5 = work.h5 || {};
          work.h5.slug = slug;
          work.id = workId;
          work.updatedAt = now;

          const fileName = String(work.fileName || '未命名名刺方案').slice(0, 64);
          const templateId = String(work.templateId || 'T12').slice(0, 24);
          const jsonStr = JSON.stringify(work);

          if (existing) {
            db.prepare(
              `UPDATE works SET user_id = COALESCE(user_id, ?), slug = ?, file_name = ?, template_id = ?, data_json = ?, updated_at = ?
               WHERE id = ?`
            ).run(currentUser ? currentUser.id : null, slug, fileName, templateId, jsonStr, now, workId);
          } else {
            const initPv = Number((work.stats && work.stats.pv) || 0);
            const initSaves = Number((work.stats && work.stats.saves) || 0);
            db.prepare(
              `INSERT INTO works (id, user_id, slug, file_name, template_id, data_json, pv, saves, updated_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              workId,
              currentUser ? currentUser.id : null,
              slug,
              fileName,
              templateId,
              jsonStr,
              initPv,
              initSaves,
              now,
              now
            );
          }

          const savedRow = db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
          return sendJson(res, existing ? 200 : 201, { work: formatWorkRow(db, savedRow) });
        }

        // Works: Sync batch (used after login to push local offline works)
        if (method === 'POST' && pathname === '/api/works/sync') {
          if (!currentUser) return sendJson(res, 401, { error: '需要登录后同步作品' });
          const body = await readJsonBody(req);
          const list = Array.isArray(body.works) ? body.works : [];
          const now = Date.now();
          for (const item of list) {
            if (!item || !item.id) continue;
            const existing = db.prepare('SELECT id, user_id, updated_at FROM works WHERE id = ?').get(item.id);
            if (existing && existing.user_id && existing.user_id !== currentUser.id) continue;
            const slug = ensureUniqueSlug(db, (item.h5 && item.h5.slug) || 'hatsuboshi-p', item.id);
            item.h5 = item.h5 || {};
            item.h5.slug = slug;
            const fileName = String(item.fileName || '未命名名刺方案').slice(0, 64);
            const templateId = String(item.templateId || 'T12').slice(0, 24);
            if (!existing) {
              db.prepare(
                `INSERT INTO works (id, user_id, slug, file_name, template_id, data_json, pv, saves, updated_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).run(
                item.id,
                currentUser.id,
                slug,
                fileName,
                templateId,
                JSON.stringify(item),
                Number((item.stats && item.stats.pv) || 0),
                Number((item.stats && item.stats.saves) || 0),
                item.updatedAt || now,
                now
              );
            } else if ((item.updatedAt || 0) > existing.updated_at) {
              db.prepare(
                `UPDATE works SET user_id = ?, slug = ?, file_name = ?, template_id = ?, data_json = ?, updated_at = ?
                 WHERE id = ?`
              ).run(currentUser.id, slug, fileName, templateId, JSON.stringify(item), item.updatedAt || now, item.id);
            }
          }
          const rows = db.prepare('SELECT * FROM works WHERE user_id = ? ORDER BY updated_at DESC').all(currentUser.id);
          return sendJson(res, 200, { works: rows.map((r) => formatWorkRow(db, r)) });
        }

        // Works: Update / Delete single work
        const workMatch = pathname.match(/^\/api\/works\/([^/]+)$/);
        if (workMatch) {
          const workId = workMatch[1];
          const existing = db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
          if (!existing) return sendJson(res, 404, { error: '未找到指定作品方案' });
          if (existing.user_id && (!currentUser || existing.user_id !== currentUser.id)) {
            return sendJson(res, 403, { error: '无权访问该作品方案' });
          }

          if (method === 'PUT') {
            const body = await readJsonBody(req);
            const work = body && body.work ? body.work : body;
            const now = Date.now();
            const merged = { ...formatWorkRow(db, existing), ...work, id: workId, updatedAt: now };
            const slug = ensureUniqueSlug(db, (merged.h5 && merged.h5.slug) || existing.slug, workId);
            merged.h5 = merged.h5 || {};
            merged.h5.slug = slug;
            const fileName = String(merged.fileName || existing.file_name).slice(0, 64);
            const templateId = String(merged.templateId || existing.template_id).slice(0, 24);
            db.prepare(
              'UPDATE works SET slug = ?, file_name = ?, template_id = ?, data_json = ?, updated_at = ? WHERE id = ?'
            ).run(slug, fileName, templateId, JSON.stringify(merged), now, workId);
            const updatedRow = db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
            return sendJson(res, 200, { work: formatWorkRow(db, updatedRow) });
          }

          if (method === 'DELETE') {
            db.prepare('DELETE FROM works WHERE id = ?').run(workId);
            return sendJson(res, 200, { ok: true, id: workId });
          }
        }

        // Public Card Lookup & Event Recording
        const cardEventMatch = pathname.match(/^\/api\/cards\/([^/]+)\/event$/);
        if (cardEventMatch && method === 'POST') {
          const idOrSlug = cardEventMatch[1];
          const body = await readJsonBody(req);
          const type = body.type === 'save' ? 'save' : 'pv';
          const row = db.prepare('SELECT * FROM works WHERE id = ? OR slug = ?').get(idOrSlug, idOrSlug);
          if (!row) return sendJson(res, 404, { error: '名片不存在' });

          const day = todayIsoDay();
          if (type === 'save') {
            db.prepare('UPDATE works SET saves = saves + 1 WHERE id = ?').run(row.id);
            db.prepare(
              `INSERT INTO daily_stats (work_id, day, pv, saves) VALUES (?, ?, 0, 1)
               ON CONFLICT(work_id, day) DO UPDATE SET saves = saves + 1`
            ).run(row.id, day);
          } else {
            db.prepare('UPDATE works SET pv = pv + 1 WHERE id = ?').run(row.id);
            db.prepare(
              `INSERT INTO daily_stats (work_id, day, pv, saves) VALUES (?, ?, 1, 0)
               ON CONFLICT(work_id, day) DO UPDATE SET pv = pv + 1`
            ).run(row.id, day);
          }
          const updated = db.prepare('SELECT * FROM works WHERE id = ?').get(row.id);
          return sendJson(res, 200, {
            stats: {
              pv: Number(updated.pv || 0),
              saves: Number(updated.saves || 0),
              trend: build7DayTrend(db, updated.id)
            }
          });
        }

        const cardMatch = pathname.match(/^\/api\/cards\/([^/]+)$/);
        if (cardMatch && method === 'GET') {
          const idOrSlug = cardMatch[1];
          const row = db.prepare('SELECT * FROM works WHERE id = ? OR slug = ?').get(idOrSlug, idOrSlug);
          if (!row) return sendJson(res, 404, { error: '未找到对应制作人电子名刺' });
          return sendJson(res, 200, { card: formatWorkRow(db, row) });
        }

        // Uploads: POST JSON { filename, dataUrl } or raw binary
        if (method === 'POST' && pathname === '/api/uploads') {
          const ct = String(req.headers['content-type'] || '');
          let mime = 'image/png';
          let filename = 'standee.png';
          let binary = null;

          if (ct.includes('application/json')) {
            const body = await readJsonBody(req);
            const dataUrl = String(body.dataUrl || '');
            const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!m) return sendJson(res, 400, { error: '无效的图片 DataURL' });
            mime = m[1];
            filename = String(body.filename || 'standee.png').slice(0, 80);
            binary = Buffer.from(m[2], 'base64');
          } else {
            mime = ct.split(';')[0].trim() || 'application/octet-stream';
            filename = String(req.headers['x-filename'] || 'asset.bin').slice(0, 80);
            binary = await readBodyBuffer(req, 8 * 1024 * 1024);
          }

          if (!binary || !binary.length) return sendJson(res, 400, { error: '空文件' });
          if (binary.length > 8 * 1024 * 1024) return sendJson(res, 413, { error: '图片大小不可超过 8MB' });

          const id = 'up_' + crypto.randomUUID().slice(0, 12);
          db.prepare(
            'INSERT INTO uploads (id, user_id, mime, filename, data, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(id, currentUser ? currentUser.id : null, mime, filename, binary, binary.length, Date.now());

          return sendJson(res, 201, {
            id,
            url: `/api/uploads/${id}`,
            mime,
            filename,
            byteSize: binary.length
          });
        }

        const uploadMatch = pathname.match(/^\/api\/uploads\/([^/]+)$/);
        if (uploadMatch && method === 'GET') {
          const row = db.prepare('SELECT mime, data FROM uploads WHERE id = ?').get(uploadMatch[1]);
          if (!row) return sendJson(res, 404, { error: '素材不存在' });
          const buf = Buffer.from(row.data);
          res.writeHead(200, {
            'Content-Type': row.mime || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          res.end(buf);
          return;
        }

        // Custom Templates
        if (method === 'GET' && pathname === '/api/custom-templates') {
          if (!currentUser) return sendJson(res, 200, { templates: [] });
          const rows = db
            .prepare('SELECT id, name, data_json, created_at FROM custom_templates WHERE user_id = ? ORDER BY created_at DESC')
            .all(currentUser.id);
          return sendJson(res, 200, {
            templates: rows.map((r) => ({ id: r.id, name: r.name, ...JSON.parse(r.data_json), createdAt: r.created_at }))
          });
        }

        if (method === 'POST' && pathname === '/api/custom-templates') {
          if (!currentUser) return sendJson(res, 401, { error: '请先登录以保存个人模板库' });
          const body = await readJsonBody(req);
          const id = body.id || 'CT_' + crypto.randomUUID().slice(0, 8);
          const name = String(body.name || '我的专属模板').slice(0, 40);
          const tplData = { ...body, id, name, isCustom: true };
          db.prepare(
            `INSERT INTO custom_templates (id, user_id, name, data_json, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json`
          ).run(id, currentUser.id, name, JSON.stringify(tplData), Date.now());
          return sendJson(res, 201, { template: tplData });
        }

        // Favorites
        if (method === 'GET' && pathname === '/api/favorites') {
          if (!currentUser) return sendJson(res, 200, { favorites: [] });
          const rows = db.prepare('SELECT template_id FROM favorites WHERE user_id = ?').all(currentUser.id);
          return sendJson(res, 200, { favorites: rows.map((r) => r.template_id) });
        }

        if (method === 'POST' && pathname === '/api/favorites') {
          if (!currentUser) return sendJson(res, 401, { error: '请先登录后同步收藏' });
          const body = await readJsonBody(req);
          const tplId = String(body.templateId || '').trim();
          if (!tplId) return sendJson(res, 400, { error: 'Missing templateId' });
          const exist = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND template_id = ?').get(currentUser.id, tplId);
          if (exist) {
            db.prepare('DELETE FROM favorites WHERE user_id = ? AND template_id = ?').run(currentUser.id, tplId);
            return sendJson(res, 200, { favorited: false });
          }
          db.prepare('INSERT INTO favorites (user_id, template_id, created_at) VALUES (?, ?, ?)').run(
            currentUser.id,
            tplId,
            Date.now()
          );
          return sendJson(res, 200, { favorited: true });
        }

        return sendJson(res, 404, { error: 'API endpoint not found' });
      }

      // Prototype mirror at /prototype/
      if (pathname === '/prototype' || pathname.startsWith('/prototype/')) {
        const subRel = pathname === '/prototype' || pathname === '/prototype/' ? 'index.html' : pathname.slice('/prototype/'.length);
        if (serveStaticFile(res, prototypeDir, subRel)) return;
      }

      // Production static files at /
      const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      if (serveStaticFile(res, publicDir, rel)) return;

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } catch (err) {
      const code = err && err.statusCode ? err.statusCode : 500;
      sendJson(res, code, { error: err.message || 'Internal Server Error' });
    }
  });

  server.db = db;
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  const port = Number(process.env.PORT || 8780);
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`[一番星 正式版服务器] 运行中: http://localhost:${port}/`);
    console.log(`[一番星 原型对照]   http://localhost:${port}/prototype/`);
  });
}

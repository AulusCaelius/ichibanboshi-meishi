import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createAppServer } from '../server/index.mjs';

test('Full-stack SQLite API supports register, login, works CRUD, upload, H5 card analytics, and shortlink redirect', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ichiban-test-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  const server = createAppServer({ dbPath });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Health check
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.mode, 'server');

    // 2. Register account
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sena_p',
        password: 'password123',
        name: '十王制作人',
        idol: '十王星南',
        color: '#F6AE54',
        company: '初星学園'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.token);
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData.token}`
    };

    // 3. Create work
    const saveRes = await fetch(`${baseUrl}/api/works`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        work: {
          id: 'wk_test_01',
          fileName: '一番星旗舰名刺',
          templateId: 'T12',
          fields: { name: '十王制作人', title: '十王星南担当', company: '初星学園' },
          h5: { slug: 'sena-live', layout: 'card', bio: '现场欢迎交换' }
        }
      })
    });
    assert.equal(saveRes.status, 201);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.work.h5.slug, 'sena-live');

    // 4. Upload standee image (1x1 transparent PNG)
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const upRes = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ filename: 'standee.png', dataUrl: tinyPng })
    });
    assert.equal(upRes.status, 201);
    const upJson = await upRes.json();
    assert.ok(upJson.url.startsWith('/api/uploads/up_'));
    const imgGet = await fetch(`${baseUrl}${upJson.url}`);
    assert.equal(imgGet.status, 200);

    // 5. Public H5 lookup & PV/save event recording
    const cardBefore = await fetch(`${baseUrl}/api/cards/sena-live`).then((r) => r.json());
    assert.equal(cardBefore.card.stats.pv, 0);

    await fetch(`${baseUrl}/api/cards/sena-live/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pv' })
    });
    const evSave = await fetch(`${baseUrl}/api/cards/sena-live/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'save' })
    }).then((r) => r.json());
    assert.equal(evSave.stats.pv, 1);
    assert.equal(evSave.stats.saves, 1);

    // 6. Shortlink /p/:slug redirect
    const shortRes = await fetch(`${baseUrl}/p/sena-live`, { redirect: 'manual' });
    assert.equal(shortRes.status, 302);
    assert.equal(shortRes.headers.get('location'), '/card.html?slug=sena-live');

    // 7. Prototype comparison page served
    const protoRes = await fetch(`${baseUrl}/prototype/index.html`);
    assert.equal(protoRes.status, 200);
  } finally {
    server.close();
    server.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

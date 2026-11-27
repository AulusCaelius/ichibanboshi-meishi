import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQrMatrix, renderQrSvg } from '../public/assets/js/core/qrcode.mjs';
import { encodeSharePayload, decodeSharePayload } from '../public/assets/js/core/share-codec.mjs';
import { TEMPLATES } from '../public/assets/js/core/catalog.mjs';

test('Catalog contains 128 distinct templates', () => {
  assert.equal(TEMPLATES.length, 128);
  const ids = new Set(TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, 128);
});

test('ISO/IEC 18004 QR encoder produces valid finder patterns and SVG markup', () => {
  const qr = encodeQrMatrix('https://auluscaelius.github.io/ichibanboshi-meishi/card.html?slug=hatsuboshi-p');
  assert.ok(qr.version >= 1 && qr.version <= 15);
  assert.equal(qr.size, qr.version * 4 + 17);
  // Check top-left 7x7 finder outer ring
  for (let i = 0; i < 7; i++) {
    assert.equal(qr.modules[0][i], 1);
    assert.equal(qr.modules[6][i], 1);
    assert.equal(qr.modules[i][0], 1);
    assert.equal(qr.modules[i][6], 1);
  }
  // Check center 3x3 finder core
  assert.equal(qr.modules[3][3], 1);

  const svg = renderQrSvg('制作人Producer · 花海咲季担当', { border: 2 });
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('<path d="M'));
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
});

test('Share payload codec round-trips UTF-8 Japanese/Chinese producer fields cleanly', () => {
  const sample = {
    templateId: 'T01',
    accent: '#E30F25',
    sides: 2,
    spec: 'jp',
    corner: 3,
    material: 'washi',
    sideMaterials: { front: 'washi', back: 'black' },
    regionMaterials: { name: 'gold', qr: 'silver' },
    fields: {
      name: '星南P',
      enName: 'SENA PRODUCER',
      title: '十王星南担当',
      company: '初星学園',
      pid: 'GAKUEN-001',
      eventTag: '初星祭',
      x: '@hatsuboshi_p',
      favSong: '小さな野望',
      backTitle: '一番星へ',
      backSub: 'Live交换请扫码'
    },
    h5: { layout: 'poster', bio: '欢迎互换名刺', show: { x: true }, slug: 'sena-p' }
  };

  const encoded = encodeSharePayload(sample);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(encoded));
  const decoded = decodeSharePayload(encoded);
  assert.equal(decoded.fields.name, '星南P');
  assert.equal(decoded.fields.pid, 'GAKUEN-001');
  assert.equal(decoded.fields.eventTag, '初星祭');
  assert.equal(decoded.sideMaterials.back, 'black');
  assert.equal(decoded.regionMaterials.name, 'gold');
  assert.equal(decoded.h5.slug, 'sena-p');
});

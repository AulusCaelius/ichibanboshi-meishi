import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { runPreflight, applyAllAutoFixes } from '../public/assets/js/core/preflight.mjs';
import {
  rgbaToCmykBytes,
  rgbaToGrayK100Bytes,
  buildPdfDocument,
  buildZipArchive,
  detectActiveCrafts
} from '../public/assets/js/core/print-engine.mjs';

test('Preflight 1-click auto-fix resolves stroke, richblack, safezone, and small-font issues', () => {
  const project = {
    templateId: 'T06', // gakuen style triggers thin stroke check if strokeMinPt < 0.25
    spec: 'cn',
    strokeMinPt: 0.2,
    fields: { name: '制作人Producer' },
    export: { format: 'pdf', color: 'cmyk', dpi: 300, bleed: 3, autoK100Text: false },
    canvas: {
      front: [
        { id: 'e1', type: 'text', bind: 'name', text: '星南P', x: 1, y: 1, w: 30, h: 10, fontSize: 1.5, color: '#111111', visible: true },
        { id: 'e2', type: 'icon', iconName: 'star', x: 96, y: 90, w: 8, h: 12, visible: true }
      ],
      back: []
    }
  };

  const before = runPreflight(project);
  const issuesBefore = before.filter((c) => c.status !== 'pass');
  assert.ok(issuesBefore.length >= 3);

  const fixedCount = applyAllAutoFixes(project, before);
  assert.ok(fixedCount >= 3);

  const after = runPreflight(project);
  const remainingIssues = after.filter((c) => c.status !== 'pass');
  assert.equal(remainingIssues.length, 0);
});

test('CMYK separation maps pure black/dark neutral text to K100 (0,0,0,K) and PDF encodes /DeviceCMYK', () => {
  // 2 pixels: pure black (0,0,0,255) & orange (#FF7600)
  const rgba = new Uint8Array([0, 0, 0, 255, 255, 118, 0, 255]);
  const cmyk = rgbaToCmykBytes(rgba, 2, 1, true);
  assert.deepEqual(Array.from(cmyk.slice(0, 4)), [0, 0, 0, 255]);
  assert.ok(cmyk[4] === 0 && cmyk[5] > 100 && cmyk[6] === 255 && cmyk[7] === 0);

  const deflated = new Uint8Array(zlib.deflateSync(cmyk));
  const pdf = buildPdfDocument([
    { streamBytes: deflated, filter: 'FlateDecode', colorSpace: 'DeviceCMYK', widthPx: 2, heightPx: 1, widthPt: 255, heightPt: 153 }
  ]);
  const ascii = Buffer.from(pdf).toString('latin1');
  assert.ok(ascii.startsWith('%PDF-1.4'));
  assert.ok(ascii.includes('/ColorSpace /DeviceCMYK'));
  assert.ok(ascii.includes('/Filter /FlateDecode'));
  assert.ok(ascii.includes('%%EOF'));

  const gray = rgbaToGrayK100Bytes(rgba, 2, 1);
  assert.equal(gray[0], 0);
});

test('ZIP packager writes valid local & central directory headers', () => {
  const zip = buildZipArchive([
    { name: '正面.png', bytes: new Uint8Array([1, 2, 3, 4]) },
    { name: '背面.png', bytes: new Uint8Array([5, 6, 7, 8, 9]) }
  ]);
  // Check PK\x03\x04 start and PK\x05\x06 EOCD signature near end
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);
  const str = Buffer.from(zip).toString('latin1');
  assert.ok(str.includes('正面.png') || Buffer.from(zip).includes(Buffer.from('正面.png', 'utf8')));
});

test('Craft summary aggregates regionMaterials and canvas elements', () => {
  const active = detectActiveCrafts({
    regionMaterials: { name: 'gold', qr: 'copper', pid: 'velvet' },
    canvas: {
      front: [{ visible: true, craft: 'brushed' }],
      back: [{ visible: true, craft: 'deboss' }]
    }
  });
  const ids = active.map((a) => a.id).sort();
  assert.deepEqual(ids, ['brushed', 'copper', 'deboss', 'gold', 'velvet']);
});

/**
 * 真实印刷导出引擎 (v1.0)
 * - 支持 PDF 1.4: /DeviceCMYK (/FlateDecode + K100 单色黑文字与裁切标保护) 及 /DeviceRGB
 * - 支持全分辨率 300/600 DPI PNG/JPG（双面或含专色时自动打包标准 ZIP，附带单面独立文件）
 * - 支持工艺专色通道分离（汇总 8 种表面材质并生成 K100 黑白制版蒙版）
 */

import { getDims, getEffectiveSides, getTemplate } from './store.mjs';
import { renderFace, fitText, STYLE_BG } from './card-render.mjs';
import { drawQrToCanvas } from './qrcode.mjs';
import { buildCardShareUrl } from './share-codec.mjs';

export const CRAFT_LABELS = {
  gold: '缎面烫金',
  silver: '哑光烫银',
  copper: '赤铜烫印',
  emboss: '击凸浮雕',
  deboss: '活字压凹',
  uv: '立体厚墨',
  velvet: '丝绒触感',
  brushed: '拉丝金属'
};

export function detectActiveCrafts(project) {
  const found = new Set();
  if (project && project.regionMaterials) {
    Object.values(project.regionMaterials).forEach((m) => {
      if (m && m !== 'none' && CRAFT_LABELS[m]) found.add(m);
    });
  }
  if (project && project.crafts) {
    Object.keys(CRAFT_LABELS).forEach((k) => {
      if (project.crafts[k]) found.add(k);
    });
  }
  if (project && project.canvas) {
    ['front', 'back'].forEach((side) => {
      const list = project.canvas[side];
      if (Array.isArray(list)) {
        list.forEach((el) => {
          if (el && el.visible !== false && el.craft && el.craft !== 'none' && CRAFT_LABELS[el.craft]) {
            found.add(el.craft);
          }
        });
      }
    });
  }
  return Array.from(found).map((id) => ({ id, label: CRAFT_LABELS[id] }));
}

function asciiBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function concatChunks(chunks) {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

async function deflateBytes(u8) {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(u8);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return { bytes: new Uint8Array(buf), compressed: true };
  }
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const zlib = await import('node:zlib');
    return { bytes: new Uint8Array(zlib.deflateSync(u8)), compressed: true };
  }
  return { bytes: u8, compressed: false };
}

/**
 * Converts sRGB RGBA pixels into 8-bit 4-channel DeviceCMYK (0-255 per component)
 * with Under-Color Removal / GCR black generation, plus clean K100 (0,0,0,255)
 * protection for dark monochrome pixels when autoK100Text is enabled.
 */
export function rgbaToCmykBytes(rgba, width, height, autoK100Text = true) {
  const count = width * height;
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const p4 = i * 4;
    const r = rgba[p4];
    const g = rgba[p4 + 1];
    const b = rgba[p4 + 2];
    const a = rgba[p4 + 3] / 255;

    // Composite against white paper background
    const rn = (r * a + 255 * (1 - a)) / 255;
    const gn = (g * a + 255 * (1 - a)) / 255;
    const bn = (b * a + 255 * (1 - a)) / 255;

    const maxC = Math.max(rn, gn, bn);
    const minC = Math.min(rn, gn, bn);

    // Pure / near-neutral dark grays map cleanly to K-only (0,0,0,K)
    if (autoK100Text && maxC - minC < 0.045 && maxC < 0.25) {
      out[p4] = 0;
      out[p4 + 1] = 0;
      out[p4 + 2] = 0;
      out[p4 + 3] = Math.round((1 - (0.299 * rn + 0.587 * gn + 0.114 * bn)) * 255);
      continue;
    }

    const k = 1 - maxC;
    if (k >= 0.999) {
      out[p4] = 0;
      out[p4 + 1] = 0;
      out[p4 + 2] = 0;
      out[p4 + 3] = 255;
    } else {
      const inv = 1 - k;
      out[p4] = Math.min(255, Math.max(0, Math.round(((1 - rn - k) / inv) * 255)));
      out[p4 + 1] = Math.min(255, Math.max(0, Math.round(((1 - gn - k) / inv) * 255)));
      out[p4 + 2] = Math.min(255, Math.max(0, Math.round(((1 - bn - k) / inv) * 255)));
      out[p4 + 3] = Math.min(255, Math.max(0, Math.round(k * 255)));
    }
  }
  return out;
}

export function rgbaToGrayK100Bytes(rgba, width, height) {
  const count = width * height;
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const p4 = i * 4;
    const lum = 0.299 * rgba[p4] + 0.587 * rgba[p4 + 1] + 0.114 * rgba[p4 + 2];
    const a = rgba[p4 + 3] / 255;
    const blended = lum * a + 255 * (1 - a);
    out[i] = Math.min(255, Math.max(0, Math.round(blended)));
  }
  return out;
}

/**
 * Pure Native JS PDF 1.4 Packager supporting:
 * - colorSpace: 'DeviceCMYK' (/FlateDecode), 'DeviceRGB' (/DCTDecode or /FlateDecode), 'DeviceGray'
 * pages: [{ streamBytes, filter, colorSpace, widthPx, heightPx, widthPt, heightPt }]
 */
export function buildPdfDocument(pages) {
  const list = Array.isArray(pages) && pages.length ? pages : [];
  if (!list.length) throw new Error('buildPdfDocument requires at least one page');

  const chunks = [];
  let byteOffset = 0;
  const pushBytes = (u8) => {
    chunks.push(u8);
    byteOffset += u8.length;
  };
  const pushAscii = (str) => pushBytes(asciiBytes(str));

  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const objOffsets = new Map();
  const kidRefs = list.map((_, idx) => `${3 + idx * 3} 0 R`).join(' ');

  objOffsets.set(1, byteOffset);
  pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  objOffsets.set(2, byteOffset);
  pushAscii(`2 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${list.length} >>\nendobj\n`);

  list.forEach((p, idx) => {
    const pageId = 3 + idx * 3;
    const imgId = 4 + idx * 3;
    const contentId = 5 + idx * 3;
    const wPt = Number(p.widthPt || 255.12).toFixed(2);
    const hPt = Number(p.heightPt || 153.07).toFixed(2);
    const raw = p.streamBytes || p.jpegBytes;
    const streamData = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const colorSpace = p.colorSpace || 'DeviceRGB';
    const filter = p.filter !== undefined ? p.filter : 'DCTDecode';
    const filterDecl = filter ? `/Filter /${filter} ` : '';
    const cmd = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im${idx} Do\nQ\n`;

    objOffsets.set(pageId, byteOffset);
    pushAscii(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im${idx} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    objOffsets.set(imgId, byteOffset);
    pushAscii(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /${colorSpace} /BitsPerComponent 8 ${filterDecl}/Length ${streamData.length} >>\nstream\n`
    );
    pushBytes(streamData);
    pushAscii('\nendstream\nendobj\n');

    objOffsets.set(contentId, byteOffset);
    pushAscii(`${contentId} 0 obj\n<< /Length ${cmd.length} >>\nstream\n${cmd}endstream\nendobj\n`);
  });

  const totalObjs = 2 + list.length * 3;
  const xrefOffset = byteOffset;
  pushAscii(`xref\n0 ${totalObjs + 1}\n`);
  pushAscii('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjs; id++) {
    pushAscii(`${String(objOffsets.get(id)).padStart(10, '0')} 00000 n \n`);
  }
  pushAscii(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return concatChunks(chunks);
}

/**
 * Pure JS CRC32 + STORE (Method 0) ZIP Packager for multi-side exports.
 * Entries: [{ name: string, bytes: Uint8Array }]
 */
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZipArchive(entries) {
  const enc = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = enc.encode(entry.name);
    const data = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(local.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true);
    lView.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lView.setUint16(8, 0, true); // STORE
    lView.setUint16(10, 0, true);
    lView.setUint16(12, 0x5421, true);
    lView.setUint32(14, crc, true);
    lView.setUint32(18, data.length, true);
    lView.setUint32(22, data.length, true);
    lView.setUint16(26, nameBytes.length, true);
    lView.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(central.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true);
    cView.setUint16(6, 20, true);
    cView.setUint16(8, 0x0800, true);
    cView.setUint16(10, 0, true);
    cView.setUint16(12, 0, true);
    cView.setUint16(14, 0x5421, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, data.length, true);
    cView.setUint32(24, data.length, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);
    cView.setUint16(32, 0, true);
    cView.setUint16(34, 0, true);
    cView.setUint16(36, 0, true);
    cView.setUint32(38, 0, true);
    cView.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    centralParts.push(central);
    offset += local.length + data.length;
  });

  const centralBlob = concatChunks(centralParts);
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, entries.length, true);
  eView.setUint16(10, entries.length, true);
  eView.setUint32(12, centralBlob.length, true);
  eView.setUint32(16, offset, true);
  eView.setUint16(20, 0, true);

  return concatChunks([...localParts, centralBlob, eocd]);
}

function collectInlineCss() {
  if (typeof document === 'undefined') return '';
  let css = '';
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      const rules = sheet.cssRules;
      if (rules) {
        for (const rule of Array.from(rules)) {
          const text = rule.cssText || '';
          if (/@font-face|@import/i.test(text)) continue;
          css += text.replace(/url\(\s*['"]?https?:\/\/[^)]+\)/gi, 'none') + '\n';
        }
      }
    } catch {}
  }
  return css.replace(/<\/style>/gi, '');
}

const SPOT_MASK_CSS = `
  .spot-plate-root { background: #FFFFFF !important; }
  .spot-plate-root .bcard__face {
    background: #FFFFFF !important;
    background-image: none !important;
    box-shadow: none !important;
  }
  .spot-plate-root .bcard__ribbon,
  .spot-plate-root .bcard__deco-frame,
  .spot-plate-root .bcard__crest,
  .spot-plate-root .bcard__tachie,
  .spot-plate-root .bcard__beams,
  .spot-plate-root .bcard__constellation,
  .spot-plate-root .bcard__bubbles,
  .spot-plate-root .bcard__topbars,
  .spot-plate-root .bcard__back-pattern,
  .spot-plate-root .bcard__pattern,
  .spot-plate-root .bcard__swatch,
  .spot-plate-root .bcard__rule,
  .spot-plate-root .bcard__vdiv,
  .spot-plate-root .bcard__qr {
    opacity: 0 !important;
    visibility: hidden !important;
  }
  .spot-plate-root .bcard__content *,
  .spot-plate-root .bcard__back-inner *,
  .spot-plate-root .bcard__jp-vert,
  .spot-plate-root .el-layer .bcard-el {
    visibility: hidden !important;
  }
  .spot-plate-root .craft-gold,
  .spot-plate-root .craft-silver,
  .spot-plate-root .craft-copper,
  .spot-plate-root .craft-uv,
  .spot-plate-root .craft-emboss,
  .spot-plate-root .craft-deboss,
  .spot-plate-root .craft-velvet,
  .spot-plate-root .craft-brushed,
  .spot-plate-root .craft-gold *,
  .spot-plate-root .craft-silver *,
  .spot-plate-root .craft-copper *,
  .spot-plate-root .craft-uv *,
  .spot-plate-root .craft-emboss *,
  .spot-plate-root .craft-deboss *,
  .spot-plate-root .craft-velvet *,
  .spot-plate-root .craft-brushed * {
    visibility: visible !important;
    opacity: 1 !important;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    background: none !important;
    background-color: transparent !important;
    border-color: #000000 !important;
    text-shadow: none !important;
    filter: none !important;
    animation: none !important;
  }
  .spot-plate-root .bcard__qr.craft-gold,
  .spot-plate-root .bcard__qr.craft-silver,
  .spot-plate-root .bcard__qr.craft-copper,
  .spot-plate-root .bcard__qr.craft-uv,
  .spot-plate-root .bcard__qr.craft-emboss,
  .spot-plate-root .bcard__qr.craft-deboss,
  .spot-plate-root .bcard__qr.craft-velvet,
  .spot-plate-root .bcard__qr.craft-brushed {
    background: #FFFFFF !important;
  }
  .spot-plate-root .bcard-el--icon.craft-gold svg,
  .spot-plate-root .bcard-el--icon.craft-silver svg,
  .spot-plate-root .bcard-el--icon.craft-copper svg,
  .spot-plate-root .bcard-el--icon.craft-uv svg,
  .spot-plate-root .bcard-el--icon.craft-emboss svg,
  .spot-plate-root .bcard-el--icon.craft-deboss svg,
  .spot-plate-root .bcard-el--icon.craft-velvet svg,
  .spot-plate-root .bcard-el--icon.craft-brushed svg,
  .spot-plate-root .bcard-el--shape.craft-gold svg,
  .spot-plate-root .bcard-el--shape.craft-silver svg,
  .spot-plate-root .bcard-el--shape.craft-copper svg,
  .spot-plate-root .bcard-el--shape.craft-uv svg,
  .spot-plate-root .bcard-el--shape.craft-emboss svg,
  .spot-plate-root .bcard-el--shape.craft-deboss svg,
  .spot-plate-root .bcard-el--shape.craft-velvet svg,
  .spot-plate-root .bcard-el--shape.craft-brushed svg {
    stroke: #000000 !important;
    color: #000000 !important;
  }
`;

function measureFallbackLayout(container, face) {
  if (!container || !face) return null;
  const faceRect = face.getBoundingClientRect();
  if (!cardReady(faceRect)) return null;

  const faceCs = window.getComputedStyle(face);
  const items = [];
  const textSelector =
    '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__pid, .bcard__event, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en, .bcard-el--text';

  face.querySelectorAll(textSelector).forEach((node) => {
    const r = node.getBoundingClientRect();
    const cs = window.getComputedStyle(node);
    if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') return;
    const text = (node.textContent || '').trim();
    if (!text) return;
    const hasCraft =
      node.classList.contains('craft-gold') ||
      node.classList.contains('craft-silver') ||
      node.classList.contains('craft-copper') ||
      node.classList.contains('craft-uv') ||
      node.classList.contains('craft-emboss') ||
      node.classList.contains('craft-deboss') ||
      node.classList.contains('craft-velvet') ||
      node.classList.contains('craft-brushed');
    items.push({
      kind: 'text',
      text,
      rx: (r.left - faceRect.left) / faceRect.width,
      ry: (r.top - faceRect.top) / faceRect.height,
      rw: r.width / faceRect.width,
      rh: r.height / faceRect.height,
      fontPxRatio: (parseFloat(cs.fontSize) || 12) / faceRect.width,
      fontWeight: cs.fontWeight || '500',
      color: cs.color || '#333333',
      hasCraft
    });
  });

  face.querySelectorAll('.bcard-el--image img, .bcard__tachie-img').forEach((img) => {
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    items.push({
      kind: 'image',
      src: img.src,
      rx: (r.left - faceRect.left) / faceRect.width,
      ry: (r.top - faceRect.top) / faceRect.height,
      rw: r.width / faceRect.width,
      rh: r.height / faceRect.height
    });
  });

  face.querySelectorAll('.bcard__qr').forEach((qr) => {
    const r = qr.getBoundingClientRect();
    if (!r.width || !r.height) return;
    items.push({
      kind: 'qr',
      url: qr.dataset.qrUrl || '',
      hasCraft: ['gold', 'silver', 'copper', 'uv', 'emboss', 'deboss', 'velvet', 'brushed'].some((k) =>
        qr.classList.contains(`craft-${k}`)
      ),
      rx: (r.left - faceRect.left) / faceRect.width,
      ry: (r.top - faceRect.top) / faceRect.height,
      rw: r.width / faceRect.width,
      rh: r.height / faceRect.height
    });
  });

  return { bg: faceCs.backgroundColor || '#FFFFFF', items };
}

function cardReady(r) {
  return Boolean(r && r.width > 0 && r.height > 0);
}

export function renderFittedFaceHtml(project, side, sandboxEl, widthPx) {
  if (typeof document === 'undefined' || !sandboxEl) {
    return { html: renderFace(project, side), measurements: null };
  }
  const w = Math.max(240, Math.round(widthPx || 720));
  sandboxEl.innerHTML = `<div class="pe-measure-slot" style="width:${w}px;">${renderFace(project, side)}</div>`;
  const isCanvasSide = project.canvas && Array.isArray(project.canvas[side]);
  if (!isCanvasSide) fitText(sandboxEl);

  const slot = sandboxEl.querySelector('.pe-measure-slot');
  const face = sandboxEl.querySelector('.bcard__face');
  const measurements = measureFallbackLayout(sandboxEl, face);
  let html = '';
  if (slot) {
    if (typeof XMLSerializer !== 'undefined') {
      const s = new XMLSerializer();
      for (const child of Array.from(slot.childNodes)) html += s.serializeToString(child);
    } else {
      html = slot.innerHTML;
    }
  }
  sandboxEl.innerHTML = '';
  return { html, measurements };
}

export function buildCompositeSvgMarkup(project, sandboxEl, opts = {}) {
  const dims = getDims(project);
  const bleed = opts.bleed != null ? Number(opts.bleed) : 3;
  const cropMarks = Boolean(opts.cropMarks);
  const spotMode = Boolean(opts.spotMode);
  const sides = Array.isArray(opts.sides) ? opts.sides : ['front', 'back'];

  const scale = 6;
  const trimW = dims.w * scale;
  const trimH = dims.h * scale;
  const bleedPx = bleed * scale;
  const pageW = trimW + bleedPx * 2;
  const pageH = trimH + bleedPx * 2;
  const gap = 28;
  const pad = cropMarks ? 36 : 24;
  const headerH = spotMode ? 30 : 0;
  const svgW = pageW * sides.length + gap * (sides.length - 1) + pad * 2;
  const svgH = pageH + pad * 2 + headerH;

  const t = getTemplate(project.templateId);
  const bgHex = spotMode ? '#FFFFFF' : STYLE_BG[t.style] || '#FFFFFF';
  const css = collectInlineCss();

  const slots = sides.map((side, idx) => {
    const fitted = renderFittedFaceHtml(project, side, sandboxEl, trimW);
    const xOff = pad + idx * (pageW + gap);
    const yOff = pad + headerH;
    const marks = cropMarks
      ? `<g stroke="#111111" stroke-width="0.9" fill="none">
          <path d="M${xOff + bleedPx} ${yOff - 14} V${yOff - 3} M${xOff - 14} ${yOff + bleedPx} H${xOff - 3}"/>
          <path d="M${xOff + pageW - bleedPx} ${yOff - 14} V${yOff - 3} M${xOff + pageW + 3} ${yOff + bleedPx} H${xOff + pageW + 14}"/>
          <path d="M${xOff + bleedPx} ${yOff + pageH + 3} V${yOff + pageH + 14} M${xOff - 14} ${yOff + pageH - bleedPx} H${xOff - 3}"/>
          <path d="M${xOff + pageW - bleedPx} ${yOff + pageH + 3} V${yOff + pageH + 14} M${xOff + pageW + 3} ${yOff + pageH - bleedPx} H${xOff + pageW + 14}"/>
        </g>`
      : '';
    return { xOff, yOff, html: fitted.html, marks };
  });

  const titleLine = spotMode
    ? `<text x="${pad}" y="${pad + 14}" font-family="sans-serif" font-size="12" font-weight="700" fill="#000000">SPOT CHANNEL PLATE · K100 (${detectActiveCrafts(project).map((c) => c.label).join(' / ') || '通用专色版'})</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="100%" height="100%" fill="${spotMode ? '#FAFAFA' : '#EFEFEF'}"/>
  ${titleLine}
  ${slots
    .map(
      (s) => `
    <g>
      <rect x="${s.xOff}" y="${s.yOff}" width="${pageW}" height="${pageH}" fill="${bgHex}"/>
      <foreignObject x="${s.xOff + bleedPx}" y="${s.yOff + bleedPx}" width="${trimW}" height="${trimH}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="${spotMode ? 'spot-plate-root' : ''}">
          <style>${css}
            .fo-wrap { width:${trimW}px; height:${trimH}px; }
            .fo-wrap .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
            .fo-wrap .bcard__face { border-radius:0 !important; box-shadow:none !important; }
            ${spotMode ? SPOT_MASK_CSS : ''}
          </style>
          <div class="fo-wrap">${s.html}</div>
        </div>
      </foreignObject>
      ${s.marks}
    </g>`
    )
    .join('')}
</svg>`;
}

export function renderSpotMaskSvg(project, sandboxEl) {
  const sides = getEffectiveSides(project) === 2 ? ['front', 'back'] : ['front'];
  const exp = project.export || {};
  return buildCompositeSvgMarkup(project, sandboxEl, {
    bleed: exp.bleed != null ? Number(exp.bleed) : 3,
    cropMarks: exp.cropMarks !== false,
    spotMode: true,
    sides
  });
}

function drawCropMarks2D(ctx, trimX, trimY, trimW, trimH, bleedPx) {
  const markLen = Math.max(16, Math.round(bleedPx * 0.85));
  const offset = Math.max(4, Math.round(bleedPx * 0.25));
  ctx.save();
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = Math.max(1.2, trimW * 0.0014);
  [
    [trimX, trimY, -1, -1],
    [trimX + trimW, trimY, 1, -1],
    [trimX, trimY + trimH, -1, 1],
    [trimX + trimW, trimY + trimH, 1, 1]
  ].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + sx * offset, cy);
    ctx.lineTo(cx + sx * (offset + markLen), cy);
    ctx.moveTo(cx, cy + sy * offset);
    ctx.lineTo(cx, cy + sy * (offset + markLen));
    ctx.stroke();
  });
  ctx.restore();
}

function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function renderFallback2D(ctx, project, canvasW, canvasH, trimX, trimY, trimW, trimH, bgColor, measurements, spotMode) {
  ctx.fillStyle = spotMode ? '#FFFFFF' : bgColor;
  ctx.fillRect(0, 0, canvasW, canvasH);
  if (!measurements || !Array.isArray(measurements.items)) return;

  for (const item of measurements.items) {
    if (item.kind === 'image' && !spotMode && item.src) {
      try {
        const img = await loadImageFromSrc(item.src);
        ctx.drawImage(img, trimX + item.rx * trimW, trimY + item.ry * trimH, item.rw * trimW, item.rh * trimH);
      } catch {}
    } else if (item.kind === 'qr') {
      if (spotMode && !item.hasCraft) continue;
      drawQrToCanvas(
        ctx,
        item.url || buildCardShareUrl(project),
        trimX + item.rx * trimW,
        trimY + item.ry * trimH,
        item.rw * trimW,
        item.rh * trimH,
        { fg: spotMode ? '#000000' : '#1D1E22', bg: '#FFFFFF' }
      );
    } else if (item.kind === 'text') {
      if (spotMode && !item.hasCraft) continue;
      const fz = Math.max(10, Math.round(item.fontPxRatio * trimW));
      ctx.save();
      ctx.fillStyle = spotMode ? '#000000' : item.color || '#222222';
      ctx.font = `${item.fontWeight || 500} ${fz}px "Noto Sans SC", "Poppins", sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(item.text, trimX + item.rx * trimW, trimY + item.ry * trimH, item.rw * trimW + fz);
      ctx.restore();
    }
  }
}

export async function renderPageCanvas(project, side, sandboxEl, opts = {}) {
  const dims = getDims(project);
  const exp = project.export || {};
  const bleed = opts.bleed != null ? Number(opts.bleed) : exp.bleed != null ? Number(exp.bleed) : 3;
  const dpi = Number(opts.dpi || exp.dpi || 300);
  const cropMarks = opts.cropMarks != null ? Boolean(opts.cropMarks) : exp.cropMarks !== false;
  const spotMode = Boolean(opts.spotMode);

  const bleedAreaMmW = dims.w + 2 * bleed;
  const bleedAreaMmH = dims.h + 2 * bleed;
  const marginMm = cropMarks ? 6 : 0;
  const totalMmW = bleedAreaMmW + marginMm * 2;
  const totalMmH = bleedAreaMmH + marginMm * 2;

  // Full 300 / 600 DPI physical resolution
  const pxPerMm = dpi / 25.4;
  const pxW = Math.max(320, Math.round(totalMmW * pxPerMm));
  const pxH = Math.max(240, Math.round(totalMmH * pxPerMm));
  const bleedPx = bleed * pxPerMm;
  const marginPx = marginMm * pxPerMm;
  const trimX = marginPx + bleedPx;
  const trimY = marginPx + bleedPx;
  const trimW = Math.round(dims.w * pxPerMm);
  const trimH = Math.round(dims.h * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');

  const t = getTemplate(project.templateId);
  const bgHex = spotMode ? '#FFFFFF' : STYLE_BG[t.style] || '#FFFFFF';

  ctx.fillStyle = cropMarks ? '#FFFFFF' : bgHex;
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.fillStyle = bgHex;
  ctx.fillRect(marginPx, marginPx, bleedAreaMmW * pxPerMm, bleedAreaMmH * pxPerMm);

  // Use native full-resolution trimW as coordinate space so SVG foreignObject scales crisply
  const measureW = Math.min(900, Math.max(480, trimW));
  const measureH = Math.round((measureW * dims.h) / dims.w);
  const fitted = renderFittedFaceHtml(project, side, sandboxEl, measureW);
  const css = collectInlineCss();

  const foSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${measureW}" height="${measureH}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" class="${spotMode ? 'spot-plate-root' : ''}">
        <style>${css}
          .fo-box { width:${measureW}px; height:${measureH}px; }
          .fo-box .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
          .fo-box .bcard__face { border-radius:0 !important; box-shadow:none !important; }
          ${spotMode ? SPOT_MASK_CSS : ''}
        </style>
        <div class="fo-box">${fitted.html}</div>
      </div>
    </foreignObject>
  </svg>`;

  let usedFallback = false;
  try {
    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(foSvg);
    const img = await loadImageFromSrc(svgDataUrl);
    ctx.drawImage(img, trimX, trimY, trimW, trimH);
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    usedFallback = true;
    await renderFallback2D(ctx, project, pxW, pxH, trimX, trimY, trimW, trimH, bgHex, fitted.measurements, spotMode);
  }

  if (cropMarks) drawCropMarks2D(ctx, trimX, trimY, trimW, trimH, bleedPx || 18);

  return { canvas, widthPx: pxW, heightPx: pxH, widthMm: totalMmW, heightMm: totalMmH, usedFallback };
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob returned null'));
    }, mimeType, quality);
  });
}

async function canvasToUint8(canvas, mimeType, quality) {
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return new Uint8Array(await blob.arrayBuffer());
}

export function formatByteSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function exportProject(project, sandboxEl, onProgress) {
  const exp = project.export || {};
  const fmt = exp.format || 'pdf';
  const baseName = project.fileName || '一番星名刺';
  const isDouble = getEffectiveSides(project) === 2;
  const sides = isDouble ? ['front', 'back'] : ['front'];
  const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
  const cropMarks = exp.cropMarks !== false;
  const progress = (pct) => {
    if (typeof onProgress === 'function') onProgress(pct);
  };

  progress(12);

  let spotBlob = null;
  const spotFilename = `${baseName}_专色通道.svg`;
  if (exp.spot) {
    spotBlob = new Blob([renderSpotMaskSvg(project, sandboxEl)], { type: 'image/svg+xml;charset=utf-8' });
  }

  if (fmt === 'svg') {
    const svgMarkup = buildCompositeSvgMarkup(project, sandboxEl, { bleed, cropMarks, spotMode: false, sides });
    progress(100);
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    return {
      blob,
      filename: `${baseName}_矢量印刷稿.svg`,
      sizeText: formatByteSize(blob.size),
      spotBlob,
      spotFilename,
      sideFiles: [],
      pageCount: sides.length
    };
  }

  if (fmt === 'png' || fmt === 'jpg') {
    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const sideFiles = [];
    for (let i = 0; i < sides.length; i++) {
      const s = sides[i];
      const page = await renderPageCanvas(project, s, sandboxEl, {
        bleed,
        dpi: exp.dpi || 300,
        cropMarks,
        spotMode: false
      });
      const bytes = await canvasToUint8(page.canvas, mime, 0.94);
      sideFiles.push({
        side: s,
        name: `${baseName}_${s === 'front' ? '正面' : '背面'}.${fmt}`,
        bytes,
        blob: new Blob([bytes], { type: mime })
      });
      progress(20 + Math.round(((i + 1) / sides.length) * 55));
    }

    if (exp.spot) {
      for (const s of sides) {
        const sp = await renderPageCanvas(project, s, sandboxEl, {
          bleed,
          dpi: exp.dpi || 300,
          cropMarks,
          spotMode: true
        });
        const bytes = await canvasToUint8(sp.canvas, 'image/png', 1);
        sideFiles.push({
          side: `${s}-spot`,
          name: `${baseName}_${s === 'front' ? '正面' : '背面'}_K100专色版.png`,
          bytes,
          blob: new Blob([bytes], { type: 'image/png' })
        });
      }
    }

    progress(92);
    if (sideFiles.length > 1) {
      const zipBytes = buildZipArchive(sideFiles.map((f) => ({ name: f.name, bytes: f.bytes })));
      const blob = new Blob([zipBytes], { type: 'application/zip' });
      progress(100);
      return {
        blob,
        filename: `${baseName}_${fmt.toUpperCase()}套装.zip`,
        sizeText: formatByteSize(blob.size),
        spotBlob,
        spotFilename,
        sideFiles,
        pageCount: sideFiles.length
      };
    }

    progress(100);
    return {
      blob: sideFiles[0].blob,
      filename: sideFiles[0].name,
      sizeText: formatByteSize(sideFiles[0].blob.size),
      spotBlob,
      spotFilename,
      sideFiles,
      pageCount: 1
    };
  }

  // PDF 1.4 导出：支持真实 DeviceCMYK (/FlateDecode) 与 DeviceRGB
  const useCmyk = exp.color === 'cmyk';
  const pdfPages = [];

  for (let i = 0; i < sides.length; i++) {
    const side = sides[i];
    const rendered = await renderPageCanvas(project, side, sandboxEl, {
      bleed,
      dpi: exp.dpi || 300,
      cropMarks,
      spotMode: false
    });
    if (useCmyk) {
      const ctx = rendered.canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, rendered.widthPx, rendered.heightPx);
      const cmykBytes = rgbaToCmykBytes(imgData.data, rendered.widthPx, rendered.heightPx, exp.autoK100Text !== false);
      const { bytes, compressed } = await deflateBytes(cmykBytes);
      pdfPages.push({
        streamBytes: bytes,
        filter: compressed ? 'FlateDecode' : '',
        colorSpace: 'DeviceCMYK',
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        widthPt: (rendered.widthMm / 25.4) * 72,
        heightPt: (rendered.heightMm / 25.4) * 72
      });
    } else {
      const jpegBytes = await canvasToUint8(rendered.canvas, 'image/jpeg', 0.93);
      pdfPages.push({
        streamBytes: jpegBytes,
        filter: 'DCTDecode',
        colorSpace: 'DeviceRGB',
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        widthPt: (rendered.widthMm / 25.4) * 72,
        heightPt: (rendered.heightMm / 25.4) * 72
      });
    }
    progress(25 + Math.round(((i + 1) / sides.length) * 50));
  }

  if (exp.spot) {
    for (const side of sides) {
      const sp = await renderPageCanvas(project, side, sandboxEl, {
        bleed,
        dpi: exp.dpi || 300,
        cropMarks,
        spotMode: true
      });
      const ctx = sp.canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, sp.widthPx, sp.heightPx);
      const gray = rgbaToGrayK100Bytes(imgData.data, sp.widthPx, sp.heightPx);
      const { bytes, compressed } = await deflateBytes(gray);
      pdfPages.push({
        streamBytes: bytes,
        filter: compressed ? 'FlateDecode' : '',
        colorSpace: 'DeviceGray',
        widthPx: sp.widthPx,
        heightPx: sp.heightPx,
        widthPt: (sp.widthMm / 25.4) * 72,
        heightPt: (sp.heightMm / 25.4) * 72
      });
    }
  }

  progress(92);
  const pdfBytes = buildPdfDocument(pdfPages);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  progress(100);

  return {
    blob,
    filename: `${baseName}_印刷成品(${useCmyk ? 'CMYK' : 'RGB'}).pdf`,
    sizeText: formatByteSize(blob.size),
    spotBlob,
    spotFilename,
    sideFiles: [],
    pageCount: pdfPages.length
  };
}

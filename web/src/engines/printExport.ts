import { SURFACE_CRAFTS } from '../data/templates';
import { getCardDims } from '../stores/useStudioStore';
import type { CardProject, CardTemplate, SurfaceCraftId } from '../types/card';
import type { ExportOptions } from './preflight';
import { drawQrToCanvas } from './qrcode';
import { renderCardFaceHtml, resolveCardBgHex } from './renderCardHtml';
import { buildCardShareUrl } from './shareCodec';

export function detectActiveCrafts(project: CardProject): { id: SurfaceCraftId; label: string }[] {
  const found = new Set<SurfaceCraftId>();
  if (project.craft && project.craft !== 'none') found.add(project.craft);
  if (project.regionCrafts) {
    Object.values(project.regionCrafts).forEach((c) => {
      if (c && c !== 'none') found.add(c);
    });
  }
  if (project.standee?.enabled && project.standee.craft && project.standee.craft !== 'none') {
    found.add(project.standee.craft);
  }
  (project.customElements || []).forEach((el) => {
    if (el.craft && el.craft !== 'none') found.add(el.craft);
  });
  return Array.from(found).map((id) => ({ id, label: SURFACE_CRAFTS[id]?.name || id }));
}

function asciiBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

async function deflateBytes(u8: Uint8Array): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    const copy = new Uint8Array(u8.byteLength);
    copy.set(u8);
    void writer.write(copy);
    void writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return { bytes: new Uint8Array(buf), compressed: true };
  }
  return { bytes: u8, compressed: false };
}

export function rgbaToCmykBytes(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  autoK100Text = true,
): Uint8Array {
  const count = width * height;
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const p4 = i * 4;
    const a = rgba[p4 + 3] / 255;
    const rn = (rgba[p4] * a + 255 * (1 - a)) / 255;
    const gn = (rgba[p4 + 1] * a + 255 * (1 - a)) / 255;
    const bn = (rgba[p4 + 2] * a + 255 * (1 - a)) / 255;
    const maxC = Math.max(rn, gn, bn);
    const minC = Math.min(rn, gn, bn);

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

export function rgbaToGrayK100Bytes(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const count = width * height;
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const p4 = i * 4;
    const lum = 0.299 * rgba[p4] + 0.587 * rgba[p4 + 1] + 0.114 * rgba[p4 + 2];
    const a = rgba[p4 + 3] / 255;
    out[i] = Math.min(255, Math.max(0, Math.round(lum * a + 255 * (1 - a))));
  }
  return out;
}

export interface PdfPageInput {
  streamBytes: Uint8Array;
  filter: string;
  colorSpace: 'DeviceCMYK' | 'DeviceRGB' | 'DeviceGray';
  widthPx: number;
  heightPx: number;
  widthPt: number;
  heightPt: number;
}

export function buildPdfDocument(pages: PdfPageInput[]): Uint8Array {
  if (!pages.length) throw new Error('buildPdfDocument requires at least one page');
  const chunks: Uint8Array[] = [];
  let byteOffset = 0;
  const pushBytes = (u8: Uint8Array) => {
    chunks.push(u8);
    byteOffset += u8.length;
  };
  const pushAscii = (str: string) => pushBytes(asciiBytes(str));

  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const objOffsets = new Map<number, number>();
  const kidRefs = pages.map((_, idx) => `${3 + idx * 3} 0 R`).join(' ');

  objOffsets.set(1, byteOffset);
  pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  objOffsets.set(2, byteOffset);
  pushAscii(`2 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((p, idx) => {
    const pageId = 3 + idx * 3;
    const imgId = 4 + idx * 3;
    const contentId = 5 + idx * 3;
    const wPt = Number(p.widthPt || 255.12).toFixed(2);
    const hPt = Number(p.heightPt || 153.07).toFixed(2);
    const streamData = p.streamBytes;
    const filterDecl = p.filter ? `/Filter /${p.filter} ` : '';
    const cmd = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im${idx} Do\nQ\n`;

    objOffsets.set(pageId, byteOffset);
    pushAscii(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im${idx} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );

    objOffsets.set(imgId, byteOffset);
    pushAscii(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /${p.colorSpace} /BitsPerComponent 8 ${filterDecl}/Length ${streamData.length} >>\nstream\n`,
    );
    pushBytes(streamData);
    pushAscii('\nendstream\nendobj\n');

    objOffsets.set(contentId, byteOffset);
    pushAscii(`${contentId} 0 obj\n<< /Length ${cmd.length} >>\nstream\n${cmd}endstream\nendobj\n`);
  });

  const totalObjs = 2 + pages.length * 3;
  const xrefOffset = byteOffset;
  pushAscii(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    pushAscii(`${String(objOffsets.get(id)).padStart(10, '0')} 00000 n \n`);
  }
  pushAscii(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return concatChunks(chunks);
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZipArchive(entries: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = enc.encode(entry.name);
    const data = entry.bytes;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(local.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true);
    lView.setUint16(6, 0x0800, true);
    lView.setUint16(8, 0, true);
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

function collectInlineCss(): string {
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
    } catch {
      // Cross-origin stylesheet skipped
    }
  }
  return css.replace(/<\/style>/gi, '');
}

const SPOT_MASK_CSS = `
  .spot-plate-root { background: #FFFFFF !important; }
  .spot-plate-root .bcard__face { background: #FFFFFF !important; background-image: none !important; box-shadow: none !important; }
  .spot-plate-root .bcard__ribbon,
  .spot-plate-root .bcard__deco-frame,
  .spot-plate-root .bcard__pattern,
  .spot-plate-root .bcard__qr { opacity: 0 !important; visibility: hidden !important; }
  .spot-plate-root .bcard__content *,
  .spot-plate-root .bcard__back-inner *,
  .spot-plate-root .el-layer .bcard-el { visibility: hidden !important; }
  .spot-plate-root .craft-gold, .spot-plate-root .craft-silver, .spot-plate-root .craft-copper,
  .spot-plate-root .craft-uv, .spot-plate-root .craft-emboss, .spot-plate-root .craft-deboss,
  .spot-plate-root .craft-velvet, .spot-plate-root .craft-brushed,
  .spot-plate-root .craft-gold *, .spot-plate-root .craft-silver *, .spot-plate-root .craft-copper *,
  .spot-plate-root .craft-uv *, .spot-plate-root .craft-emboss *, .spot-plate-root .craft-deboss *,
  .spot-plate-root .craft-velvet *, .spot-plate-root .craft-brushed * {
    visibility: visible !important; opacity: 1 !important;
    color: #000000 !important; -webkit-text-fill-color: #000000 !important;
    background: none !important; background-color: transparent !important;
    border-color: #000000 !important; text-shadow: none !important; filter: none !important;
  }
  .spot-plate-root .bcard__qr[class*="craft-"] { background: #FFFFFF !important; }
`;

interface MeasuredItem {
  kind: 'text' | 'image' | 'qr';
  text?: string;
  src?: string;
  url?: string;
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  fontPxRatio?: number;
  fontWeight?: string;
  color?: string;
  hasCraft?: boolean;
}

function measureLayout(
  project: CardProject,
  template: CardTemplate,
  side: 'front' | 'back',
  sandboxEl: HTMLElement | null,
  widthPx: number,
): { html: string; items: MeasuredItem[] } {
  const html = renderCardFaceHtml(project, template, side);
  if (typeof document === 'undefined' || !sandboxEl) {
    return { html, items: [] };
  }
  const w = Math.max(240, Math.round(widthPx));
  sandboxEl.innerHTML = `<div class="pe-measure-slot" style="width:${w}px;">${html}</div>`;
  const face = sandboxEl.querySelector('.bcard__face');
  const faceRect = face?.getBoundingClientRect();
  const items: MeasuredItem[] = [];

  if (face && faceRect && faceRect.width > 0 && faceRect.height > 0) {
    const sel =
      '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__code, .bcard__event, .bcard__sns-item, .bcard__motto, .bcard__back-title, .bcard__back-name, .bcard__back-url, .bcard-el--text';
    face.querySelectorAll(sel).forEach((node) => {
      const r = node.getBoundingClientRect();
      const cs = window.getComputedStyle(node);
      if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') return;
      const text = (node.textContent || '').trim();
      if (!text) return;
      items.push({
        kind: 'text',
        text,
        rx: (r.left - faceRect.left) / faceRect.width,
        ry: (r.top - faceRect.top) / faceRect.height,
        rw: r.width / faceRect.width,
        rh: r.height / faceRect.height,
        fontPxRatio: (parseFloat(cs.fontSize) || 12) / faceRect.width,
        fontWeight: cs.fontWeight || '500',
        color: cs.color || '#0F172A',
        hasCraft: /craft-/.test(node.className),
      });
    });

    face.querySelectorAll('.bcard-el--image img, .bcard__standee-img').forEach((imgEl) => {
      const img = imgEl as HTMLImageElement;
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      items.push({
        kind: 'image',
        src: img.src,
        rx: (r.left - faceRect.left) / faceRect.width,
        ry: (r.top - faceRect.top) / faceRect.height,
        rw: r.width / faceRect.width,
        rh: r.height / faceRect.height,
      });
    });

    face.querySelectorAll('.bcard__qr').forEach((qrEl) => {
      const qr = qrEl as HTMLElement;
      const r = qr.getBoundingClientRect();
      if (!r.width || !r.height) return;
      items.push({
        kind: 'qr',
        url: qr.dataset.qrUrl || buildCardShareUrl(project),
        hasCraft: /craft-/.test(qr.className),
        rx: (r.left - faceRect.left) / faceRect.width,
        ry: (r.top - faceRect.top) / faceRect.height,
        rw: r.width / faceRect.width,
        rh: r.height / faceRect.height,
      });
    });
  }

  let serialized = html;
  const slot = sandboxEl.querySelector('.pe-measure-slot');
  if (slot && typeof XMLSerializer !== 'undefined') {
    const s = new XMLSerializer();
    serialized = Array.from(slot.childNodes).map((c) => s.serializeToString(c)).join('');
  }
  sandboxEl.innerHTML = '';
  return { html: serialized, items };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawCropMarks(
  ctx: CanvasRenderingContext2D,
  trimX: number,
  trimY: number,
  trimW: number,
  trimH: number,
  bleedPx: number,
) {
  const markLen = Math.max(16, Math.round(bleedPx * 0.85));
  const offset = Math.max(4, Math.round(bleedPx * 0.25));
  ctx.save();
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = Math.max(1.2, trimW * 0.0014);
  [
    [trimX, trimY, -1, -1],
    [trimX + trimW, trimY, 1, -1],
    [trimX, trimY + trimH, -1, 1],
    [trimX + trimW, trimY + trimH, 1, 1],
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

async function renderFallback2D(
  ctx: CanvasRenderingContext2D,
  project: CardProject,
  trimX: number,
  trimY: number,
  trimW: number,
  trimH: number,
  bgHex: string,
  items: MeasuredItem[],
  spotMode: boolean,
) {
  ctx.fillStyle = spotMode ? '#FFFFFF' : bgHex;
  ctx.fillRect(trimX, trimY, trimW, trimH);
  for (const item of items) {
    if (item.kind === 'image' && !spotMode && item.src) {
      try {
        const img = await loadImg(item.src);
        ctx.drawImage(img, trimX + item.rx * trimW, trimY + item.ry * trimH, item.rw * trimW, item.rh * trimH);
      } catch {
        // ignore broken image
      }
    } else if (item.kind === 'qr') {
      if (spotMode && !item.hasCraft) continue;
      drawQrToCanvas(
        ctx,
        item.url || buildCardShareUrl(project),
        trimX + item.rx * trimW,
        trimY + item.ry * trimH,
        item.rw * trimW,
        item.rh * trimH,
        { fg: spotMode ? '#000000' : '#0F172A', bg: '#FFFFFF' },
      );
    } else if (item.kind === 'text' && item.text) {
      if (spotMode && !item.hasCraft) continue;
      const fz = Math.max(10, Math.round((item.fontPxRatio || 0.04) * trimW));
      ctx.save();
      ctx.fillStyle = spotMode ? '#000000' : item.color || '#0F172A';
      ctx.font = `${item.fontWeight || 500} ${fz}px "Noto Sans SC", "Inter", sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(item.text, trimX + item.rx * trimW, trimY + item.ry * trimH, item.rw * trimW + fz);
      ctx.restore();
    }
  }
}

export async function renderPageCanvas(
  project: CardProject,
  template: CardTemplate,
  side: 'front' | 'back',
  sandboxEl: HTMLElement | null,
  exp: ExportOptions,
  spotMode = false,
): Promise<{ canvas: HTMLCanvasElement; widthPx: number; heightPx: number; widthMm: number; heightMm: number }> {
  const dims = getCardDims(project);
  const bleedAreaMmW = dims.w + 2 * exp.bleed;
  const bleedAreaMmH = dims.h + 2 * exp.bleed;
  const marginMm = exp.cropMarks ? 6 : 0;
  const totalMmW = bleedAreaMmW + marginMm * 2;
  const totalMmH = bleedAreaMmH + marginMm * 2;

  const pxPerMm = exp.dpi / 25.4;
  const pxW = Math.max(320, Math.round(totalMmW * pxPerMm));
  const pxH = Math.max(240, Math.round(totalMmH * pxPerMm));
  const bleedPx = exp.bleed * pxPerMm;
  const marginPx = marginMm * pxPerMm;
  const trimX = marginPx + bleedPx;
  const trimY = marginPx + bleedPx;
  const trimW = Math.round(dims.w * pxPerMm);
  const trimH = Math.round(dims.h * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d')!;

  const bgHex = spotMode ? '#FFFFFF' : resolveCardBgHex(project, side);
  ctx.fillStyle = exp.cropMarks ? '#FFFFFF' : bgHex;
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.fillStyle = bgHex;
  ctx.fillRect(marginPx, marginPx, bleedAreaMmW * pxPerMm, bleedAreaMmH * pxPerMm);

  const measureW = Math.min(900, Math.max(480, trimW));
  const measureH = Math.round((measureW * dims.h) / dims.w);
  const measured = measureLayout(project, template, side, sandboxEl, measureW);
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
        <div class="fo-box">${measured.html}</div>
      </div>
    </foreignObject>
  </svg>`;

  try {
    const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(foSvg));
    ctx.drawImage(img, trimX, trimY, trimW, trimH);
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    await renderFallback2D(ctx, project, trimX, trimY, trimW, trimH, bgHex, measured.items, spotMode);
  }

  if (exp.cropMarks) drawCropMarks(ctx, trimX, trimY, trimW, trimH, bleedPx || 18);

  return { canvas, widthPx: pxW, heightPx: pxH, widthMm: totalMmW, heightMm: totalMmH };
}

function canvasToUint8(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) reject(new Error('Canvas 导出失败'));
      else resolve(new Uint8Array(await blob.arrayBuffer()));
    }, mime, quality);
  });
}

export function buildCompositeSvgMarkup(
  project: CardProject,
  template: CardTemplate,
  sandboxEl: HTMLElement | null,
  exp: ExportOptions,
  spotMode = false,
): string {
  const dims = getCardDims(project);
  const sides: ('front' | 'back')[] = exp.doubleSided ? ['front', 'back'] : ['front'];
  const scale = 6;
  const trimW = dims.w * scale;
  const trimH = dims.h * scale;
  const bleedPx = exp.bleed * scale;
  const pageW = trimW + bleedPx * 2;
  const pageH = trimH + bleedPx * 2;
  const gap = 28;
  const pad = exp.cropMarks ? 36 : 24;
  const headerH = spotMode ? 30 : 0;
  const svgW = pageW * sides.length + gap * (sides.length - 1) + pad * 2;
  const svgH = pageH + pad * 2 + headerH;
  const css = collectInlineCss();

  const slots = sides.map((side, idx) => {
    const bgHex = spotMode ? '#FFFFFF' : resolveCardBgHex(project, side);
    const measured = measureLayout(project, template, side, sandboxEl, trimW);
    const xOff = pad + idx * (pageW + gap);
    const yOff = pad + headerH;
    const marks = exp.cropMarks
      ? `<g stroke="#111111" stroke-width="0.9" fill="none">
          <path d="M${xOff + bleedPx} ${yOff - 14} V${yOff - 3} M${xOff - 14} ${yOff + bleedPx} H${xOff - 3}"/>
          <path d="M${xOff + pageW - bleedPx} ${yOff - 14} V${yOff - 3} M${xOff + pageW + 3} ${yOff + bleedPx} H${xOff + pageW + 14}"/>
          <path d="M${xOff + bleedPx} ${yOff + pageH + 3} V${yOff + pageH + 14} M${xOff - 14} ${yOff + pageH - bleedPx} H${xOff - 3}"/>
          <path d="M${xOff + pageW - bleedPx} ${yOff + pageH + 3} V${yOff + pageH + 14} M${xOff + pageW + 3} ${yOff + pageH - bleedPx} H${xOff + pageW + 14}"/>
        </g>`
      : '';
    return `<g>
      <rect x="${xOff}" y="${yOff}" width="${pageW}" height="${pageH}" fill="${bgHex}"/>
      <foreignObject x="${xOff + bleedPx}" y="${yOff + bleedPx}" width="${trimW}" height="${trimH}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="${spotMode ? 'spot-plate-root' : ''}">
          <style>${css}
            .fo-wrap { width:${trimW}px; height:${trimH}px; }
            .fo-wrap .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
            .fo-wrap .bcard__face { border-radius:0 !important; box-shadow:none !important; }
            ${spotMode ? SPOT_MASK_CSS : ''}
          </style>
          <div class="fo-wrap">${measured.html}</div>
        </div>
      </foreignObject>
      ${marks}
    </g>`;
  });

  const titleLine = spotMode
    ? `<text x="${pad}" y="${pad + 14}" font-family="sans-serif" font-size="12" font-weight="700" fill="#000000">SPOT PLATE · K100 (${detectActiveCrafts(project).map((c) => c.label).join(' / ') || '通用专色'})</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="100%" height="100%" fill="${spotMode ? '#FAFAFA' : '#EFEFEF'}"/>
  ${titleLine}
  ${slots.join('')}
</svg>`;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  sizeText: string;
  spotBlob: Blob | null;
  spotFilename: string;
  pageCount: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function runExportJob(
  project: CardProject,
  template: CardTemplate,
  exp: ExportOptions,
  sandboxEl: HTMLElement | null,
  onProgress?: (pct: number) => void,
): Promise<ExportResult> {
  const sides: ('front' | 'back')[] = exp.doubleSided ? ['front', 'back'] : ['front'];
  const safeBase = (project.fields.name || project.title || '一番星名刺').replace(/[\\/:*?"<>|]/g, '_');
  onProgress?.(10);

  let spotBlob: Blob | null = null;
  const spotFilename = `${safeBase}_专色版.svg`;
  if (exp.spot) {
    spotBlob = new Blob([buildCompositeSvgMarkup(project, template, sandboxEl, exp, true)], {
      type: 'image/svg+xml;charset=utf-8',
    });
  }

  if (exp.format === 'svg') {
    const markup = buildCompositeSvgMarkup(project, template, sandboxEl, exp, false);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    onProgress?.(100);
    return { blob, filename: `${safeBase}_矢量印刷稿.svg`, sizeText: fmtSize(blob.size), spotBlob, spotFilename, pageCount: sides.length };
  }

  if (exp.format === 'png' || exp.format === 'jpg') {
    const mime = exp.format === 'png' ? 'image/png' : 'image/jpeg';
    const files: { name: string; bytes: Uint8Array }[] = [];
    for (let i = 0; i < sides.length; i++) {
      const s = sides[i];
      const page = await renderPageCanvas(project, template, s, sandboxEl, exp, false);
      files.push({
        name: `${safeBase}_${s === 'front' ? '正面' : '背面'}.${exp.format}`,
        bytes: await canvasToUint8(page.canvas, mime, 0.94),
      });
      onProgress?.(25 + Math.round(((i + 1) / sides.length) * 50));
    }
    if (exp.spot) {
      for (const s of sides) {
        const sp = await renderPageCanvas(project, template, s, sandboxEl, exp, true);
        files.push({
          name: `${safeBase}_${s === 'front' ? '正面' : '背面'}_K100专色版.png`,
          bytes: await canvasToUint8(sp.canvas, 'image/png', 1),
        });
      }
    }
    onProgress?.(95);
    if (files.length > 1) {
      const zipBuf = buildZipArchive(files);
      const copy = new Uint8Array(zipBuf.byteLength);
      copy.set(zipBuf);
      const blob = new Blob([copy], { type: 'application/zip' });
      onProgress?.(100);
      return { blob, filename: `${safeBase}_${exp.format.toUpperCase()}套装.zip`, sizeText: fmtSize(blob.size), spotBlob, spotFilename, pageCount: files.length };
    }
    const singleCopy = new Uint8Array(files[0].bytes.byteLength);
    singleCopy.set(files[0].bytes);
    const blob = new Blob([singleCopy], { type: mime });
    onProgress?.(100);
    return { blob, filename: files[0].name, sizeText: fmtSize(blob.size), spotBlob, spotFilename, pageCount: 1 };
  }

  // PDF 1.4
  const useCmyk = exp.color === 'cmyk';
  const pdfPages: PdfPageInput[] = [];
  for (let i = 0; i < sides.length; i++) {
    const rendered = await renderPageCanvas(project, template, sides[i], sandboxEl, exp, false);
    if (useCmyk) {
      const ctx = rendered.canvas.getContext('2d')!;
      const imgData = ctx.getImageData(0, 0, rendered.widthPx, rendered.heightPx);
      const cmyk = rgbaToCmykBytes(imgData.data, rendered.widthPx, rendered.heightPx, exp.autoK100Text);
      const { bytes, compressed } = await deflateBytes(cmyk);
      pdfPages.push({
        streamBytes: bytes,
        filter: compressed ? 'FlateDecode' : '',
        colorSpace: 'DeviceCMYK',
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        widthPt: (rendered.widthMm / 25.4) * 72,
        heightPt: (rendered.heightMm / 25.4) * 72,
      });
    } else {
      const jpg = await canvasToUint8(rendered.canvas, 'image/jpeg', 0.93);
      pdfPages.push({
        streamBytes: jpg,
        filter: 'DCTDecode',
        colorSpace: 'DeviceRGB',
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        widthPt: (rendered.widthMm / 25.4) * 72,
        heightPt: (rendered.heightMm / 25.4) * 72,
      });
    }
    onProgress?.(25 + Math.round(((i + 1) / sides.length) * 55));
  }

  if (exp.spot) {
    for (const s of sides) {
      const sp = await renderPageCanvas(project, template, s, sandboxEl, exp, true);
      const ctx = sp.canvas.getContext('2d')!;
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
        heightPt: (sp.heightMm / 25.4) * 72,
      });
    }
  }

  const pdfBytes = buildPdfDocument(pdfPages);
  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  onProgress?.(100);
  return {
    blob,
    filename: `${safeBase}_印刷成品(${useCmyk ? 'CMYK' : 'RGB'}).pdf`,
    sizeText: fmtSize(blob.size),
    spotBlob,
    spotFilename,
    pageCount: pdfPages.length,
  };
}

/* ==========================================================
   真实印刷/分享文件导出与工艺专色通道生成引擎 (window.IchibanPrintExport)
   支持 Node CommonJS 引用以验证 PDF 1.4 封装与工艺识别逻辑
   ========================================================== */

(function (root) {
  const CRAFT_LABELS = {
    gold: '缎面烫金',
    silver: '哑光烫银',
    copper: '赤铜烫印',
    emboss: '击凸浮雕',
    deboss: '活字压凹',
    uv: '立体厚墨',
    velvet: '丝绒触感',
    brushed: '拉丝金属'
  };

  function detectActiveCrafts(project) {
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
      } catch (err) {
        // 跨域样式表（如 Google Fonts）自动跳过
      }
    }
    if (!css) {
      css = ':root{--orange-500:#FF7600;--amber-500:#F39800;--ink:#333333;}';
    }
    return css.replace(/<\/style>/gi, '');
  }

  function renderFittedFaceHtml(project, side, sandboxEl, widthPx) {
    const renderer = root.IchibanProject;
    const cardMod = root.IchibanCard;
    if (!renderer || typeof document === 'undefined' || !sandboxEl) {
      return { html: renderer ? renderer.renderFace(project, side) : '', measurements: null };
    }

    const w = Math.max(240, Math.round(widthPx || 540));
    sandboxEl.innerHTML = `<div class="pe-measure-slot" style="width:${w}px;">${renderer.renderFace(project, side)}</div>`;
    const isCanvasSide = project.canvas && Array.isArray(project.canvas[side]);
    if (!isCanvasSide && cardMod && typeof cardMod.fitText === 'function') {
      cardMod.fitText(sandboxEl);
    }

    const slot = sandboxEl.querySelector('.pe-measure-slot');
    const face = sandboxEl.querySelector('.bcard__face');
    const measurements = measureFallbackLayout(sandboxEl, face);
    let html = '';
    if (slot) {
      if (typeof XMLSerializer !== 'undefined') {
        const s = new XMLSerializer();
        for (const child of Array.from(slot.childNodes)) {
          html += s.serializeToString(child);
        }
      } else {
        html = slot.innerHTML;
      }
    }
    sandboxEl.innerHTML = '';
    return { html, measurements };
  }

  function measureFallbackLayout(container, face) {
    if (!container || !face) return null;
    const faceRect = face.getBoundingClientRect();
    if (!faceRect.width || !faceRect.height) return null;

    const faceCs = window.getComputedStyle(face);
    const items = [];
    const textSelector =
      '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en, .bcard-el--text';

    face.querySelectorAll(textSelector).forEach((node) => {
      const r = node.getBoundingClientRect();
      const cs = window.getComputedStyle(node);
      if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') return;
      const text = (node.textContent || '').trim();
      if (!text) return;
      const hasCraft =
        node.classList.contains('craft-gold') ||
        node.classList.contains('craft-silver') ||
        node.classList.contains('craft-uv') ||
        node.classList.contains('craft-emboss');
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
        align: cs.textAlign || 'left',
        vertical: cs.writingMode && cs.writingMode.includes('vertical'),
        hasCraft
      });
    });

    face.querySelectorAll('.bcard-el--image img').forEach((img) => {
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
        rx: (r.left - faceRect.left) / faceRect.width,
        ry: (r.top - faceRect.top) / faceRect.height,
        rw: r.width / faceRect.width,
        rh: r.height / faceRect.height
      });
    });

    return {
      bg: faceCs.backgroundColor || '#FFFFFF',
      items
    };
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
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      background: none !important;
      background-color: transparent !important;
      border-color: #000000 !important;
      text-shadow: none !important;
      filter: none !important;
      animation: none !important;
    }
    .spot-plate-root .bcard-el--icon.craft-gold svg,
    .spot-plate-root .bcard-el--icon.craft-silver svg,
    .spot-plate-root .bcard-el--icon.craft-copper svg,
    .spot-plate-root .bcard-el--icon.craft-uv svg,
    .spot-plate-root .bcard-el--icon.craft-emboss svg,
    .spot-plate-root .bcard-el--icon.craft-deboss svg,
    .spot-plate-root .bcard-el--icon.craft-velvet svg,
    .spot-plate-root .bcard-el--icon.craft-brushed svg {
      stroke: #000000 !important;
      color: #000000 !important;
    }
  `;

  function buildCompositeSvgMarkup(project, sandboxEl, opts = {}) {
    const store = root.IchibanStore;
    const renderer = root.IchibanProject;
    const dims = store.getDims(project);
    const bleed = opts.bleed != null ? Number(opts.bleed) : 3;
    const cropMarks = Boolean(opts.cropMarks);
    const spotMode = Boolean(opts.spotMode);
    const sides = Array.isArray(opts.sides) ? opts.sides : ['front', 'back'];

    const scale = 5;
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

    const t = store.getTemplate(project.templateId);
    const bgHex = spotMode ? '#FFFFFF' : (renderer && renderer.STYLE_BG[t.style]) || '#FFFFFF';
    const css = collectInlineCss();

    const slotsHtml = sides
      .map((side, idx) => {
        const fitted = renderFittedFaceHtml(project, side, sandboxEl, trimW);
        const xOff = pad + idx * (pageW + gap);
        const yOff = pad + headerH;
        const marks = cropMarks
          ? `
          <g stroke="#222222" stroke-width="0.9" fill="none">
            <path d="M${xOff + bleedPx} ${yOff - 14} V${yOff - 3} M${xOff - 14} ${yOff + bleedPx} H${xOff - 3}"/>
            <path d="M${xOff + pageW - bleedPx} ${yOff - 14} V${yOff - 3} M${xOff + pageW + 3} ${yOff + bleedPx} H${xOff + pageW + 14}"/>
            <path d="M${xOff + bleedPx} ${yOff + pageH + 3} V${yOff + pageH + 14} M${xOff - 14} ${yOff + pageH - bleedPx} H${xOff - 3}"/>
            <path d="M${xOff + pageW - bleedPx} ${yOff + pageH + 3} V${yOff + pageH + 14} M${xOff + pageW + 3} ${yOff + pageH - bleedPx} H${xOff + pageW + 14}"/>
          </g>`
          : '';
        return { xOff, yOff, html: fitted.html, marks };
      });

    const titleLine = spotMode
      ? `<text x="${pad}" y="${pad + 14}" font-family="sans-serif" font-size="12" font-weight="700" fill="#000000">SPOT CHANNEL PLATE · K100 (${detectActiveCrafts(project).map((c) => c.label).join(' / ') || '未启用工艺'})</text>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="100%" height="100%" fill="${spotMode ? '#FAFAFA' : '#EFEFEF'}"/>
  ${titleLine}
  ${slotsHtml
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

  function renderSpotMaskSvg(project, sandboxEl) {
    const t = root.IchibanStore.getTemplate(project.templateId);
    const sides = t && t.sides === 2 ? ['front', 'back'] : ['front'];
    const exp = project.export || {};
    return buildCompositeSvgMarkup(project, sandboxEl, {
      bleed: exp.bleed != null ? Number(exp.bleed) : 3,
      cropMarks: exp.cropMarks !== false,
      spotMode: true,
      sides
    });
  }

  function drawCropMarks2D(ctx, trimX, trimY, trimW, trimH, bleedPx) {
    const markLen = Math.max(14, Math.round(bleedPx * 0.85));
    const offset = Math.max(4, Math.round(bleedPx * 0.25));
    ctx.save();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = Math.max(1, trimW * 0.0014);

    const corners = [
      [trimX, trimY, -1, -1],
      [trimX + trimW, trimY, 1, -1],
      [trimX, trimY + trimH, -1, 1],
      [trimX + trimW, trimY + trimH, 1, 1]
    ];
    corners.forEach(([cx, cy, sx, sy]) => {
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

  async function renderFallback2D(ctx, canvasW, canvasH, trimX, trimY, trimW, trimH, bgColor, measurements, spotMode) {
    ctx.fillStyle = spotMode ? '#FFFFFF' : bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (!measurements || !Array.isArray(measurements.items)) return;

    for (const item of measurements.items) {
      if (item.kind === 'image' && !spotMode && item.src) {
        try {
          const img = await loadImageFromSrc(item.src);
          ctx.drawImage(
            img,
            trimX + item.rx * trimW,
            trimY + item.ry * trimH,
            item.rw * trimW,
            item.rh * trimH
          );
        } catch (e) {}
      } else if (item.kind === 'qr' && !spotMode) {
        const qx = trimX + item.rx * trimW;
        const qy = trimY + item.ry * trimH;
        const qw = item.rw * trimW;
        const qh = item.rh * trimH;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(qx, qy, qw, qh);
        ctx.fillStyle = '#333333';
        const cw = qw / 3;
        const ch = qh / 3;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if ((r + c) % 2 === 0 || (r === 1 && c === 1)) {
              ctx.fillRect(qx + c * cw + cw * 0.14, qy + r * ch + ch * 0.14, cw * 0.72, ch * 0.72);
            }
          }
        }
      } else if (item.kind === 'text') {
        if (spotMode && !item.hasCraft) continue;
        const fz = Math.max(10, Math.round(item.fontPxRatio * trimW));
        ctx.save();
        ctx.fillStyle = spotMode ? '#000000' : item.color || '#333333';
        ctx.font = `${item.fontWeight || 500} ${fz}px "Noto Sans SC", "Poppins", sans-serif`;
        ctx.textBaseline = 'top';
        const tx = trimX + item.rx * trimW;
        const ty = trimY + item.ry * trimH;
        ctx.fillText(item.text, tx, ty, item.rw * trimW + fz);
        ctx.restore();
      }
    }
  }

  async function renderPageCanvas(project, side, sandboxEl, opts = {}) {
    const store = root.IchibanStore;
    const renderer = root.IchibanProject;
    const dims = store.getDims(project);
    const exp = project.export || {};
    const bleed = opts.bleed != null ? Number(opts.bleed) : (exp.bleed != null ? Number(exp.bleed) : 3);
    const dpi = Number(opts.dpi || exp.dpi || 300);
    const cropMarks = opts.cropMarks != null ? Boolean(opts.cropMarks) : exp.cropMarks !== false;
    const spotMode = Boolean(opts.spotMode);

    const bleedAreaMmW = dims.w + 2 * bleed;
    const bleedAreaMmH = dims.h + 2 * bleed;
    const marginMm = cropMarks ? 6 : 0;
    const totalMmW = bleedAreaMmW + marginMm * 2;
    const totalMmH = bleedAreaMmH + marginMm * 2;

    const rawPxPerMm = dpi / 25.4;
    const cappedPxPerMm = Math.min(rawPxPerMm, 3000 / Math.max(totalMmW, totalMmH));
    const pxW = Math.max(320, Math.round(totalMmW * cappedPxPerMm));
    const pxH = Math.max(240, Math.round(totalMmH * cappedPxPerMm));
    const bleedPx = bleed * cappedPxPerMm;
    const marginPx = marginMm * cappedPxPerMm;
    const trimX = marginPx + bleedPx;
    const trimY = marginPx + bleedPx;
    const trimW = Math.round(dims.w * cappedPxPerMm);
    const trimH = Math.round(dims.h * cappedPxPerMm);

    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d');

    const t = store.getTemplate(project.templateId);
    const bgHex = spotMode ? '#FFFFFF' : (renderer && renderer.STYLE_BG[t.style]) || '#FFFFFF';

    // 底色与出血铺底
    ctx.fillStyle = cropMarks ? '#FFFFFF' : bgHex;
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.fillStyle = bgHex;
    ctx.fillRect(marginPx, marginPx, bleedAreaMmW * cappedPxPerMm, bleedAreaMmH * cappedPxPerMm);

    const measureW = Math.min(640, Math.max(400, trimW));
    const fitted = renderFittedFaceHtml(project, side, sandboxEl, measureW);
    const css = collectInlineCss();

    const foSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${measureW}" height="${Math.round((measureW * dims.h) / dims.w)}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" class="${spotMode ? 'spot-plate-root' : ''}">
          <style>${css}
            .fo-box { width:${measureW}px; height:${Math.round((measureW * dims.h) / dims.w)}px; }
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
      // 校验画布未因安全策略被污染
      ctx.getImageData(0, 0, 1, 1);
    } catch (err) {
      usedFallback = true;
      await renderFallback2D(ctx, pxW, pxH, trimX, trimY, trimW, trimH, bgHex, fitted.measurements, spotMode);
    }

    if (cropMarks) {
      drawCropMarks2D(ctx, trimX, trimY, trimW, trimH, bleedPx || 18);
    }

    return {
      canvas,
      widthPx: pxW,
      heightPx: pxH,
      widthMm: totalMmW,
      heightMm: totalMmH,
      usedFallback
    };
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null'));
          },
          mimeType,
          quality
        );
      } else {
        reject(new Error('Canvas toBlob unsupported'));
      }
    });
  }

  async function canvasToJpegBytes(canvas, quality = 0.92) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  }

  function asciiBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      out[i] = str.charCodeAt(i) & 0xff;
    }
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

  /**
   * 纯原生 JS PDF 1.4 封装器：将单页或多页 JPEG 字节流打包为标准矢量 MediaBox PDF
   * pages: [{ jpegBytes: Uint8Array, widthPx: number, heightPx: number, widthPt: number, heightPt: number }]
   */
  function buildPdfFromJpegs(pages) {
    const list = Array.isArray(pages) && pages.length ? pages : [];
    if (!list.length) {
      throw new Error('buildPdfFromJpegs requires at least one page');
    }

    const chunks = [];
    let byteOffset = 0;
    const pushBytes = (u8) => {
      chunks.push(u8);
      byteOffset += u8.length;
    };
    const pushAscii = (str) => pushBytes(asciiBytes(str));

    // PDF 1.4 头 + 4 字节高位二进制注释
    pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    const objOffsets = new Map();
    const kidRefs = list.map((_, idx) => `${3 + idx * 3} 0 R`).join(' ');

    // 1: Catalog
    objOffsets.set(1, byteOffset);
    pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // 2: Pages
    objOffsets.set(2, byteOffset);
    pushAscii(`2 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${list.length} >>\nendobj\n`);

    list.forEach((p, idx) => {
      const pageId = 3 + idx * 3;
      const imgId = 4 + idx * 3;
      const contentId = 5 + idx * 3;
      const wPt = Number(p.widthPt || 255.12).toFixed(2);
      const hPt = Number(p.heightPt || 153.07).toFixed(2);
      const jpeg = p.jpegBytes instanceof Uint8Array ? p.jpegBytes : new Uint8Array(p.jpegBytes);
      const streamCmd = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im${idx} Do\nQ\n`;

      objOffsets.set(pageId, byteOffset);
      pushAscii(
        `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im${idx} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
      );

      objOffsets.set(imgId, byteOffset);
      pushAscii(
        `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      );
      pushBytes(jpeg);
      pushAscii('\nendstream\nendobj\n');

      objOffsets.set(contentId, byteOffset);
      pushAscii(`${contentId} 0 obj\n<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream\nendobj\n`);
    });

    const totalObjs = 2 + list.length * 3;
    const xrefOffset = byteOffset;
    pushAscii(`xref\n0 ${totalObjs + 1}\n`);
    pushAscii('0000000000 65535 f \n');
    for (let id = 1; id <= totalObjs; id++) {
      const off = String(objOffsets.get(id)).padStart(10, '0');
      pushAscii(`${off} 00000 n \n`);
    }

    pushAscii(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return concatChunks(chunks);
  }

  function formatByteSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function exportProject(project, sandboxEl, onProgress) {
    const store = root.IchibanStore;
    const t = store.getTemplate(project.templateId);
    const exp = project.export || {};
    const fmt = exp.format || 'pdf';
    const baseName = project.fileName || '一番星名刺';
    const isDouble = t && t.sides === 2;
    const sides = isDouble ? ['front', 'back'] : ['front'];
    const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
    const cropMarks = exp.cropMarks !== false;

    const progress = (pct) => {
      if (typeof onProgress === 'function') onProgress(pct);
    };

    progress(15);

    let spotBlob = null;
    let spotFilename = `${baseName}_专色通道.svg`;
    if (exp.spot) {
      const spotSvg = renderSpotMaskSvg(project, sandboxEl);
      spotBlob = new Blob([spotSvg], { type: 'image/svg+xml;charset=utf-8' });
    }

    if (fmt === 'svg') {
      const svgMarkup = buildCompositeSvgMarkup(project, sandboxEl, {
        bleed,
        cropMarks,
        spotMode: false,
        sides
      });
      progress(100);
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      return {
        blob,
        filename: `${baseName}_矢量印刷稿.svg`,
        sizeText: formatByteSize(blob.size),
        spotBlob,
        spotFilename,
        pageCount: sides.length
      };
    }

    if (fmt === 'png' || fmt === 'jpg') {
      const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
      const page = await renderPageCanvas(project, 'front', sandboxEl, {
        bleed,
        dpi: exp.dpi || 300,
        cropMarks,
        spotMode: false
      });
      progress(85);
      const blob = await canvasToBlob(page.canvas, mime, 0.94);
      progress(100);
      return {
        blob,
        filename: `${baseName}.${fmt}`,
        sizeText: formatByteSize(blob.size),
        spotBlob,
        spotFilename,
        pageCount: 1
      };
    }

    // PDF 1.4 导出：正面 + 双面背面 (+ 开启专色时追加专色通道页)
    const pdfPages = [];
    for (let i = 0; i < sides.length; i++) {
      const side = sides[i];
      const rendered = await renderPageCanvas(project, side, sandboxEl, {
        bleed,
        dpi: exp.dpi || 300,
        cropMarks,
        spotMode: false
      });
      const jpegBytes = await canvasToJpegBytes(rendered.canvas, 0.92);
      pdfPages.push({
        jpegBytes,
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
        widthPt: (rendered.widthMm / 25.4) * 72,
        heightPt: (rendered.heightMm / 25.4) * 72
      });
      progress(30 + Math.round(((i + 1) / sides.length) * 45));
    }

    if (exp.spot) {
      const spotRendered = await renderPageCanvas(project, 'front', sandboxEl, {
        bleed,
        dpi: exp.dpi || 300,
        cropMarks,
        spotMode: true
      });
      const spotJpeg = await canvasToJpegBytes(spotRendered.canvas, 0.92);
      pdfPages.push({
        jpegBytes: spotJpeg,
        widthPx: spotRendered.widthPx,
        heightPx: spotRendered.heightPx,
        widthPt: (spotRendered.widthMm / 25.4) * 72,
        heightPt: (spotRendered.heightMm / 25.4) * 72
      });
    }

    progress(90);
    const pdfBytes = buildPdfFromJpegs(pdfPages);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    progress(100);

    return {
      blob,
      filename: `${baseName}_印刷成品.pdf`,
      sizeText: formatByteSize(blob.size),
      spotBlob,
      spotFilename,
      pageCount: pdfPages.length
    };
  }

  const api = {
    CRAFT_LABELS,
    detectActiveCrafts,
    renderFittedFaceHtml,
    renderSpotMaskSvg,
    buildCompositeSvgMarkup,
    renderPageCanvas,
    buildPdfFromJpegs,
    formatByteSize,
    exportProject
  };

  if (typeof window !== 'undefined') {
    window.IchibanPrintExport = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

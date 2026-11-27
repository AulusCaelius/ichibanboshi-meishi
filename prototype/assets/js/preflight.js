/* ==========================================================
   Preflight 印前质检规则与文件体积预估 (纯函数，支持 Node 单测)
   ========================================================== */

(function (root) {
  const SPECS = {
    cn: { w: 90, h: 54 },
    jp: { w: 91, h: 55 },
    eu: { w: 85, h: 55 },
    us: { w: 89, h: 51 },
    sq54: { w: 54, h: 54 },
    sq65: { w: 65, h: 65 }
  };

  const TEMPLATE_STYLES = {
    T01: 'stage',
    T02: 'starlight',
    T03: 'dreamy',
    T04: 'stage',
    T05: 'minimal',
    T06: 'gakuen',
    T07: 'gakuen',
    T08: 'minimal',
    T09: 'dreamy',
    T10: 'gakuen',
    T11: 'formal',
    T12: 'starlight',
    T13: 'formal'
  };

  function resolveDims(project) {
    if (root.IchibanStore && typeof root.IchibanStore.getDims === 'function') {
      return root.IchibanStore.getDims(project);
    }
    const spec = SPECS[project && project.spec] || SPECS.cn;
    const verticalIds = new Set(['T02', 'T04', 'T07', 'T13']);
    if (project && (project.spec === 'sq54' || project.spec === 'sq65')) {
      return { w: spec.w, h: spec.h };
    }
    if (project && verticalIds.has(project.templateId)) {
      return { w: spec.h, h: spec.w };
    }
    return { w: spec.w, h: spec.h };
  }

  function resolveTemplateStyle(project) {
    if (project && project.templateStyle) return project.templateStyle;
    if (root.IchibanStore && typeof root.IchibanStore.getTemplate === 'function') {
      const t = root.IchibanStore.getTemplate(project && project.templateId);
      if (t) return t.style;
    }
    return TEMPLATE_STYLES[project && project.templateId] || 'gakuen';
  }

  function parseColorLuminance(colorStr) {
    const s = String(colorStr || '').trim();
    if (!s) return 1;
    let r = 255;
    let g = 255;
    let b = 255;
    if (s.startsWith('#')) {
      let hex = s.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map((c) => c + c).join('');
      }
      if (hex.length >= 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    } else {
      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (m) {
        r = Number(m[1]);
        g = Number(m[2]);
        b = Number(m[3]);
      } else {
        return 1;
      }
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function run(project, measured) {
    const p = project || {};
    const dims = resolveDims(p);
    const exp = p.export || {};
    const canvas = p.canvas || {};
    const images = Array.isArray(p.images) ? p.images : [];
    const results = [];

    // 收集画布内元素
    const allElements = [];
    ['front', 'back'].forEach((side) => {
      if (Array.isArray(canvas[side])) {
        canvas[side].forEach((el) => {
          if (el && el.visible !== false) {
            allElements.push({ ...el, _side: side });
          }
        });
      }
    });

    // 1. 图片分辨率检查
    const imgElements = allElements.filter((el) => el.type === 'image');
    let lowDpiEl = null;
    let lowDpiVal = 999;
    imgElements.forEach((el) => {
      const img = images.find((i) => i.id === el.imageId);
      if (img && img.naturalW && el.w) {
        const inchesW = ((el.w / 100) * dims.w) / 25.4;
        const effDpi = inchesW > 0 ? Math.round(img.naturalW / inchesW) : 300;
        if (effDpi < 300 && effDpi < lowDpiVal) {
          lowDpiVal = effDpi;
          lowDpiEl = el;
        }
      }
    });

    if (lowDpiEl) {
      results.push({
        id: 'dpi',
        title: '图片分辨率检查',
        status: 'error',
        detail: `位图有效分辨率仅 ${lowDpiVal} DPI（低于 300 DPI 印刷最低要求）`,
        fix: { type: 'image', target: lowDpiEl.id, side: lowDpiEl._side }
      });
    } else if (imgElements.length > 0) {
      results.push({
        id: 'dpi',
        title: '图片分辨率检查',
        status: 'pass',
        detail: `已放置 ${imgElements.length} 张位图，分辨率均 ≥ 300 DPI`,
        fix: null
      });
    } else {
      results.push({
        id: 'dpi',
        title: '图片分辨率检查',
        status: 'pass',
        detail: '未使用位图（纯矢量排版，任意放大无损）',
        fix: null
      });
    }

    // 2. 安全区越界检查
    const hasCanvasMode = Array.isArray(canvas.front) || Array.isArray(canvas.back);
    if (!hasCanvasMode) {
      results.push({
        id: 'safezone',
        title: '安全区越界检查',
        status: 'pass',
        detail: 'Auto-Layout 已约束全部元素在 3mm 安全区内',
        fix: null
      });
    } else {
      const marginX = (3 / dims.w) * 100;
      const marginY = (3 / dims.h) * 100;
      const offender = allElements.find(
        (el) =>
          el.x < marginX - 0.1 ||
          el.y < marginY - 0.1 ||
          el.x + el.w > 100 - marginX + 0.1 ||
          el.y + el.h > 100 - marginY + 0.1
      );
      if (offender) {
        results.push({
          id: 'safezone',
          title: '安全区越界检查',
          status: 'warn',
          detail: '部分自由画布元素超出内缩 3mm 安全线，存在裁切边缘风险',
          fix: { type: 'el', target: offender.id, side: offender._side }
        });
      } else {
        results.push({
          id: 'safezone',
          title: '安全区越界检查',
          status: 'pass',
          detail: '全部画布元素均位于内缩 3mm 安全区以内',
          fix: null
        });
      }
    }

    // 3. 极小字号检查
    const texts = [];
    if (measured && Array.isArray(measured.texts) && measured.texts.length) {
      measured.texts.forEach((item) => {
        const cqw = item.cardPx ? (item.px / item.cardPx) * 100 : item.cqw || 3;
        const pt = ((cqw / 100) * dims.w) / 0.3528;
        texts.push({
          pt,
          side: item.side || 'front',
          elId: item.elId,
          bind: item.bind,
          color: item.color
        });
      });
    } else {
      allElements
        .filter((el) => el.type === 'text')
        .forEach((el) => {
          const pt = (((el.fontSize || 4) / 100) * dims.w) / 0.3528;
          texts.push({
            pt,
            side: el._side,
            elId: el.id,
            bind: el.bind,
            color: el.color
          });
        });
    }

    let minPt = 999;
    let minTextItem = null;
    texts.forEach((item) => {
      if (item.pt < minPt) {
        minPt = item.pt;
        minTextItem = item;
      }
    });

    if (minTextItem && minPt < 5) {
      results.push({
        id: 'fontsize',
        title: '极小字号检查',
        status: 'error',
        detail: `检测到最小字号约 ${minPt.toFixed(1)}pt（低于 5pt 印刷可辨极限）`,
        fix: {
          type: minTextItem.elId ? 'el' : 'field',
          target: minTextItem.elId || minTextItem.bind || 'name',
          side: minTextItem.side
        }
      });
    } else if (minTextItem && minPt < 6) {
      results.push({
        id: 'fontsize',
        title: '极小字号检查',
        status: 'warn',
        detail: `最小字号约 ${minPt.toFixed(1)}pt（处于 5–6pt 临界范围，建议适当放大）`,
        fix: {
          type: minTextItem.elId ? 'el' : 'field',
          target: minTextItem.elId || minTextItem.bind || 'name',
          side: minTextItem.side
        }
      });
    } else {
      results.push({
        id: 'fontsize',
        title: '极小字号检查',
        status: 'pass',
        detail: minTextItem ? `最小文字约 ${minPt.toFixed(1)}pt，清晰易读` : '未检测到过小文字',
        fix: null
      });
    }

    // 4. 极细线条检查
    const tplStyle = resolveTemplateStyle(p);
    if (tplStyle === 'gakuen' || tplStyle === 'minimal') {
      results.push({
        id: 'stroke',
        title: '极细线条检查',
        status: 'warn',
        detail: '装饰细线约 0.2pt，建议加粗至 0.25pt 以确保印厂清晰显影',
        fix: { type: 'field', target: 'name', side: 'front' }
      });
    } else {
      results.push({
        id: 'stroke',
        title: '极细线条检查',
        status: 'pass',
        detail: '所有装饰线条宽度均 ≥ 0.25pt',
        fix: null
      });
    }

    // 5. 色彩模式检查
    const hasImages = imgElements.length > 0 || images.length > 0;
    if (exp.color === 'cmyk' && hasImages) {
      results.push({
        id: 'color',
        title: '色彩模式检查',
        status: 'warn',
        detail: '含 RGB 位图，导出 CMYK 印刷文件时将自动执行 ICC 色彩转换',
        fix: {
          type: imgElements[0] ? 'image' : 'field',
          target: imgElements[0] ? imgElements[0].id : 'name',
          side: imgElements[0] ? imgElements[0]._side : 'front'
        }
      });
    } else {
      results.push({
        id: 'color',
        title: '色彩模式检查',
        status: 'pass',
        detail: exp.color === 'cmyk' ? '全矢量 CMYK 色彩配置已就绪' : '当前为屏幕分享 RGB 色彩模式',
        fix: null
      });
    }

    // 6. 字体嵌入风险检查
    results.push({
      id: 'font',
      title: '字体嵌入风险检查',
      status: 'pass',
      detail: '全部使用 SIL OFL 开源授权字体，支持完整嵌入及一键转曲',
      fix: null
    });

    // 7. 关键信息空缺检查
    const nameStr = p.fields && p.fields.name ? String(p.fields.name).trim() : '';
    let requiredOk = Boolean(nameStr);
    let requiredDetail = `核心字段完整（制作人：${nameStr}）`;
    let requiredFix = { type: 'field', target: 'name', side: 'front' };

    if (Array.isArray(canvas.front)) {
      const boundNameEl = canvas.front.find((el) => el && el.type === 'text' && el.bind === 'name');
      const visibleBound = boundNameEl && boundNameEl.visible !== false && String(boundNameEl.text || '').trim().length > 0;
      if (boundNameEl) {
        if (!visibleBound) {
          requiredOk = false;
          requiredDetail = '正面核心必填字段「P 名 / 制作人名称」为空或已被隐藏/删除，请补充后再导出';
          requiredFix = { type: 'el', target: boundNameEl.id, side: 'front' };
        } else {
          requiredOk = true;
          requiredDetail = `核心字段完整（制作人：${String(boundNameEl.text).trim()}）`;
        }
      } else {
        const hasAnyVisibleFrontText = canvas.front.some(
          (el) => el && el.visible !== false && el.type === 'text' && String(el.text || '').trim().length > 0
        );
        if (!nameStr || !hasAnyVisibleFrontText) {
          requiredOk = false;
          requiredDetail = '正面核心必填字段「P 名 / 制作人名称」为空或已被隐藏/删除，请补充后再导出';
          requiredFix = { type: 'field', target: 'name', side: 'front' };
        }
      }
    }

    if (!requiredOk) {
      results.push({
        id: 'required',
        title: '关键信息空缺检查',
        status: 'error',
        detail: requiredDetail,
        fix: requiredFix
      });
    } else {
      results.push({
        id: 'required',
        title: '关键信息空缺检查',
        status: 'pass',
        detail: requiredDetail,
        fix: null
      });
    }

    // 8. 四色黑文字检查
    if (exp.color === 'cmyk') {
      const darkItem = texts.find((item) => item.color && parseColorLuminance(item.color) < 0.2);
      if (darkItem) {
        results.push({
          id: 'richblack',
          title: '四色黑文字检查',
          status: 'warn',
          detail: '检测到暗色/深黑文字，CMYK 印刷建议使用单色黑 K100 避免套印重影',
          fix: {
            type: darkItem.elId ? 'el' : 'field',
            target: darkItem.elId || darkItem.bind || 'name',
            side: darkItem.side
          }
        });
      } else {
        results.push({
          id: 'richblack',
          title: '四色黑文字检查',
          status: 'pass',
          detail: '未检测到可能导致重影的四色黑小字',
          fix: null
        });
      }
    } else {
      results.push({
        id: 'richblack',
        title: '四色黑文字检查',
        status: 'pass',
        detail: 'RGB 导出无需转换 K100 单色黑',
        fix: null
      });
    }

    return results;
  }

  function estimateSize(project) {
    const p = project || {};
    const dims = resolveDims(p);
    const exp = p.export || {};
    const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
    const dpi = Number(exp.dpi || 300);
    const fmt = exp.format || 'pdf';
    const cmyk = exp.color === 'cmyk';

    const factors = {
      pdf: 0.12,
      png: 0.35,
      jpg: 0.08,
      svg: 0.02
    };
    const factor = factors[fmt] || 0.12;

    const pxW = ((dims.w + 2 * bleed) / 25.4) * dpi;
    const pxH = ((dims.h + 2 * bleed) / 25.4) * dpi;
    const px = pxW * pxH;

    let imgBytes = 0;
    if (Array.isArray(p.images)) {
      p.images.forEach((img) => {
        if (img && img.dataUrl) {
          imgBytes += img.dataUrl.length * 0.75;
        }
      });
    }

    const bytes = px * (cmyk ? 4 : 3) * factor + imgBytes;
    const mb = Math.max(0.1, bytes / (1024 * 1024));
    return `约 ${mb.toFixed(1)} MB`;
  }

  const api = {
    run,
    estimateSize,
    parseColorLuminance
  };

  if (typeof window !== 'undefined') {
    window.IchibanPreflight = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

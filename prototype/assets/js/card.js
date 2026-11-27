/* ==========================================================
   名片渲染器 (renderCard) 与自适应缩字引擎 (fitText)
   向后兼容 Round 1，并支持 Round 2 扩展参数与自由画布装饰层
   ========================================================== */

window.IchibanCard = (function () {
  const LIGHT_ACCENTS = new Set(['#EAFDFF', '#7CFC00', '#F8C112']);
  const SNS_LABELS = [
    { key: 'x', badge: 'X' },
    { key: 'weibo', badge: '微' },
    { key: 'bilibili', badge: 'B' },
    { key: 'xhs', badge: '书' }
  ];

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderQrMarkup(craftCls) {
    const cells = [];
    for (let i = 0; i < 9; i++) {
      cells.push('<span></span>');
    }
    const extra = craftCls ? ` ${escapeHtml(craftCls)}` : '';
    return `<div class="bcard__qr${extra}" data-region="qr" aria-label="动态二维码占位">${cells.join('')}</div>`;
  }

  function renderPatternLayer(pattern) {
    if (!pattern || pattern === 'none') return '';
    return `<div class="bcard__pattern bcard__pattern--${escapeHtml(pattern)}" aria-hidden="true"></div>`;
  }

  function buildCornerStyle(corner, dims) {
    if (!corner || corner <= 0) return '';
    const w = (dims && dims.w) || 90;
    const h = (dims && dims.h) || 54;
    const rx = ((corner / w) * 100).toFixed(2);
    const ry = ((corner / h) * 100).toFixed(2);
    return `border-radius:${rx}% / ${ry}%;`;
  }

  function renderSnsBlock(snsVal, craftMap) {
    const map = typeof craftMap === 'string' ? { x: craftMap } : craftMap || {};
    if (snsVal && typeof snsVal === 'object') {
      const items = SNS_LABELS.filter((item) => snsVal[item.key] && String(snsVal[item.key]).trim())
        .map((item) => {
          const c = map[item.key] ? ` ${escapeHtml(map[item.key])}` : '';
          return `<span class="bcard__sns-item${c}" data-fit data-sns-key="${item.key}" data-region="${item.key}"><i class="bcard__sns-badge">${item.badge}</i><span>${escapeHtml(String(snsVal[item.key]).trim())}</span></span>`;
        })
        .join('');
      return items ? `<div class="bcard__sns-list">${items}</div>` : '';
    }
    const text = snsVal ? String(snsVal).trim() : '';
    const c = map.x ? ` ${escapeHtml(map.x)}` : '';
    return text ? `<div class="bcard__sns${c}" data-fit data-region="x">${escapeHtml(text)}</div>` : '';
  }

  function renderBackFace(t, d, opts) {
    const isStatic = Boolean(opts.isStatic || opts.side === 'back');
    const stockCls = opts.stock ? ` bcard-stock--${escapeHtml(opts.stock)}` : '';
    const cls = isStatic
      ? `bcard__face bcard__face--back bcard__face--back-static${stockCls}`
      : `bcard__face bcard__face--back${stockCls}`;
    const cornerCss = buildCornerStyle(opts.corner, opts.dims);
    const transformCss = isStatic ? 'transform:none;' : '';
    const faceStyle = transformCss || cornerCss ? ` style="${transformCss}${cornerCss}"` : '';
    const patternHtml = renderPatternLayer(opts.pattern);
    const craft = opts.craftClass || {};
    const clsFor = (k) => (craft[k] ? ` ${escapeHtml(craft[k])}` : '');

    if (opts.decorOnly) {
      return `
        <div class="${cls}" data-region="backBg"${faceStyle}>
          <div class="bcard__back-pattern"></div>
          ${patternHtml}
        </div>
      `;
    }

    const showQr = d.qr !== false;
    return `
      <div class="${cls}" data-region="backBg"${faceStyle}>
        <div class="bcard__back-pattern"></div>
        ${patternHtml}
        <div class="bcard__back-inner">
          <div>
            <div class="bcard__meta">${escapeHtml(t.id)} · ${escapeHtml(t.idol)}</div>
            <div class="bcard__back-jp${clsFor('backJp')}" data-fit data-region="backJp">${escapeHtml(t.jp)}</div>
          </div>
          <div class="bcard__back-bottom">
            <div>
              <div class="bcard__meta">PHYGITAL LINK ✦</div>
              <div class="bcard__sns">${escapeHtml(t.craft)} · ${escapeHtml(t.layoutLabel)}</div>
            </div>
            ${showQr ? renderQrMarkup(craft.qr) : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderTachie(t, decorCls) {
    return `
      <div class="bcard__tachie${decorCls}" data-region="decor" aria-hidden="true">
        <span class="bcard__tachie-char">${escapeHtml(t.initial)}</span>
        <span class="bcard__tachie-tag">立绘</span>
      </div>
    `;
  }

  function renderFrontDecor(t, opts) {
    const patternHtml = renderPatternLayer(opts.pattern);
    const craft = opts.craftClass || {};
    const decorCls = craft.decor ? ` ${escapeHtml(craft.decor)}` : '';
    if (t.style === 'gakuen') {
      return `
        <div class="bcard__ribbon${decorCls}" data-region="decor"></div>
        <div class="bcard__deco-frame${decorCls}" data-region="decor"></div>
        <div class="bcard__crest${decorCls}" data-region="decor" aria-hidden="true">✦</div>
        ${renderTachie(t, decorCls)}
        ${patternHtml}
      `;
    }
    if (t.style === 'stage') {
      return `
        <div class="bcard__beams"></div>
        ${renderTachie(t, decorCls)}
        ${patternHtml}
      `;
    }
    if (t.style === 'starlight') {
      return `
        <svg class="bcard__constellation${decorCls}" data-region="decor" viewBox="0 0 300 180" fill="none" aria-hidden="true">
          <path d="M36 42 L94 26 L152 62 L226 30 L264 82" stroke="#D4AF37" stroke-width="1" stroke-dasharray="3 3"/>
          <circle cx="36" cy="42" r="2.5" fill="#FFF3AE"/>
          <circle cx="94" cy="26" r="3" fill="#D4AF37"/>
          <circle cx="152" cy="62" r="2.2" fill="#FFF3AE"/>
          <circle cx="226" cy="30" r="3" fill="#D4AF37"/>
          <circle cx="264" cy="82" r="2.5" fill="#FFF3AE"/>
        </svg>
        ${patternHtml}
      `;
    }
    if (t.style === 'dreamy') {
      return `
        <div class="bcard__bubbles"></div>
        ${renderTachie(t, decorCls)}
        ${patternHtml}
      `;
    }
    if (t.style === 'formal') {
      return `
        <div class="bcard__topbars${decorCls}" data-region="decor">
          <div class="bcard__bar-ink"></div>
          <div class="bcard__bar-accent"></div>
        </div>
        ${patternHtml}
      `;
    }
    return patternHtml;
  }

  function renderFrontFace(t, d, accent, opts) {
    const cornerCss = buildCornerStyle(opts.corner, opts.dims);
    const faceStyle = cornerCss ? ` style="${cornerCss}"` : '';
    const stockCls = opts.stock ? ` bcard-stock--${escapeHtml(opts.stock)}` : '';
    const decorHtml = renderFrontDecor(t, opts);

    if (opts.decorOnly) {
      return `
        <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
          ${decorHtml}
        </div>
      `;
    }

    const craft = opts.craftClass || {};
    const clsFor = (k) => (craft[k] ? ` ${escapeHtml(craft[k])}` : '');
    const lightClass = LIGHT_ACCENTS.has(accent.toUpperCase()) ? ' is-light-accent' : '';

    const nameHtml = d.name
      ? `<div class="bcard__name${clsFor('name')}" data-fit data-region="name">${escapeHtml(d.name)}</div>`
      : '';
    const enHtml = d.enName
      ? `<div class="bcard__en${clsFor('enName')}" data-fit data-region="enName">${escapeHtml(d.enName)}</div>`
      : '';
    const titleHtml = d.title
      ? `<div class="bcard__title${lightClass}${clsFor('title')}" data-fit data-region="title">${escapeHtml(d.title)}</div>`
      : '';
    const companyHtml = d.company
      ? `<div class="bcard__company${clsFor('company')}" data-fit data-region="company">${escapeHtml(d.company)}</div>`
      : '';
    const snsHtml = renderSnsBlock(d.sns, craft);
    const favHtml = d.favSong
      ? `<div class="bcard__fav${clsFor('favSong')}" data-fit data-region="favSong">♪ ${escapeHtml(d.favSong)}</div>`
      : '';

    if (t.style === 'gakuen') {
      return `
        <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
          ${decorHtml}
          <div class="bcard__jp-vert">${escapeHtml(t.jp)}</div>
          <div class="bcard__content">
            <div>${companyHtml}</div>
            <div>
              ${nameHtml}
              ${enHtml}
              ${titleHtml}
            </div>
            <div>
              ${snsHtml}
              ${favHtml}
              <div class="bcard__meta">${escapeHtml(t.id)} · ICHIBANBOSHI</div>
            </div>
          </div>
        </div>
      `;
    }

    if (t.style === 'stage') {
      return `
        <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
          ${decorHtml}
          <div class="bcard__content">
            <div class="bcard__meta">${escapeHtml(t.id)} · ${escapeHtml(t.jp)}</div>
            <div>
              ${nameHtml}
              ${enHtml}
              ${titleHtml}
            </div>
            <div>
              ${companyHtml}
              ${snsHtml}
              ${favHtml}
            </div>
          </div>
        </div>
      `;
    }

    if (t.style === 'starlight') {
      return `
        <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
          ${decorHtml}
          <div class="bcard__content">
            <div class="bcard__meta">✦ ${escapeHtml(t.jp)} · ${escapeHtml(t.id)}</div>
            <div>
              ${nameHtml}
              ${enHtml}
              ${titleHtml}
            </div>
            <div>
              ${companyHtml}
              ${snsHtml}
              ${favHtml}
            </div>
          </div>
        </div>
      `;
    }

    if (t.style === 'dreamy') {
      return `
        <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
          ${decorHtml}
          <div class="bcard__content">
            <div class="bcard__meta">✦ ${escapeHtml(t.jp)}</div>
            <div class="bcard__glass-plate">
              ${nameHtml}
              ${enHtml}
              ${titleHtml}
              ${companyHtml}
            </div>
            <div>
              ${snsHtml}
              ${favHtml}
            </div>
          </div>
        </div>
      `;
    }

    if (t.style === 'minimal') {
      return `
        <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
          ${decorHtml}
          <div class="bcard__content">
            <div class="bcard__label-en">
              <span class="bcard__swatch"></span>
              <span>PRODUCER</span>
            </div>
            <div>
              ${nameHtml}
              ${enHtml}
              <div class="bcard__rule"></div>
              ${titleHtml}
            </div>
            <div>
              ${companyHtml}
              ${snsHtml}
              ${favHtml}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
        ${decorHtml}
        <div class="bcard__content">
          <div>${companyHtml}</div>
          <div class="bcard__center-block">
            ${nameHtml}
            ${enHtml}
            ${titleHtml}
          </div>
          <div class="bcard__foot-split">
            <div style="min-width:0;flex:1;">
              ${snsHtml}
              ${favHtml}
            </div>
            <span class="bcard__vdiv" aria-hidden="true"></span>
            <span class="bcard__meta">${escapeHtml(t.id)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function normalizeData(data, hideEmpty) {
    const fallback = window.IchibanData ? window.IchibanData.PLACEHOLDER : {};
    const src = data || {};
    if (hideEmpty) {
      return {
        name: src.name ? String(src.name).trim() : '',
        enName: src.enName ? String(src.enName).trim() : '',
        title: src.title ? String(src.title).trim() : '',
        company: src.company ? String(src.company).trim() : '',
        sns: src.sns != null ? src.sns : '',
        favSong: src.favSong ? String(src.favSong).trim() : '',
        qr: src.qr !== false
      };
    }
    return {
      name: (src.name != null && String(src.name).trim()) || fallback.name || '制作人Producer',
      enName: src.enName ? String(src.enName).trim() : '',
      title: (src.title != null && String(src.title).trim()) || fallback.title || '〇〇担当',
      company: (src.company != null && String(src.company).trim()) || fallback.company || '初星学園',
      sns: src.sns != null ? src.sns : fallback.sns || 'X @your_id',
      favSong: src.favSong ? String(src.favSong).trim() : '',
      qr: src.qr !== false
    };
  }

  function renderCard(t, data, opts = {}) {
    const d = normalizeData(data, opts.hideEmpty);
    const accent = opts.accent || t.color;

    let orientClass = `bcard--${t.orient}`;
    let frameOrientClass = `bcard-frame--${t.orient}`;
    let ratioStyle = '';
    if (opts.dims && opts.dims.w && opts.dims.h) {
      if (opts.dims.w === opts.dims.h) {
        orientClass = 'bcard--s';
        frameOrientClass = 'bcard-frame--s';
      } else if (opts.dims.h > opts.dims.w) {
        orientClass = 'bcard--v';
        frameOrientClass = 'bcard-frame--v';
      } else {
        orientClass = 'bcard--h';
        frameOrientClass = 'bcard-frame--h';
      }
      ratioStyle = `aspect-ratio:${opts.dims.w} / ${opts.dims.h};`;
    }

    const cardStyleAttr = `style="--accent:${escapeHtml(accent)};${ratioStyle}"`;

    if (opts.side === 'back' || opts.back) {
      return `
        <div class="bcard-frame ${frameOrientClass} bcard-frame--single">
          <div class="bcard bcard--${t.style} ${orientClass}" ${cardStyleAttr}>
            <div class="bcard__inner">
              ${renderBackFace(t, d, { ...opts, isStatic: true })}
            </div>
          </div>
        </div>
      `;
    }

    if (opts.side === 'front') {
      return `
        <div class="bcard-frame ${frameOrientClass} bcard-frame--single">
          <div class="bcard bcard--${t.style} ${orientClass}" ${cardStyleAttr}>
            <div class="bcard__inner">
              ${renderFrontFace(t, d, accent, opts)}
            </div>
          </div>
        </div>
      `;
    }

    const isDouble = t.sides === 2 && !opts.forceSingle;
    const frameClass = isDouble ? 'bcard-frame--double' : 'bcard-frame--single';

    return `
      <div class="bcard-frame ${frameOrientClass} ${frameClass}">
        <div class="bcard bcard--${t.style} ${orientClass}" ${cardStyleAttr}>
          <div class="bcard__inner">
            ${renderFrontFace(t, d, accent, opts)}
            ${isDouble ? renderBackFace(t, d, opts) : ''}
          </div>
        </div>
      </div>
    `;
  }

  function fitText(root) {
    const container = root || document;
    const nodes = container.querySelectorAll('[data-fit]');
    nodes.forEach((el) => {
      if (!el.clientWidth) return;

      el.classList.remove('is-wrapped');
      el.style.fontSize = '';

      const computed = parseFloat(window.getComputedStyle(el).fontSize);
      if (!computed || Number.isNaN(computed)) return;

      const baseSize = computed;
      const minSize = Math.max(6.5, baseSize * 0.50);
      let current = baseSize;

      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && current > minSize && guard < 18) {
        current = Math.max(minSize, current * 0.9);
        el.style.fontSize = current.toFixed(2) + 'px';
        guard++;
      }

      if (el.scrollWidth > el.clientWidth + 1) {
        el.classList.add('is-wrapped');
      }
    });
  }

  return {
    renderCard,
    fitText,
    escapeHtml
  };
})();

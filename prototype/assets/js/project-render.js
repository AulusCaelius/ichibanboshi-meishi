/* ==========================================================
   统一名片面渲染器、矢量图标库与自由画布 DOM 转换器 (window.IchibanProject)
   ========================================================== */

window.IchibanProject = (function () {
  const ICONS = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    x: '<path d="M4 4l16 16M20 4L4 20"/>',
    weibo: '<circle cx="12" cy="12" r="9"/><path d="M9 12c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3z"/><circle cx="17" cy="7" r="1"/>',
    bilibili: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M8 3l3 3M16 3l-3 3M9 11v3M15 11v3"/>',
    xhs: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M8 8h7M8 12h5"/>',
    location: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1L11.4 4.5"/><path d="M14 11a5 5 0 0 0-7.1 0L4.1 13.8a5 5 0 0 0 7.1 7.1l1.4-1.4"/>',
    star: '<path d="M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>',
    heart: '<path d="M20.8 7.5a5.2 5.2 0 0 0-8.8-2.1A5.2 5.2 0 0 0 3.2 7.5c0 4.6 5.2 8.7 8.8 11.7 3.6-3 8.8-7.1 8.8-11.7z"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>'
  };

  const ICON_LABELS = {
    phone: '电话',
    mail: '邮箱',
    x: 'X (Twitter)',
    weibo: '微博',
    bilibili: 'B站',
    xhs: '小红书',
    location: '坐标',
    link: '链接',
    star: '星标 ✦',
    heart: '喜爱',
    music: '音乐',
    mic: '舞台麦克风'
  };

  const STYLE_BG = {
    stage: '#111111',
    starlight: '#1B2A5A',
    dreamy: '#F6ADC6',
    gakuen: '#FFFFFF',
    minimal: '#FFFFFF',
    formal: '#FFFFFF'
  };

  function renderElementHtml(el, project, interactive, selectedId) {
    const { escapeHtml } = window.IchibanCard;
    const classes = ['bcard-el', `bcard-el--${el.type}`];
    if (el.vertical) classes.push('bcard-el--vertical');
    if (el.craft && el.craft !== 'none') classes.push(`craft-${el.craft}`);
    if (el.visible === false) classes.push('bcard-el--hidden');
    if (el.locked) classes.push('bcard-el--locked');
    if (interactive && !el.locked) classes.push('bcard-el--interactive');
    if (interactive && selectedId === el.id) classes.push('is-selected');

    const baseStyle = [
      `left:${el.x}%`,
      `top:${el.y}%`,
      `width:${el.w}%`,
      `height:${el.h}%`,
      `opacity:${el.opacity != null ? el.opacity : 1}`
    ];

    let inner = '';
    if (el.type === 'text') {
      const justify = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start';
      const safeFontFamily = String(el.fontFamily || "var(--font-sans), sans-serif").replace(/"/g, "'");
      baseStyle.push(
        `font-size:${el.fontSize || 4.2}cqw`,
        `font-family:${safeFontFamily}`,
        `font-weight:${el.fontWeight || 500}`,
        `letter-spacing:${el.letterSpacing || 0}em`,
        `color:${el.color || '#333333'}`,
        `text-align:${el.align || 'left'}`,
        `justify-content:${justify}`
      );
      inner = escapeHtml(el.text || '');
    } else if (el.type === 'icon') {
      baseStyle.push(`color:${el.color || project.accent || '#FF7600'}`);
      const path = ICONS[el.iconName] || ICONS.star;
      inner = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    } else if (el.type === 'image') {
      const img = (project.images || []).find((item) => item.id === el.imageId);
      inner = img
        ? `<img src="${escapeHtml(img.dataUrl)}" alt="自定义图片"/>`
        : '<div style="width:100%;height:100%;background:var(--gray-100);display:grid;place-items:center;font-size:3cqw;color:var(--gray-600);">图片</div>';
    } else if (el.type === 'qr') {
      const cells = Array.from({ length: 9 }).map(() => '<span></span>').join('');
      inner = `<div class="bcard__qr" style="width:100%;height:100%;" aria-label="动态二维码">${cells}</div>`;
    }

    const handle =
      interactive && selectedId === el.id && !el.locked
        ? '<span class="bcard-el__handle" data-resize-handle="true"></span>'
        : '';

    return `<div class="${classes.join(' ')}" data-el-id="${escapeHtml(el.id)}" style="${escapeHtml(baseStyle.join(';'))}">${inner}${handle}</div>`;
  }

  function getEffectiveStock(project, side) {
    const sm = project && project.sideMaterials;
    if (sm && sm[side] && sm[side] !== 'inherit') {
      return sm[side];
    }
    return (project && project.material) || 'matte';
  }

  function buildCraftClassMap(project) {
    const craftClass = {};
    const rm = project && project.regionMaterials;
    if (rm && typeof rm === 'object') {
      Object.entries(rm).forEach(([regionKey, matId]) => {
        if (matId && matId !== 'none') {
          craftClass[regionKey] = `craft-${matId}`;
        }
      });
    } else if (project && project.crafts) {
      if (project.crafts.gold) craftClass.name = 'craft-gold';
      else if (project.crafts.silver) craftClass.name = 'craft-silver';
      if (project.crafts.uv) craftClass.title = 'craft-uv';
      if (project.crafts.emboss) craftClass.company = 'craft-emboss';
    }
    return craftClass;
  }

  function renderFace(project, side, opts = {}) {
    const store = window.IchibanStore;
    const cardMod = window.IchibanCard;
    const t = store.getTemplate(project.templateId);
    const dims = store.getDims(project);
    const interactive = Boolean(opts.interactive);
    const selectedId = opts.selectedId || null;
    const stock = getEffectiveStock(project, side);
    const craftClass = buildCraftClassMap(project);

    const elements = project.canvas && project.canvas[side];

    if (!elements) {
      const f = project.fields || {};
      const data = {
        name: f.name,
        enName: f.enName,
        title: f.title,
        company: f.company,
        sns: {
          x: f.x,
          weibo: f.weibo,
          bilibili: f.bilibili,
          xhs: f.xhs
        },
        favSong: f.favSong,
        qr: f.qr !== false
      };

      return cardMod.renderCard(t, data, {
        side,
        hideEmpty: true,
        dims,
        stock,
        corner: project.corner || 0,
        pattern: project.pattern || 'none',
        accent: project.accent || t.color,
        craftClass
      });
    }

    const decorHtml = cardMod.renderCard(t, {}, {
      side,
      decorOnly: true,
      dims,
      stock,
      corner: project.corner || 0,
      pattern: project.pattern || 'none',
      accent: project.accent || t.color,
      craftClass
    });

    const layerHtml = `<div class="el-layer">${elements
      .map((el) => renderElementHtml(el, project, interactive, selectedId))
      .join('')}</div>`;

    if (typeof document !== 'undefined') {
      const tmp = document.createElement('div');
      tmp.innerHTML = decorHtml;
      const faceEl = tmp.querySelector('.bcard__face');
      if (faceEl) {
        faceEl.insertAdjacentHTML('beforeend', layerHtml);
        return tmp.innerHTML;
      }
    }
    return decorHtml;
  }

  function inferBind(node) {
    if (node.classList.contains('bcard__name')) return 'name';
    if (node.classList.contains('bcard__en')) return 'enName';
    if (node.classList.contains('bcard__title')) return 'title';
    if (node.classList.contains('bcard__company')) return 'company';
    if (node.classList.contains('bcard__fav')) return 'favSong';
    if (node.classList.contains('bcard__sns-item')) {
      return node.dataset.snsKey || 'x';
    }
    if (node.classList.contains('bcard__sns')) return 'x';
    return undefined;
  }

  function inferCraft(node) {
    const keys = ['gold', 'silver', 'copper', 'emboss', 'deboss', 'uv', 'velvet', 'brushed'];
    for (const k of keys) {
      if (node.classList.contains(`craft-${k}`)) return k;
    }
    return 'none';
  }

  function convertToElements(cardEl, side) {
    const store = window.IchibanStore;
    const face = cardEl ? cardEl.querySelector('.bcard__face') : null;
    if (!cardEl || !face) return [];

    const cardRect = face.getBoundingClientRect();
    if (!cardRect.width || !cardRect.height) return [];

    const elements = [];
    const selectors =
      '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en';

    face.querySelectorAll(selectors).forEach((node) => {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;

      const bind = inferBind(node);
      let text = '';
      if (node.classList.contains('bcard__sns-item')) {
        const valSpan = node.querySelector('span:last-child');
        text = valSpan ? valSpan.textContent.trim() : node.textContent.trim();
      } else if (node.classList.contains('bcard__fav')) {
        text = node.textContent.replace(/^♪\s*/, '').trim();
      } else {
        text = node.textContent.trim();
      }
      if (!text) return;

      const cs = window.getComputedStyle(node);
      const px = parseFloat(cs.fontSize) || 12;
      const fontSize = Number(((px / cardRect.width) * 100).toFixed(2));
      const ls = parseFloat(cs.letterSpacing);
      const letterSpacing = Number.isNaN(ls) ? 0 : Number((ls / px).toFixed(3));
      const craft = inferCraft(node);
      const rawColor = cs.color && !cs.color.includes('rgba(0, 0, 0, 0)') ? cs.color : '#333333';

      const x = Number((((r.left - cardRect.left) / cardRect.width) * 100).toFixed(2));
      const y = Number((((r.top - cardRect.top) / cardRect.height) * 100).toFixed(2));
      const rawW = (r.width / cardRect.width) * 100;
      const w = Number(Math.min(100 - Math.max(0, x), Math.max(8, rawW + 2)).toFixed(2));
      const h = Number(Math.max(5, (r.height / cardRect.height) * 100 + 1).toFixed(2));

      elements.push({
        id: store.uid(),
        type: 'text',
        bind,
        text,
        vertical: node.classList.contains('bcard__jp-vert'),
        x: Math.max(0, x),
        y: Math.max(0, y),
        w,
        h,
        fontSize,
        fontFamily: cs.fontFamily || 'var(--font-sans), sans-serif',
        fontWeight: Number(cs.fontWeight) || 500,
        letterSpacing,
        color: craft === 'gold' ? '#D4AF37' : craft === 'silver' ? '#C0C4C8' : rawColor,
        align: cs.textAlign === 'center' || cs.textAlign === 'right' ? cs.textAlign : 'left',
        craft,
        visible: true,
        locked: false,
        opacity: 1
      });
    });

  function inferQrCraft(node) {
    const keys = ['gold', 'silver', 'copper', 'emboss', 'deboss', 'uv', 'velvet', 'brushed'];
    for (const k of keys) {
      if (node.classList.contains(`craft-${k}`)) return k;
    }
    return 'none';
  }

    face.querySelectorAll('.bcard__qr').forEach((node) => {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      elements.push({
        id: store.uid(),
        type: 'qr',
        x: Number((((r.left - cardRect.left) / cardRect.width) * 100).toFixed(2)),
        y: Number((((r.top - cardRect.top) / cardRect.height) * 100).toFixed(2)),
        w: Number(((r.width / cardRect.width) * 100).toFixed(2)),
        h: Number(((r.height / cardRect.height) * 100).toFixed(2)),
        craft: inferQrCraft(node),
        visible: true,
        locked: false,
        opacity: 1
      });
    });

    return elements;
  }

  return {
    ICONS,
    ICON_LABELS,
    STYLE_BG,
    getEffectiveStock,
    renderFace,
    convertToElements
  };
})();

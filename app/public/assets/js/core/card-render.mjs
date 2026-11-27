/**
 * 一番星 · 统一名片面渲染器与矢量图形库 (v1.0)
 * 特性：真实 ISO/IEC 18004 二维码、自定义表单立绘上传与构图裁剪、P-ID/参战印记、
 *       自由画布旋转与矢量装饰图形、6 种特种纸与 9 种真实表面工艺材质、Auto-Layout fitText
 */

import { renderQrSvg } from './qrcode.mjs';
import { buildCardShareUrl } from './share-codec.mjs';
import * as store from './store.mjs';
import { PLACEHOLDER } from './catalog.mjs';

const LIGHT_ACCENTS = new Set(['#EAFDFF', '#7CFC00', '#F8C112']);
const SNS_LABELS = [
  { key: 'x', badge: 'X' },
  { key: 'weibo', badge: '微' },
  { key: 'bilibili', badge: 'B' },
  { key: 'xhs', badge: '书' }
];

export const ICONS = {
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

export const ICON_LABELS = {
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

export const SHAPES = {
  line: { label: '分割细线', w: 46, h: 3, svg: '<svg viewBox="0 0 100 10" preserveAspectRatio="none"><line x1="0" y1="5" x2="100" y2="5" stroke="currentColor" stroke-width="3"/></svg>' },
  decoFrame: { label: '装饰艺术角框', w: 48, h: 48, svg: '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M4 22 V4 H22 M78 4 H96 V22 M4 78 V96 H22 M78 96 H96 V78" fill="none" stroke="currentColor" stroke-width="3"/></svg>' },
  leafPill: { label: '叶片角底纹块', w: 36, h: 16, svg: '<svg viewBox="0 0 100 44" preserveAspectRatio="none"><path d="M0,0 H82 A18,18 0 0 1 100,18 V44 H18 A18,18 0 0 1 0,26 Z" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.2"/></svg>' },
  ring: { label: '聚光星环', w: 28, h: 46, svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="6 4"/><circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  starburst: { label: '日芒十字星', w: 20, h: 34, svg: '<svg viewBox="0 0 100 100"><path d="M50 6 L57 43 L94 50 L57 57 L50 94 L43 57 L6 50 L43 43 Z" fill="currentColor"/></svg>' }
};

export const STYLE_BG = {
  stage: '#111111',
  starlight: '#1B2A5A',
  dreamy: '#F6ADC6',
  gakuen: '#FFFFFF',
  minimal: '#FFFFFF',
  formal: '#FFFFFF'
};

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderQrMarkup(craftCls, qrUrl) {
  const target = qrUrl || 'https://auluscaelius.github.io/ichibanboshi-meishi/card.html';
  const extra = craftCls ? ` ${escapeHtml(craftCls)}` : '';
  return `<div class="bcard__qr bcard__qr--real${extra}" data-region="qr" data-qr-url="${escapeHtml(target)}" aria-label="制作人名刺二维码">${renderQrSvg(target, { border: 2, fg: '#1D1E22', bg: '#FFFFFF' })}</div>`;
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
  const backTitleText = d.backTitle !== undefined && String(d.backTitle).trim() ? d.backTitle : t.jp;
  const backSubText = d.backSub !== undefined && String(d.backSub).trim() ? d.backSub : `${t.craft} · ${t.layoutLabel}`;

  return `
    <div class="${cls}" data-region="backBg"${faceStyle}>
      <div class="bcard__back-pattern"></div>
      ${patternHtml}
      <div class="bcard__back-inner">
        <div>
          <div class="bcard__meta">${escapeHtml(t.id)} · ${escapeHtml(t.idol)}</div>
          <div class="bcard__back-jp${clsFor('backJp')}" data-fit data-region="backJp">${escapeHtml(backTitleText)}</div>
        </div>
        <div class="bcard__back-bottom">
          <div>
            <div class="bcard__meta">PHYGITAL LINK ✦</div>
            <div class="bcard__sns">${escapeHtml(backSubText)}</div>
          </div>
          ${showQr ? renderQrMarkup(craft.qr, opts.qrUrl) : ''}
        </div>
      </div>
    </div>
  `;
}

function renderTachie(t, decorCls, standee) {
  if (standee && standee.dataUrl) {
    const sc = Number(standee.scale || 1).toFixed(2);
    const ox = Number(standee.offsetX || 0);
    const oy = Number(standee.offsetY || 0);
    return `
      <div class="bcard__tachie bcard__tachie--photo${decorCls}" data-region="decor">
        <img class="bcard__tachie-img" src="${escapeHtml(standee.dataUrl)}" alt="${escapeHtml(t.idol)}立绘" style="transform:translate(${ox}%,${oy}%) scale(${sc});"/>
      </div>
    `;
  }
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
  const standee = opts.standee;

  if (t.style === 'gakuen') {
    return `
      <div class="bcard__ribbon${decorCls}" data-region="decor"></div>
      <div class="bcard__deco-frame${decorCls}" data-region="decor"></div>
      <div class="bcard__crest${decorCls}" data-region="decor" aria-hidden="true">✦</div>
      ${renderTachie(t, decorCls, standee)}
      ${patternHtml}
    `;
  }
  if (t.style === 'stage') {
    return `
      <div class="bcard__beams"></div>
      ${renderTachie(t, decorCls, standee)}
      ${patternHtml}
    `;
  }
  if (t.style === 'starlight') {
    const customStandee = standee && standee.dataUrl ? renderTachie(t, decorCls, standee) : '';
    return `
      <svg class="bcard__constellation${decorCls}" data-region="decor" viewBox="0 0 300 180" fill="none" aria-hidden="true">
        <path d="M36 42 L94 26 L152 62 L226 30 L264 82" stroke="#D4AF37" stroke-width="1" stroke-dasharray="3 3"/>
        <circle cx="36" cy="42" r="2.5" fill="#FFF3AE"/>
        <circle cx="94" cy="26" r="3" fill="#D4AF37"/>
        <circle cx="152" cy="62" r="2.2" fill="#FFF3AE"/>
        <circle cx="226" cy="30" r="3" fill="#D4AF37"/>
        <circle cx="264" cy="82" r="2.5" fill="#FFF3AE"/>
      </svg>
      ${customStandee}
      ${patternHtml}
    `;
  }
  if (t.style === 'dreamy') {
    return `
      <div class="bcard__bubbles"></div>
      ${renderTachie(t, decorCls, standee)}
      ${patternHtml}
    `;
  }
  if (t.style === 'formal') {
    const customStandee = standee && standee.dataUrl ? renderTachie(t, decorCls, standee) : '';
    return `
      <div class="bcard__topbars${decorCls}" data-region="decor">
        <div class="bcard__bar-ink"></div>
        <div class="bcard__bar-accent"></div>
      </div>
      ${customStandee}
      ${patternHtml}
    `;
  }
  const customStandee = standee && standee.dataUrl ? renderTachie(t, decorCls, standee) : '';
  return `${customStandee}${patternHtml}`;
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

  const nameHtml = d.name ? `<div class="bcard__name${clsFor('name')}" data-fit data-region="name">${escapeHtml(d.name)}</div>` : '';
  const enHtml = d.enName ? `<div class="bcard__en${clsFor('enName')}" data-fit data-region="enName">${escapeHtml(d.enName)}</div>` : '';
  const titleHtml = d.title ? `<div class="bcard__title${lightClass}${clsFor('title')}" data-fit data-region="title">${escapeHtml(d.title)}</div>` : '';
  const companyHtml = d.company ? `<div class="bcard__company${clsFor('company')}" data-fit data-region="company">${escapeHtml(d.company)}</div>` : '';
  const pidHtml = d.pid ? `<div class="bcard__pid${clsFor('pid')}" data-fit data-region="pid">ID: ${escapeHtml(d.pid)}</div>` : '';
  const eventHtml = d.eventTag ? `<div class="bcard__event${clsFor('eventTag')}" data-fit data-region="eventTag">${escapeHtml(d.eventTag)}</div>` : '';
  const snsHtml = renderSnsBlock(d.sns, craft);
  const favHtml = d.favSong ? `<div class="bcard__fav${clsFor('favSong')}" data-fit data-region="favSong">♪ ${escapeHtml(d.favSong)}</div>` : '';

  if (t.style === 'gakuen') {
    return `
      <div class="bcard__face bcard__face--front${stockCls}" data-region="frontBg"${faceStyle}>
        ${decorHtml}
        <div class="bcard__jp-vert">${escapeHtml(t.jp)}</div>
        <div class="bcard__content">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${companyHtml}${eventHtml}</div>
          <div>
            ${nameHtml}
            ${enHtml}
            ${titleHtml}
          </div>
          <div>
            ${snsHtml}
            ${pidHtml}
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
          <div class="bcard__meta" style="display:flex;align-items:center;gap:6px;"><span>${escapeHtml(t.id)} · ${escapeHtml(t.jp)}</span>${eventHtml}</div>
          <div>
            ${nameHtml}
            ${enHtml}
            ${titleHtml}
          </div>
          <div>
            ${companyHtml}
            ${snsHtml}
            ${pidHtml}
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
          <div class="bcard__meta" style="display:flex;align-items:center;gap:6px;"><span>✦ ${escapeHtml(t.jp)} · ${escapeHtml(t.id)}</span>${eventHtml}</div>
          <div>
            ${nameHtml}
            ${enHtml}
            ${titleHtml}
          </div>
          <div>
            ${companyHtml}
            ${snsHtml}
            ${pidHtml}
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
          <div class="bcard__meta" style="display:flex;align-items:center;gap:6px;"><span>✦ ${escapeHtml(t.jp)}</span>${eventHtml}</div>
          <div class="bcard__glass-plate">
            ${nameHtml}
            ${enHtml}
            ${titleHtml}
            ${companyHtml}
          </div>
          <div>
            ${snsHtml}
            ${pidHtml}
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
            ${eventHtml}
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
            ${pidHtml}
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
        <div style="display:flex;align-items:center;gap:6px;">${companyHtml}${eventHtml}</div>
        <div class="bcard__center-block">
          ${nameHtml}
          ${enHtml}
          ${titleHtml}
        </div>
        <div class="bcard__foot-split">
          <div style="min-width:0;flex:1;">
            ${snsHtml}
            ${pidHtml}
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
  const src = data || {};
  if (hideEmpty) {
    return {
      name: src.name ? String(src.name).trim() : '',
      enName: src.enName ? String(src.enName).trim() : '',
      title: src.title ? String(src.title).trim() : '',
      company: src.company ? String(src.company).trim() : '',
      pid: src.pid ? String(src.pid).trim() : '',
      eventTag: src.eventTag ? String(src.eventTag).trim() : '',
      sns: src.sns != null ? src.sns : '',
      favSong: src.favSong ? String(src.favSong).trim() : '',
      backTitle: src.backTitle,
      backSub: src.backSub,
      qr: src.qr !== false
    };
  }
  return {
    name: (src.name != null && String(src.name).trim()) || PLACEHOLDER.name,
    enName: src.enName ? String(src.enName).trim() : '',
    title: (src.title != null && String(src.title).trim()) || PLACEHOLDER.title,
    company: (src.company != null && String(src.company).trim()) || PLACEHOLDER.company,
    pid: src.pid ? String(src.pid).trim() : '',
    eventTag: src.eventTag ? String(src.eventTag).trim() : '',
    sns: src.sns != null ? src.sns : PLACEHOLDER.sns,
    favSong: src.favSong ? String(src.favSong).trim() : '',
    backTitle: src.backTitle,
    backSub: src.backSub,
    qr: src.qr !== false
  };
}

export function renderCard(t, data, opts = {}) {
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

export function getEffectiveStock(project, side) {
  const sm = project && project.sideMaterials;
  if (sm && sm[side] && sm[side] !== 'inherit') {
    return sm[side];
  }
  return (project && project.material) || 'matte';
}

export function buildCraftClassMap(project) {
  const craftClass = {};
  const rm = project && project.regionMaterials;
  if (rm && typeof rm === 'object') {
    Object.entries(rm).forEach(([regionKey, matId]) => {
      if (matId && matId !== 'none') {
        craftClass[regionKey] = `craft-${matId}`;
      }
    });
  }
  return craftClass;
}

export function renderElementHtml(el, project, interactive, selectedId) {
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
  if (el.rotate) {
    baseStyle.push(`transform:rotate(${Number(el.rotate)}deg)`);
  }

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
  } else if (el.type === 'shape') {
    baseStyle.push(`color:${el.color || project.accent || '#FF7600'}`);
    const shapeDef = SHAPES[el.shapeName] || SHAPES.line;
    inner = shapeDef.svg;
  } else if (el.type === 'image') {
    const img = (project.images || []).find((item) => item.id === el.imageId);
    inner = img
      ? `<img src="${escapeHtml(img.dataUrl)}" alt="自定义图片"/>`
      : '<div style="width:100%;height:100%;background:var(--gray-100);display:grid;place-items:center;font-size:3cqw;color:var(--gray-600);">图片</div>';
  } else if (el.type === 'qr') {
    const url = buildCardShareUrl(project);
    inner = `<div class="bcard__qr bcard__qr--real" style="width:100%;height:100%;" data-qr-url="${escapeHtml(url)}" aria-label="制作人名刺二维码">${renderQrSvg(url, { border: 2, fg: '#1D1E22', bg: '#FFFFFF' })}</div>`;
  }

  const handle =
    interactive && selectedId === el.id && !el.locked
      ? '<span class="bcard-el__handle" data-resize-handle="true"></span>'
      : '';

  return `<div class="${classes.join(' ')}" data-el-id="${escapeHtml(el.id)}" style="${escapeHtml(baseStyle.join(';'))}">${inner}${handle}</div>`;
}

export function renderFace(project, side, opts = {}) {
  const t = store.getTemplate(project.templateId);
  const dims = store.getDims(project);
  const interactive = Boolean(opts.interactive);
  const selectedId = opts.selectedId || null;
  const stock = getEffectiveStock(project, side);
  const craftClass = buildCraftClassMap(project);
  const qrUrl = buildCardShareUrl(project);
  const elements = project.canvas && project.canvas[side];

  if (!elements) {
    const f = project.fields || {};
    const data = {
      name: f.name,
      enName: f.enName,
      title: f.title,
      company: f.company,
      pid: f.pid,
      eventTag: f.eventTag,
      sns: { x: f.x, weibo: f.weibo, bilibili: f.bilibili, xhs: f.xhs },
      favSong: f.favSong,
      backTitle: f.backTitle,
      backSub: f.backSub,
      qr: f.qr !== false
    };

    return renderCard(t, data, {
      side,
      hideEmpty: true,
      dims,
      stock,
      corner: project.corner || 0,
      pattern: project.pattern || 'none',
      accent: project.accent || t.color,
      standee: project.standee,
      craftClass,
      qrUrl
    });
  }

  const decorHtml = renderCard(t, {}, {
    side,
    decorOnly: true,
    dims,
    stock,
    corner: project.corner || 0,
    pattern: project.pattern || 'none',
    accent: project.accent || t.color,
    standee: project.standee,
    craftClass,
    qrUrl
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
  if (node.classList.contains('bcard__pid')) return 'pid';
  if (node.classList.contains('bcard__event')) return 'eventTag';
  if (node.classList.contains('bcard__fav')) return 'favSong';
  if (node.classList.contains('bcard__back-jp')) return 'backTitle';
  if (node.classList.contains('bcard__sns-item')) return node.dataset.snsKey || 'x';
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

export function convertToElements(cardEl) {
  const face = cardEl ? cardEl.querySelector('.bcard__face') : null;
  if (!cardEl || !face) return [];
  const cardRect = face.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return [];

  const elements = [];
  const selectors =
    '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__pid, .bcard__event, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en';

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
    } else if (node.classList.contains('bcard__pid')) {
      text = node.textContent.replace(/^ID:\s*/, '').trim();
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
      rotate: 0,
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
      rotate: 0,
      craft: inferCraft(node),
      visible: true,
      locked: false,
      opacity: 1
    });
  });

  return elements;
}

export function fitText(root) {
  const container = root || document;
  const nodes = container.querySelectorAll('[data-fit]');
  nodes.forEach((el) => {
    if (!el.clientWidth) return;
    el.classList.remove('is-wrapped');
    el.style.fontSize = '';

    const computed = parseFloat(window.getComputedStyle(el).fontSize);
    if (!computed || Number.isNaN(computed)) return;

    const baseSize = computed;
    const minSize = Math.max(6.5, baseSize * 0.5);
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

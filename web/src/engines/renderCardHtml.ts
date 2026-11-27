import { getCardDims } from '../stores/useStudioStore';
import type {
  CanvasElement,
  CardProject,
  CardTemplate,
  EditableRegionId,
  SurfaceCraftId,
} from '../types/card';
import { renderQrSvg } from './qrcode';
import { buildCardShareUrl } from './shareCodec';

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function craftCls(craft: SurfaceCraftId | undefined): string {
  if (!craft || craft === 'none') return '';
  return ` craft-${craft}`;
}

function regCraft(project: CardProject, region: EditableRegionId): string {
  return craftCls(project.regionCrafts?.[region] || 'none');
}

export function resolveCardBgHex(project: CardProject): string {
  if (project.paper === 'black' || project.bgDark) return '#131620';
  if (project.paper === 'washi') return '#FAF6EE';
  if (project.paper === 'cotton') return '#FCFBF8';
  if (project.paper === 'pearl') return '#F8FAFC';
  if (project.paper === 'pvc') return '#EEF6FC';
  return '#FFFFFF';
}

function renderCustomElement(el: CanvasElement, project: CardProject): string {
  const rot = el.rotate ? `transform:rotate(${el.rotate}deg);` : '';
  const op = el.opacity != null ? `opacity:${el.opacity};` : '';
  const posStyle = `left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;${rot}${op}`;
  const cCls = craftCls(el.craft);

  if (el.type === 'text') {
    const fz = el.fontSize || 3.4;
    return `<div class="bcard-el bcard-el--text${cCls}" data-el-id="${esc(el.id)}" style="${posStyle}color:${esc(el.color || (project.bgDark ? '#F8FAFC' : '#0F172A'))};font-size:${fz}cqw;font-weight:${el.fontWeight || 700};">${esc(el.text || '')}</div>`;
  }
  if (el.type === 'image' && el.src) {
    return `<div class="bcard-el bcard-el--image${cCls}" data-el-id="${esc(el.id)}" style="${posStyle}border-radius:${el.radius || 4}px;overflow:hidden;"><img src="${esc(el.src)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"/></div>`;
  }
  if (el.type === 'qr') {
    const qrUrl = el.text || buildCardShareUrl(project);
    const svg = renderQrSvg(qrUrl, { fg: el.color || '#0F172A', bg: '#FFFFFF', border: 2 });
    return `<div class="bcard-el bcard-el--qr${cCls}" data-el-id="${esc(el.id)}" style="${posStyle}background:#fff;padding:4px;border-radius:6px;">${svg}</div>`;
  }
  const br = el.type === 'circle' ? '999px' : el.type === 'pill' ? '999px' : `${el.radius ?? 6}px`;
  return `<div class="bcard-el bcard-el--shape${cCls}" data-el-id="${esc(el.id)}" style="${posStyle}background:${esc(el.bg || project.color)};border-radius:${br};"></div>`;
}

export function renderCardFaceHtml(
  project: CardProject,
  template: CardTemplate,
  side: 'front' | 'back' = project.side,
): string {
  const dims = getCardDims(project);
  const f = project.fields;
  const orientClass = `bcard--${project.orient}`;
  const styleClass = `bcard--${template.style}`;
  const layoutClass = `layout--${template.layout || 'clean'}`;
  const stockClass = `stock-${project.paper}`;
  const darkClass = project.bgDark || project.paper === 'black' ? 'is-dark' : '';
  const roundedStyle = project.rounded ? 'border-radius: 14px;' : 'border-radius: 2px;';
  const shareUrl = buildCardShareUrl(project);
  const darkInk = project.bgDark || project.paper === 'black';
  const qrFg = darkInk ? '#0F172A' : '#0F172A';
  const qrMarkup = renderQrSvg(shareUrl, { fg: qrFg, bg: '#FFFFFF', border: 2 });

  const standee = project.standee;
  const standeeMarkup =
    side === 'front' && standee?.enabled && standee?.dataUrl
      ? `<div class="bcard__standee${craftCls(standee.craft)}" style="opacity:${(standee.opacity ?? 100) / 100};border-radius:${standee.radius ?? 8}px;"><img class="bcard__standee-img" src="${esc(standee.dataUrl)}" alt="artwork" style="object-fit:${standee.fit || 'contain'};transform:translate(${standee.offsetX || 0}%,${standee.offsetY || 0}%) scale(${(standee.scale || 100) / 100});"/></div>`
      : '';

  const sideElements = (project.customElements || [])
    .filter((el) => el.side === side)
    .map((el) => renderCustomElement(el, project))
    .join('');

  if (side === 'back') {
    return `
      <div class="bcard-frame" style="aspect-ratio:${dims.w} / ${dims.h};--brand:${esc(project.color)};--brand-accent:${esc(project.accent)};">
        <div class="bcard ${orientClass} ${styleClass} ${layoutClass} ${stockClass} ${darkClass}" style="${roundedStyle}">
          <div class="bcard__face bcard__face--back${regCraft(project, 'backBg')}">
            <div class="bcard__pattern"></div>
            <div class="bcard__ribbon${regCraft(project, 'decor')}"></div>
            <div class="bcard__back-inner">
              <div class="bcard__back-top">
                <div class="bcard__back-title${regCraft(project, 'backTitle')}">${esc(f.backTitle || 'CONNECT')}</div>
                <div class="bcard__back-sub">${esc(f.company || template.subtitle)}</div>
              </div>
              <div class="bcard__back-center">
                <div class="bcard__qr${regCraft(project, 'qr')}" data-qr-url="${esc(shareUrl)}">
                  ${qrMarkup}
                </div>
                <div class="bcard__back-meta">
                  <div class="bcard__back-name">${esc(f.name)}</div>
                  <div class="bcard__back-url">${esc(f.website || f.x || 'SCAN FOR DIGITAL CARD')}</div>
                  <div class="bcard__back-motto">${esc(f.motto)}</div>
                </div>
              </div>
              <div class="bcard__back-foot">
                <span>${esc(template.name)}</span>
                <span>${esc(f.codeTag)}</span>
              </div>
            </div>
            <div class="el-layer">${sideElements}</div>
          </div>
        </div>
      </div>
    `;
  }

  const snsRows = [
    f.x ? `<div class="bcard__sns-item${regCraft(project, 'x')}"><span class="bcard__sns-k">X</span><span>${esc(f.x)}</span></div>` : '',
    f.bilibili ? `<div class="bcard__sns-item${regCraft(project, 'bilibili')}"><span class="bcard__sns-k">B站</span><span>${esc(f.bilibili)}</span></div>` : '',
    f.weibo ? `<div class="bcard__sns-item${regCraft(project, 'weibo')}"><span class="bcard__sns-k">微博</span><span>${esc(f.weibo)}</span></div>` : '',
    f.xhs ? `<div class="bcard__sns-item${regCraft(project, 'xhs')}"><span class="bcard__sns-k">小红书</span><span>${esc(f.xhs)}</span></div>` : '',
    f.website ? `<div class="bcard__sns-item${regCraft(project, 'website')}"><span class="bcard__sns-k">WEB</span><span>${esc(f.website)}</span></div>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `
    <div class="bcard-frame" style="aspect-ratio:${dims.w} / ${dims.h};--brand:${esc(project.color)};--brand-accent:${esc(project.accent)};">
      <div class="bcard ${orientClass} ${styleClass} ${layoutClass} ${stockClass} ${darkClass}" style="${roundedStyle}">
        <div class="bcard__face bcard__face--front${regCraft(project, 'frontBg')}">
          <div class="bcard__pattern"></div>
          <div class="bcard__ribbon${regCraft(project, 'decor')}"></div>
          <div class="bcard__deco-frame${regCraft(project, 'decor')}"></div>
          ${standeeMarkup}
          <div class="bcard__content">
            <div class="bcard__head">
              <div class="bcard__company${regCraft(project, 'company')}">${esc(f.company)}</div>
              <div class="bcard__tags">
                ${f.codeTag ? `<span class="bcard__code${regCraft(project, 'codeTag')}">${esc(f.codeTag)}</span>` : ''}
                ${f.eventTag ? `<span class="bcard__event${regCraft(project, 'eventTag')}">${esc(f.eventTag)}</span>` : ''}
              </div>
            </div>
            <div class="bcard__identity">
              <div class="bcard__name${regCraft(project, 'name')}">${esc(f.name)}</div>
              ${f.enName ? `<div class="bcard__en${regCraft(project, 'enName')}">${esc(f.enName)}</div>` : ''}
              ${f.title ? `<div class="bcard__title${regCraft(project, 'title')}">${esc(f.title)}</div>` : ''}
            </div>
            <div class="bcard__bottom">
              <div class="bcard__sns">${snsRows}</div>
              ${f.motto ? `<div class="bcard__motto${regCraft(project, 'motto')}">${esc(f.motto)}</div>` : ''}
            </div>
          </div>
          <div class="el-layer">${sideElements}</div>
        </div>
      </div>
    </div>
  `;
}

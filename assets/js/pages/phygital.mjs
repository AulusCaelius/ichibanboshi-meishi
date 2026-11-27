/**
 * Phygital 实体 + 数字双栖视图逻辑 (v1.0)
 * 使用真实 ISO/IEC 18004 二维码与跨设备携参链接
 */

import * as store from '../core/store.mjs';
import { STYLE_BG, renderFace, fitText, escapeHtml } from '../core/card-render.mjs';
import { renderQrSvg } from '../core/qrcode.mjs';
import { buildCardShareUrl } from '../core/share-codec.mjs';
import { isServerConnected } from '../core/api-client.mjs';
import { bootCommon, showToast, debounce } from '../ui/common.mjs';

const LIGHT_ACCENTS = new Set(['#EAFDFF', '#7CFC00', '#F8C112', '#F6ADC6']);
const SNS_META = [
  { key: 'x', label: 'X (Twitter)' },
  { key: 'weibo', label: '微博' },
  { key: 'bilibili', label: 'B站' },
  { key: 'xhs', label: '小红书' }
];

let project = null;
let currentSide = 'front';
const dom = {};

function cacheDom() {
  dom.saveStatus = document.getElementById('phySaveStatus');
  dom.sideFront = document.getElementById('phySideFront');
  dom.sideBack = document.getElementById('phySideBack');
  dom.cardStage = document.getElementById('phyCardStage');
  dom.bioInput = document.getElementById('phyBioInput');
  dom.bioCount = document.getElementById('phyBioCount');
  dom.snsToggles = document.getElementById('phySnsToggles');
  dom.layoutChips = document.getElementById('phyLayoutChips');
  dom.phoneScreen = document.getElementById('h5PhoneScreen');
  dom.prefixLabel = document.getElementById('phyPrefixLabel');
  dom.slugInput = document.getElementById('phySlugInput');
  dom.copySlug = document.getElementById('phyCopySlug');
  dom.dlQrBtn = document.getElementById('phyDlQrBtn');
  dom.openH5 = document.getElementById('phyOpenH5');
  dom.qrSvg = document.getElementById('phyQrSvg');
  dom.statPv = document.getElementById('phyStatPv');
  dom.statSaves = document.getElementById('phyStatSaves');
  dom.trendLine = document.getElementById('phyTrendLine');
  dom.trendDot = document.getElementById('phyTrendDot');
}

function saveProject() {
  const t = store.save(project);
  if (dom.saveStatus) {
    dom.saveStatus.innerHTML = `<i class="ws-save-status__star" aria-hidden="true">✦</i> 已自动保存于 ${t}`;
  }
}

function getShareUrl() {
  if (isServerConnected()) {
    return `${window.location.origin}/p/${encodeURIComponent((project.h5 && project.h5.slug) || 'hatsuboshi-p')}`;
  }
  return buildCardShareUrl(project);
}

function renderPhysicalCard() {
  dom.sideFront.classList.toggle('is-active', currentSide === 'front');
  dom.sideBack.classList.toggle('is-active', currentSide === 'back');
  const showQrHighlight = currentSide === 'back' && (!project.fields || project.fields.qr !== false);
  dom.cardStage.classList.toggle('phy-qr-highlight', showQrHighlight);
  dom.cardStage.innerHTML = renderFace(project, currentSide);
  requestAnimationFrame(() => fitText(dom.cardStage));
}

function renderSnsToggles() {
  const f = project.fields || {};
  const show = (project.h5 && project.h5.show) || {};
  dom.snsToggles.innerHTML = SNS_META.map((item) => {
    const val = f[item.key] ? String(f[item.key]).trim() : '';
    const disabled = !val;
    const checked = !disabled && show[item.key] !== false;
    return `
      <div class="ws-switch-row" style="min-height:34px;">
        <span style="font-size:13px;color:${disabled ? 'var(--gray-300)' : 'var(--ink)'};">${escapeHtml(item.label)}${disabled ? '（未填）' : ''}</span>
        <button type="button" class="ws-switch" role="switch" aria-checked="${checked ? 'true' : 'false'}" data-h5-sns="${item.key}" ${disabled ? 'disabled' : ''}></button>
      </div>`;
  }).join('');
}

function renderH5Phone() {
  const f = project.fields || {};
  const h5 = project.h5 || { layout: 'card', bio: '', show: {} };
  const t = store.getTemplate(project.templateId);
  const accent = project.accent || t.color;
  const baseBg = STYLE_BG[t.style] || '#FFFFFF';
  const isLightHero = baseBg === '#FFFFFF' || baseBg === '#F6ADC6';
  const heroBg = isLightHero
    ? `linear-gradient(135deg, #FF7600 0%, ${accent} 100%)`
    : `linear-gradient(135deg, ${baseBg} 0%, color-mix(in srgb, ${accent} 62%, ${baseBg}) 100%)`;

  const isLightBadge = LIGHT_ACCENTS.has(accent.toUpperCase());
  const badgeStyle = isLightBadge
    ? `background:${accent};color:#333333;border:1px solid #BFBFBF;`
    : `background:${accent};color:#FFFFFF;`;

  const standeeSrc = (project.standee && project.standee.dataUrl) || (project.images && project.images[0] && project.images[0].dataUrl);
  const avatarInner = standeeSrc
    ? `<img src="${escapeHtml(standeeSrc)}" alt="${escapeHtml(f.name || '')}">`
    : escapeHtml((f.name || 'P').slice(0, 1));

  const activeSns = SNS_META.filter((item) => {
    const val = f[item.key] ? String(f[item.key]).trim() : '';
    return val && (!h5.show || h5.show[item.key] !== false);
  });

  dom.phoneScreen.className = `phone-screen h5--${h5.layout || 'card'}`;
  dom.phoneScreen.innerHTML = `
    <div class="h5-hero" style="background:${heroBg};">
      <div class="h5-avatar" style="background:${escapeHtml(accent)};">${avatarInner}</div>
      <div>
        <div class="h5-name">${escapeHtml(f.name || '制作人Producer')}</div>
        ${f.enName ? `<div class="h5-en">${escapeHtml(f.enName)}</div>` : ''}
        ${f.title ? `<span class="h5-tantou" style="${badgeStyle}">${escapeHtml(f.title)}</span>` : ''}
      </div>
    </div>
    <div class="h5-body">
      ${f.company ? `<div class="h5-company">${escapeHtml(f.company)}</div>` : ''}
      ${f.pid ? `<div style="font-size:11px;color:var(--gray-600);margin-bottom:4px;">P-ID: ${escapeHtml(f.pid)}</div>` : ''}
      ${h5.bio ? `<div class="h5-bio">${escapeHtml(h5.bio)}</div>` : ''}
      ${
        activeSns.length
          ? `<div class="h5-sns-grid">${activeSns
              .map(
                (s) => `
                <button type="button" class="h5-sns-btn" style="text-align:left;cursor:pointer;" data-copy-sns="${escapeHtml(String(f[s.key]).trim())}" data-sns-label="${escapeHtml(s.label)}">
                  <span>${escapeHtml(s.label)}</span>
                  <small>${escapeHtml(String(f[s.key]).trim())}</small>
                </button>`
              )
              .join('')}</div>`
          : ''
      }
      ${f.favSong ? `<div class="h5-fav">♪ 最爱曲目：${escapeHtml(f.favSong)}</div>` : ''}
      <button type="button" id="h5SaveVcfBtn" class="h5-save-btn">交换名刺 · 保存联系人</button>
    </div>
  `;

  dom.phoneScreen.querySelectorAll('[data-copy-sns]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.copySns;
      const label = btn.dataset.snsLabel;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => showToast(`已复制 ${label}：${val}`)).catch(() => showToast(`${label}：${val}`));
      } else {
        showToast(`${label}：${val}`);
      }
    });
  });

  const vcfBtn = document.getElementById('h5SaveVcfBtn');
  if (vcfBtn) vcfBtn.addEventListener('click', downloadVCard);
}

function renderRealQr() {
  const url = getShareUrl();
  dom.qrSvg.innerHTML = `<div style="width:68px;height:68px;background:#fff;border:1px solid var(--gray-100);padding:3px;border-radius:4px;">${renderQrSvg(url, { border: 1, fg: '#1D1E22', bg: '#FFFFFF' })}</div>`;
}

function renderStats() {
  const s = (project && project.stats) || { pv: 0, saves: 0, trend: [0, 0, 0, 0, 0, 0, 0] };
  dom.statPv.textContent = Number(s.pv || 0).toLocaleString();
  dom.statSaves.textContent = Number(s.saves || 0).toLocaleString();
  if (dom.trendLine && Array.isArray(s.trend) && s.trend.length) {
    const maxVal = Math.max(1, ...s.trend);
    const minVal = Math.min(...s.trend);
    const span = Math.max(1, maxVal - minVal);
    const pts = s.trend.map((v, idx) => {
      const x = Math.round(4 + (idx / Math.max(1, s.trend.length - 1)) * 102);
      const y = Math.round(30 - ((v - minVal) / span) * 22);
      return [x, y];
    });
    dom.trendLine.setAttribute('points', pts.map((p) => `${p[0]},${p[1]}`).join(' '));
    const last = pts[pts.length - 1];
    if (dom.trendDot && last) {
      dom.trendDot.setAttribute('cx', String(last[0]));
      dom.trendDot.setAttribute('cy', String(last[1]));
    }
  }
  if (dom.prefixLabel) {
    dom.prefixLabel.textContent = isServerConnected() ? `${window.location.origin}/p/` : 'card.html?slug=';
  }
  if (dom.openH5) {
    dom.openH5.href = getShareUrl();
  }
}

async function downloadVCard() {
  const f = project.fields || {};
  const xHandle = (f.x || '').replace(/^@/, '');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${f.name || '制作人Producer'}`,
    `ORG:${f.company || '初星学園'}`,
    `TITLE:${f.title || '〇〇担当'}`,
    xHandle ? `URL:https://x.com/${xHandle}` : `URL:${getShareUrl()}`,
    `NOTE:${f.favSong ? 'Favorite Song: ' + f.favSong : '一番星制作人名刺'}`,
    'END:VCARD'
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${f.name || '制作人Producer'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const updatedStats = await store.recordAnalytics(project.id, 'save');
  if (updatedStats) {
    project.stats = updatedStats;
    renderStats();
  }
  showToast(`已导出名刺通讯录：${a.download}`);
}

function bindEvents() {
  dom.sideFront.addEventListener('click', () => { currentSide = 'front'; renderPhysicalCard(); });
  dom.sideBack.addEventListener('click', () => { currentSide = 'back'; renderPhysicalCard(); });

  const onBioInput = debounce(() => {
    project.h5.bio = dom.bioInput.value;
    renderH5Phone();
    renderRealQr();
    renderStats();
    saveProject();
  }, 150);

  dom.bioInput.addEventListener('input', () => {
    dom.bioCount.textContent = `${dom.bioInput.value.length} / 60`;
    onBioInput();
  });

  dom.snsToggles.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-h5-sns]');
    if (!btn || btn.disabled) return;
    const k = btn.dataset.h5Sns;
    if (!project.h5.show) project.h5.show = {};
    project.h5.show[k] = btn.getAttribute('aria-checked') !== 'true';
    renderSnsToggles();
    renderH5Phone();
    renderRealQr();
    renderStats();
    saveProject();
  });

  dom.layoutChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-h5-layout]');
    if (!chip) return;
    project.h5.layout = chip.dataset['h5Layout'];
    dom.layoutChips.querySelectorAll('[data-h5-layout]').forEach((c) => c.classList.toggle('is-active', c === chip));
    renderH5Phone();
    renderRealQr();
    renderStats();
    saveProject();
  });

  dom.slugInput.addEventListener('input', () => {
    const clean = dom.slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (dom.slugInput.value !== clean) dom.slugInput.value = clean;
    project.h5.slug = clean || 'hatsuboshi-p';
    renderRealQr();
    renderStats();
    saveProject();
  });

  dom.copySlug.addEventListener('click', () => {
    const url = getShareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast('已复制真实 H5 分享链接 ✦')).catch(() => showToast(`分享链接：${url}`));
    } else {
      showToast(`分享链接：${url}`);
    }
  });

  if (dom.dlQrBtn) {
    dom.dlQrBtn.addEventListener('click', () => {
      const svg = renderQrSvg(getShareUrl(), { border: 3, fg: '#1D1E22', bg: '#FFFFFF' });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.h5.slug || 'hatsuboshi-p'}_QR.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已导出矢量二维码 (.svg) ✦');
    });
  }

  ['phyBackEditor', 'phyGoWorks', 'phyGoExport'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', saveProject);
  });

  const refreshExternalStats = () => {
    if (!project) return;
    const latest = store.findWorkBySlug(project.id);
    if (latest && latest.stats) {
      project.stats = latest.stats;
      renderStats();
    }
  };
  window.addEventListener('storage', refreshExternalStats);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshExternalStats(); });
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await bootCommon();
  project = store.initProject();
  dom.bioInput.value = project.h5.bio || '';
  dom.bioCount.textContent = `${dom.bioInput.value.length} / 60`;
  dom.slugInput.value = project.h5.slug || 'hatsuboshi-p';
  dom.layoutChips.querySelectorAll('[data-h5-layout]').forEach((c) => {
    c.classList.toggle('is-active', c.dataset['h5Layout'] === (project.h5.layout || 'card'));
  });
  renderPhysicalCard();
  renderSnsToggles();
  renderH5Phone();
  renderRealQr();
  renderStats();
  bindEvents();
  saveProject();
});

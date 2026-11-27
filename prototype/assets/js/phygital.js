/* ==========================================================
   Phygital 实体 + 数字双栖视图逻辑 (phygital.html)
   ========================================================== */

(function () {
  const { fitText, escapeHtml } = window.IchibanCard;
  const { showToast, debounce } = window.IchibanCommon;
  const store = window.IchibanStore;
  const renderer = window.IchibanProject;

  const LIGHT_ACCENTS = new Set(['#EAFDFF', '#7CFC00', '#F8C112', '#F6ADC6']);
  const SNS_META = [
    { key: 'x', label: 'X (Twitter)', urlPrefix: 'https://x.com/' },
    { key: 'weibo', label: '微博', urlPrefix: '' },
    { key: 'bilibili', label: 'B站', urlPrefix: '' },
    { key: 'xhs', label: '小红书', urlPrefix: '' }
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
    dom.slugInput = document.getElementById('phySlugInput');
    dom.copySlug = document.getElementById('phyCopySlug');
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

  function renderPhysicalCard() {
    dom.sideFront.classList.toggle('is-active', currentSide === 'front');
    dom.sideBack.classList.toggle('is-active', currentSide === 'back');

    const showQrHighlight = currentSide === 'back' && (!project.fields || project.fields.qr !== false);
    dom.cardStage.classList.toggle('phy-qr-highlight', showQrHighlight);
    dom.cardStage.innerHTML = renderer.renderFace(project, currentSide);
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
          <button
            type="button"
            class="ws-switch"
            role="switch"
            aria-checked="${checked ? 'true' : 'false'}"
            data-h5-sns="${item.key}"
            ${disabled ? 'disabled' : ''}
          ></button>
        </div>
      `;
    }).join('');
  }

  function renderH5Phone() {
    const f = project.fields || {};
    const h5 = project.h5 || { layout: 'card', bio: '', show: {} };
    const t = store.getTemplate(project.templateId);
    const accent = project.accent || t.color;
    const baseBg = renderer.STYLE_BG[t.style] || '#FFFFFF';
    const isLightHero = baseBg === '#FFFFFF' || baseBg === '#F6ADC6';
    const heroBg = isLightHero
      ? `linear-gradient(135deg, #FF7600 0%, ${accent} 100%)`
      : `linear-gradient(135deg, ${baseBg} 0%, color-mix(in srgb, ${accent} 62%, ${baseBg}) 100%)`;

    const isLightBadge = LIGHT_ACCENTS.has(accent.toUpperCase());
    const badgeStyle = isLightBadge
      ? `background:${accent};color:#333333;border:1px solid #BFBFBF;`
      : `background:${accent};color:#FFFFFF;`;

    const firstImg = project.images && project.images[0];
    const avatarInner = firstImg
      ? `<img src="${escapeHtml(firstImg.dataUrl)}" alt="${escapeHtml(f.name || '')}">`
      : escapeHtml((f.name || 'P').slice(0, 1));

    const activeSns = SNS_META.filter((item) => {
      const val = f[item.key] ? String(f[item.key]).trim() : '';
      return val && (!h5.show || h5.show[item.key] !== false);
    });

    const layoutClass = `h5--${h5.layout || 'card'}`;
    dom.phoneScreen.className = `phone-screen ${layoutClass}`;

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
        ${h5.bio ? `<div class="h5-bio">${escapeHtml(h5.bio)}</div>` : ''}
        ${
          activeSns.length
            ? `<div class="h5-sns-grid">${activeSns
                .map(
                  (s) => `
                  <button type="button" class="h5-sns-btn" style="text-align:left;cursor:pointer;" data-copy-sns="${escapeHtml(String(f[s.key]).trim())}" data-sns-label="${escapeHtml(s.label)}">
                    <span>${escapeHtml(s.label)}</span>
                    <small>${escapeHtml(String(f[s.key]).trim())}</small>
                  </button>
                `
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
          navigator.clipboard
            .writeText(val)
            .then(() => showToast(`已复制 ${label}：${val}`))
            .catch(() => showToast(`${label}：${val}`));
        } else {
          showToast(`${label}：${val}`);
        }
      });
    });

    const vcfBtn = document.getElementById('h5SaveVcfBtn');
    if (vcfBtn) {
      vcfBtn.addEventListener('click', downloadVCard);
    }
  }

  function renderStats() {
    const s = (project && project.stats) || { pv: 128, saves: 24, trend: [12, 18, 15, 26, 22, 31, 19] };
    if (dom.statPv) dom.statPv.textContent = Number(s.pv || 0).toLocaleString();
    if (dom.statSaves) dom.statSaves.textContent = Number(s.saves || 0).toLocaleString();
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
    if (dom.openH5) {
      const slug = (project && project.h5 && project.h5.slug) || 'hatsuboshi-p';
      dom.openH5.href = `card.html?slug=${encodeURIComponent(slug)}`;
    }
  }

  function downloadVCard() {
    const f = project.fields || {};
    const xHandle = (f.x || '').replace(/^@/, '');
    const noteParts = [];
    if (f.favSong) noteParts.push(`Favorite Song: ${f.favSong}`);
    if (project.h5 && project.h5.bio) noteParts.push(project.h5.bio);
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${f.name || '制作人Producer'}`,
      `ORG:${f.company || '初星学園'}`,
      `TITLE:${f.title || '〇〇担当'}`,
      xHandle ? `URL:https://x.com/${xHandle}` : `URL:https://ichiban.star/p/${(project.h5 && project.h5.slug) || 'hatsuboshi-p'}`,
      noteParts.length ? `NOTE:${noteParts.join(' | ')}` : 'NOTE:一番星制作人名刺',
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
    const updatedStats = store.recordAnalytics(project.id, 'save');
    if (updatedStats) {
      project.stats = updatedStats;
      renderStats();
    }
    showToast(`已导出联系人名片：${a.download}`);
  }

  function renderQrSvg(slug) {
    const str = slug || 'hatsuboshi-p';
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const size = 21;
    const cell = 3;
    const rects = [];

    function inFinder(r, c, fr, fc) {
      return r >= fr && r < fr + 7 && c >= fc && c < fc + 7;
    }
    function finderVal(r, c, fr, fc) {
      const dr = r - fr;
      const dc = c - fc;
      if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
      if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
      return false;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let on = false;
        if (inFinder(r, c, 0, 0)) on = finderVal(r, c, 0, 0);
        else if (inFinder(r, c, 0, size - 7)) on = finderVal(r, c, 0, size - 7);
        else if (inFinder(r, c, size - 7, 0)) on = finderVal(r, c, size - 7, 0);
        else {
          const bitSeed = (hash ^ (r * 31 + c * 17)) >>> 0;
          on = (bitSeed % 5) < 2;
        }
        if (on) {
          rects.push(`<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#333333"/>`);
        }
      }
    }

    dom.qrSvg.innerHTML = `<svg width="63" height="63" viewBox="0 0 63 63" style="background:#fff;border:1px solid var(--gray-100);padding:3px;border-radius:4px;" aria-label="示意二维码">${rects.join('')}</svg>`;
  }

  function bindEvents() {
    dom.sideFront.addEventListener('click', () => {
      currentSide = 'front';
      renderPhysicalCard();
    });
    dom.sideBack.addEventListener('click', () => {
      currentSide = 'back';
      renderPhysicalCard();
    });

    dom.bioInput.addEventListener(
      'input',
      debounce(() => {
        project.h5.bio = dom.bioInput.value.slice(0, 60);
        dom.bioCount.textContent = `${project.h5.bio.length} / 60`;
        renderH5Phone();
        saveProject();
      }, 100)
    );

    dom.snsToggles.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-h5-sns]');
      if (!btn || btn.disabled) return;
      const k = btn.dataset.h5Sns;
      if (!project.h5.show) project.h5.show = {};
      const next = btn.getAttribute('aria-checked') !== 'true';
      project.h5.show[k] = next;
      renderSnsToggles();
      renderH5Phone();
      saveProject();
    });

    dom.layoutChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-h5-layout]');
      if (!chip) return;
      project.h5.layout = chip.dataset['h5Layout'];
      dom.layoutChips.querySelectorAll('[data-h5-layout]').forEach((c) => {
        c.classList.toggle('is-active', c === chip);
      });
      renderH5Phone();
      saveProject();
    });

    dom.slugInput.addEventListener('input', () => {
      const clean = dom.slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (dom.slugInput.value !== clean) {
        dom.slugInput.value = clean;
      }
      project.h5.slug = clean || 'hatsuboshi-p';
      renderQrSvg(project.h5.slug);
      renderStats();
      saveProject();
    });

    dom.copySlug.addEventListener('click', () => {
      const url = `https://ichiban.star/p/${project.h5.slug || 'hatsuboshi-p'}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(url)
          .then(() => showToast(`已复制短链：${url}`))
          .catch(() => showToast(`请手动复制：${url}`));
      } else {
        showToast(`请手动复制：${url}`);
      }
    });

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
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshExternalStats();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    project = store.initProject();
    if (!project.h5) {
      project.h5 = { layout: 'card', bio: '', show: { x: true, weibo: true, bilibili: true, xhs: true }, slug: 'hatsuboshi-p' };
    }

    dom.bioInput.value = project.h5.bio || '';
    dom.bioCount.textContent = `${dom.bioInput.value.length} / 60`;
    dom.slugInput.value = project.h5.slug || 'hatsuboshi-p';

    dom.layoutChips.querySelectorAll('[data-h5-layout]').forEach((c) => {
      c.classList.toggle('is-active', c.dataset['h5Layout'] === (project.h5.layout || 'card'));
    });

    renderPhysicalCard();
    renderSnsToggles();
    renderH5Phone();
    renderQrSvg(project.h5.slug);
    renderStats();
    bindEvents();
    saveProject();
  });
})();

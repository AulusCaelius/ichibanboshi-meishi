/* ==========================================================
   独立 H5 电子名片落地页逻辑 (card.html)
   支持按 ?slug= 或 ?work= 渲染，并实时累加 PV 与通讯录保存次数
   ========================================================== */

(function () {
  const { fitText, escapeHtml } = window.IchibanCard;
  const { showToast } = window.IchibanCommon;
  const store = window.IchibanStore;
  const renderer = window.IchibanProject;

  const LIGHT_ACCENTS = new Set(['#EAFDFF', '#7CFC00', '#F8C112', '#F6ADC6']);
  const SNS_META = [
    { key: 'x', label: 'X (Twitter)' },
    { key: 'weibo', label: '微博' },
    { key: 'bilibili', label: 'B站' },
    { key: 'xhs', label: '小红书' }
  ];

  let project = null;

  const dom = {};

  function cacheDom() {
    dom.ambientBg = document.getElementById('liveAmbientBg');
    dom.mount = document.getElementById('liveH5Mount');
    dom.visitBadge = document.getElementById('liveVisitBadge');
    dom.flipBtn = document.getElementById('flipPhysicalBtn');
    dom.physicalModal = document.getElementById('physicalFlipModal');
    dom.physicalCloseBtn = document.getElementById('physicalCloseBtn');
    dom.physicalCompareMount = document.getElementById('physicalCompareMount');
  }

  function updateVisitBadge(stats) {
    const s = stats || (project && project.stats) || { pv: 1, saves: 0 };
    if (dom.visitBadge) {
      dom.visitBadge.textContent = `✦ 第 ${Number(s.pv || 1).toLocaleString()} 位来访制作人 · 已完成 ${Number(s.saves || 0).toLocaleString()} 次名刺交换`;
    }
  }

  function renderH5Card() {
    const f = project.fields || {};
    const h5 = project.h5 || { layout: 'card', bio: '', show: {} };
    const t = store.getTemplate(project.templateId);
    const accent = project.accent || t.color;
    const baseBg = renderer.STYLE_BG[t.style] || '#FFFFFF';
    const isLightHero = baseBg === '#FFFFFF' || baseBg === '#F6ADC6';
    const heroBg = isLightHero
      ? `linear-gradient(135deg, #FF7600 0%, ${accent} 100%)`
      : `linear-gradient(135deg, ${baseBg} 0%, color-mix(in srgb, ${accent} 62%, ${baseBg}) 100%)`;

    if (dom.ambientBg) {
      dom.ambientBg.style.background = `radial-gradient(circle at 22% 18%, ${accent} 0%, transparent 52%), radial-gradient(circle at 80% 78%, #FF7600 0%, transparent 48%)`;
    }

    document.title = `${f.name || '制作人Producer'} · 一番星电子名刺`;

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

    dom.mount.className = `phone-screen h5--${h5.layout || 'card'}`;
    dom.mount.innerHTML = `
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
                .map((s) => {
                  const val = String(f[s.key]).trim();
                  return `
                    <button type="button" class="h5-sns-btn" data-copy-sns="${escapeHtml(val)}" data-sns-label="${escapeHtml(s.label)}">
                      <span>${escapeHtml(s.label)}</span>
                      <small>${escapeHtml(val)}</small>
                    </button>
                  `;
                })
                .join('')}</div>`
            : ''
        }
        ${f.favSong ? `<div class="h5-fav">♪ 最爱曲目：${escapeHtml(f.favSong)}</div>` : ''}
        <button type="button" id="h5SaveVcfBtn" class="h5-save-btn">交换名刺 · 保存联系人 (.vcf)</button>
      </div>
    `;

    dom.mount.querySelectorAll('[data-copy-sns]').forEach((btn) => {
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
      updateVisitBadge(updatedStats);
    }
    showToast(`已保存联系人并完成名刺交换：${a.download} ✦`);
  }

  function openPhysicalModal() {
    dom.physicalCompareMount.innerHTML = `
      <div class="live-physical-slot">
        ${renderer.renderFace(project, 'front')}
        <span class="live-physical-label">实体正面</span>
      </div>
      <div class="live-physical-slot">
        ${renderer.renderFace(project, 'back')}
        <span class="live-physical-label">实体背面</span>
      </div>
    `;
    dom.physicalModal.classList.add('is-open');
    dom.physicalModal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => fitText(dom.physicalCompareMount));
  }

  function closePhysicalModal() {
    dom.physicalModal.classList.remove('is-open');
    dom.physicalModal.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    const params = new URLSearchParams(window.location.search);
    const slugOrWork = params.get('work') || params.get('slug') || '';
    project = store.findWorkBySlug(slugOrWork);

    if (params.get('notrack') !== '1') {
      const updated = store.recordAnalytics(project.id, 'pv');
      if (updated) project.stats = updated;
    }

    renderH5Card();
    updateVisitBadge(project.stats);

    dom.flipBtn.addEventListener('click', openPhysicalModal);
    dom.physicalCloseBtn.addEventListener('click', closePhysicalModal);
    dom.physicalModal.addEventListener('click', (e) => {
      if (e.target === dom.physicalModal) closePhysicalModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.physicalModal.classList.contains('is-open')) {
        closePhysicalModal();
      }
    });
  });
})();

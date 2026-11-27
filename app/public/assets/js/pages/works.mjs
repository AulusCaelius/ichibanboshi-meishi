/**
 * 我的作品管理台逻辑 (v1.0)
 */

import * as store from '../core/store.mjs';
import { renderFace, fitText, escapeHtml } from '../core/card-render.mjs';
import { bootCommon, showToast, openLoginModal } from '../ui/common.mjs';

let query = '';
let sortMode = 'recent';
let previewSide = 'front';
let renamingWorkId = null;

const dom = {};

function cacheDom() {
  dom.countNum = document.getElementById('worksCountNum');
  dom.pvNum = document.getElementById('worksPvNum');
  dom.savesNum = document.getElementById('worksSavesNum');
  dom.identityBtn = document.getElementById('worksIdentityBtn');
  dom.identityVal = document.getElementById('worksIdentityVal');
  dom.searchInput = document.getElementById('worksSearchInput');
  dom.importFileInput = document.getElementById('importWorkFileInput');
  dom.grid = document.getElementById('worksGrid');
  dom.empty = document.getElementById('worksEmpty');
  dom.renameModal = document.getElementById('renameModal');
  dom.renameForm = document.getElementById('renameForm');
  dom.renameInput = document.getElementById('renameInput');
  dom.renameCloseBtn = document.getElementById('renameCloseBtn');
  dom.renameCancelBtn = document.getElementById('renameCancelBtn');
}

function formatRelativeTime(ts) {
  if (!ts) return '刚刚';
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${store.formatTime(ts)}`;
}

function getCraftsSummary(work) {
  const active = [];
  const addLabel = (id) => {
    if (!id || id === 'none') return;
    const label = store.CRAFTS[id] ? store.CRAFTS[id].label : id;
    if (!active.includes(label)) active.push(label);
  };
  if (work.regionMaterials) Object.values(work.regionMaterials).forEach(addLabel);
  if (work.crafts) {
    Object.keys(store.CRAFTS).forEach((id) => {
      if (work.crafts[id]) addLabel(id);
    });
  }
  if (work.canvas) {
    ['front', 'back'].forEach((side) => {
      if (Array.isArray(work.canvas[side])) {
        work.canvas[side].forEach((el) => {
          if (el && el.visible !== false) addLabel(el.craft);
        });
      }
    });
  }
  return active;
}

function syncIdentity() {
  const user = store.getUser();
  if (dom.identityVal) {
    dom.identityVal.textContent = user
      ? `${user.name}${user.idol ? ' · ' + user.idol + '担当' : ''}`
      : '点击登录制作人身份 ✦';
  }
}

function exportWorkJsonFile(work) {
  const blob = new Blob([JSON.stringify(work, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${work.fileName || '一番星名刺'}.ichiban.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function render() {
  const allWorks = store.listWorks();
  const activeId = store.getActiveId();

  const totalPv = allWorks.reduce((sum, w) => sum + ((w.stats && w.stats.pv) || 0), 0);
  const totalSaves = allWorks.reduce((sum, w) => sum + ((w.stats && w.stats.saves) || 0), 0);

  dom.countNum.textContent = String(allWorks.length);
  dom.pvNum.textContent = totalPv.toLocaleString();
  dom.savesNum.textContent = totalSaves.toLocaleString();

  const q = query.trim().toLowerCase();
  const list = allWorks.filter((w) => {
    if (!q) return true;
    const t = store.getTemplate(w.templateId);
    const hay = [w.fileName, w.fields && w.fields.name, w.fields && w.fields.title, w.fields && w.fields.company, t && t.name, t && t.idol]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  if (sortMode === 'hot') list.sort((a, b) => ((b.stats && b.stats.pv) || 0) - ((a.stats && a.stats.pv) || 0));
  else list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!list.length) {
    dom.grid.innerHTML = '';
    dom.empty.hidden = false;
    return;
  }

  dom.empty.hidden = true;
  dom.grid.innerHTML = list
    .map((work) => {
      const t = store.getTemplate(work.templateId);
      const dims = store.getDims(work);
      const isCurrent = work.id === activeId;
      const crafts = getCraftsSummary(work);
      const slug = (work.h5 && work.h5.slug) || 'hatsuboshi-p';
      const pv = (work.stats && work.stats.pv) || 0;
      const saves = (work.stats && work.stats.saves) || 0;
      const specLabel = (store.SPECS[work.spec] && store.SPECS[work.spec].label) || `${dims.w}×${dims.h}`;

      return `
        <article class="work-card${isCurrent ? ' is-current-active' : ''}" data-work-id="${escapeHtml(work.id)}">
          ${isCurrent ? '<span class="work-card__active-ribbon">当前编辑中</span>' : ''}
          <div class="work-card__stage">${renderFace(work, previewSide)}</div>
          <div class="work-card__body">
            <div class="work-card__head">
              <h2 class="work-card__title">${escapeHtml(work.fileName || '未命名名刺方案')}</h2>
              <span class="work-card__time">${escapeHtml(formatRelativeTime(work.updatedAt))}</span>
            </div>

            <div class="work-card__meta-tags">
              <span class="work-tag">${escapeHtml(t.id)} · ${escapeHtml(t.idol)}</span>
              <span class="work-tag">${escapeHtml(specLabel)}</span>
              <span class="work-tag">${work.mode === 'canvas' ? '自由画布' : '极简表单'}</span>
              ${crafts.map((c) => `<span class="work-tag work-tag--craft">${escapeHtml(c)}</span>`).join('')}
            </div>

            <div class="work-card__stats">
              <span>PV <strong>${pv.toLocaleString()}</strong> · 保存 <strong>${saves.toLocaleString()}</strong></span>
              <a href="card.html?slug=${encodeURIComponent(slug)}" target="_blank" rel="noopener">H5 实机页 ↗</a>
            </div>

            <div class="work-card__actions">
              <a href="editor.html?work=${encodeURIComponent(work.id)}" class="work-btn-primary">继续编辑</a>
              <a href="phygital.html?work=${encodeURIComponent(work.id)}" class="work-btn-sub">Phygital</a>
              <a href="export.html?work=${encodeURIComponent(work.id)}" class="work-btn-sub">导出</a>
            </div>

            <div class="work-card__util-row">
              <button type="button" class="work-util-btn" data-act="rename" data-id="${escapeHtml(work.id)}">重命名</button>
              <button type="button" class="work-util-btn" data-act="duplicate" data-id="${escapeHtml(work.id)}">复制</button>
              <button type="button" class="work-util-btn" data-act="exportjson" data-id="${escapeHtml(work.id)}">备份工程</button>
              <button type="button" class="work-util-btn work-util-btn--danger" data-act="delete" data-id="${escapeHtml(work.id)}">删除</button>
            </div>
          </div>
        </article>`;
    })
    .join('');

  requestAnimationFrame(() => fitText(dom.grid));
}

function openRenameModal(work) {
  renamingWorkId = work.id;
  dom.renameInput.value = work.fileName || '';
  dom.renameModal.classList.add('is-open');
  dom.renameModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    dom.renameInput.focus();
    dom.renameInput.select();
  }, 40);
}

function closeRenameModal() {
  renamingWorkId = null;
  dom.renameModal.classList.remove('is-open');
  dom.renameModal.setAttribute('aria-hidden', 'true');
}

function bindEvents() {
  dom.identityBtn.addEventListener('click', openLoginModal);
  dom.searchInput.addEventListener('input', () => {
    query = dom.searchInput.value;
    render();
  });

  if (dom.importFileInput) {
    dom.importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imp = store.importWorkJson(text);
        showToast(`已导入工程方案：${imp.fileName} ✦`);
        render();
      } catch (err) {
        showToast(err.message || '工程文件解析失败');
      } finally {
        e.target.value = '';
      }
    });
  }

  document.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sortMode = btn.dataset.sort;
      document.querySelectorAll('[data-sort]').forEach((b) => b.classList.toggle('is-active', b === btn));
      render();
    });
  });

  document.querySelectorAll('[data-preview-side]').forEach((btn) => {
    btn.addEventListener('click', () => {
      previewSide = btn.dataset.previewSide;
      document.querySelectorAll('[data-preview-side]').forEach((b) => b.classList.toggle('is-active', b === btn));
      render();
    });
  });

  dom.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === 'duplicate') {
      const copy = store.duplicateWork(id);
      if (copy) {
        showToast(`已复制副本：${copy.fileName} ✦`);
        render();
      }
    } else if (act === 'rename') {
      const target = store.listWorks().find((w) => w.id === id);
      if (target) openRenameModal(target);
    } else if (act === 'exportjson') {
      const target = store.listWorks().find((w) => w.id === id);
      if (target) {
        exportWorkJsonFile(target);
        showToast(`已导出工程备份：${target.fileName}.ichiban.json`);
      }
    } else if (act === 'delete') {
      const target = store.listWorks().find((w) => w.id === id);
      const label = target ? target.fileName : '该方案';
      if (!window.confirm(`确认永久删除「${label}」？此操作不可撤销。`)) return;
      store.deleteWork(id);
      showToast(`已删除：${label}`);
      render();
    }
  });

  dom.renameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!renamingWorkId) return;
    const nextName = dom.renameInput.value.trim();
    if (!nextName) return;
    if (store.renameWork(renamingWorkId, nextName)) {
      showToast(`已重命名为：${nextName}`);
      closeRenameModal();
      render();
    }
  });

  dom.renameCloseBtn.addEventListener('click', closeRenameModal);
  dom.renameCancelBtn.addEventListener('click', closeRenameModal);
  dom.renameModal.addEventListener('click', (e) => { if (e.target === dom.renameModal) closeRenameModal(); });

  window.addEventListener('ichiban:auth-changed', () => {
    syncIdentity();
    render();
  });
  window.addEventListener('storage', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await bootCommon();
  syncIdentity();
  render();
  bindEvents();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fitText(dom.grid));
  }
});

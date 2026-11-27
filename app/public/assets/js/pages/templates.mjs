/**
 * 模板库页面逻辑 (v1.0)：128 套真模板 + 个人模板、关键词检索、收藏筛选、150ms 实时预填与分页
 */

import { IDOLS, POPULAR_ORDER, PLACEHOLDER, ACTIVE, LONG } from '../core/catalog.mjs';
import * as store from '../core/store.mjs';
import { renderCard, fitText, escapeHtml } from '../core/card-render.mjs';
import { bootCommon, showToast, debounce } from '../ui/common.mjs';

const PAGE_SIZE = 24;

const state = {
  prefill: { name: '', title: '', company: '' },
  previewOn: false,
  manualOff: false,
  accent: '',
  filters: {
    style: 'all',
    orient: 'all',
    sides: 'all',
    tantou: '',
    craft: 'all',
    favOnly: false,
    query: '',
    sort: 'popular'
  },
  visibleCount: PAGE_SIZE,
  loading: true,
  permanentSkeleton: false
};

let highlightedIndex = -1;
const el = {};

function cacheDom() {
  el.totalBadge = document.getElementById('tplTotalBadge');
  el.nameInput = document.getElementById('inputName');
  el.titleInput = document.getElementById('inputTitle');
  el.companyInput = document.getElementById('inputCompany');
  el.dropdown = document.getElementById('idolDropdown');
  el.toggleBtn = document.getElementById('previewToggle');
  el.clearBtn = document.getElementById('prefillClear');
  el.searchInput = document.getElementById('tplSearchInput');
  el.favChip = document.getElementById('filterFavChip');
  el.grid = document.getElementById('tplGrid');
  el.emptyState = document.getElementById('tplEmptyState');
  el.emptyReset = document.getElementById('emptyResetBtn');
  el.matchCount = document.getElementById('matchCount');
  el.sortSelect = document.getElementById('sortSelect');
  el.tantouDots = document.getElementById('tantouDots');
  el.filterReset = document.getElementById('filterResetBtn');
  el.loadMoreBtn = document.getElementById('loadMoreBtn');
  el.loadMoreWrap = document.getElementById('loadMoreWrap');
  el.modal = document.getElementById('previewModal');
  el.modalClose = document.getElementById('previewModalClose');
  el.modalTitle = document.getElementById('previewModalTitle');
  el.modalCards = document.getElementById('previewModalCards');
  el.modalMeta = document.getElementById('previewModalMeta');
}

function getCatalog() {
  return store.getAllTemplates();
}

function hasAnyPrefill() {
  return Boolean(state.prefill.name.trim() || state.prefill.title.trim() || state.prefill.company.trim());
}

function detectAccentFromTitle(titleStr) {
  const val = (titleStr || '').trim();
  if (!val) return '';
  const matched = IDOLS.find((idol) => val.includes(idol.name));
  return matched ? matched.color : '';
}

function renderTantouDots() {
  if (!el.tantouDots) return;
  el.tantouDots.innerHTML = IDOLS.map((idol) => {
    const lightCls = idol.color.toUpperCase() === '#EAFDFF' ? ' tantou-dot--light' : '';
    const activeCls = state.filters.tantou.toUpperCase() === idol.color.toUpperCase() ? ' is-active' : '';
    return `
      <button type="button" class="tantou-dot${lightCls}${activeCls}" data-tantou-color="${escapeHtml(idol.color)}" aria-label="筛选 ${escapeHtml(idol.name)} 担当色" aria-pressed="${activeCls ? 'true' : 'false'}">
        <span class="tantou-dot__circle" style="--dot-color:${escapeHtml(idol.color)}">${activeCls ? '✓' : ''}</span>
        <span class="tantou-dot__tip">${escapeHtml(idol.name)}</span>
      </button>`;
  }).join('');
}

function renderDropdown(query) {
  if (!el.dropdown) return;
  const q = (query || '').trim().replace(/担当$/g, '');
  const list = q ? IDOLS.filter((i) => i.name.includes(q) || i.initial.includes(q)) : IDOLS;
  highlightedIndex = -1;

  if (!list.length) {
    el.dropdown.innerHTML = '<div style="padding:10px 14px;font-size:13px;color:var(--gray-600);">未找到匹配偶像，可直接输入自定义担当</div>';
    return;
  }

  el.dropdown.innerHTML = list
    .map(
      (idol, idx) => `
      <button type="button" id="idolOption-${idx}" class="combobox-option" role="option" data-idol-name="${escapeHtml(idol.name)}" data-idol-color="${escapeHtml(idol.color)}" data-idx="${idx}">
        <span class="combobox-option__avatar" style="background:${escapeHtml(idol.color)};${idol.light ? 'color:#333;border:1px solid #BFBFBF;' : ''}">${escapeHtml(idol.initial)}</span>
        <span class="combobox-option__dot" style="background:${escapeHtml(idol.color)}"></span>
        <span>${escapeHtml(idol.name)}</span>
        <span class="combobox-option__suffix">担当</span>
      </button>`
    )
    .join('');
}

function openDropdown() {
  renderDropdown(el.titleInput.value);
  el.dropdown.classList.add('is-open');
  el.titleInput.setAttribute('aria-expanded', 'true');
}

function closeDropdown() {
  el.dropdown.classList.remove('is-open');
  el.titleInput.setAttribute('aria-expanded', 'false');
  el.titleInput.removeAttribute('aria-activedescendant');
  highlightedIndex = -1;
}

function selectIdol(name, color) {
  const filled = `${name}担当`;
  el.titleInput.value = filled;
  state.prefill.title = filled;
  state.accent = color;
  closeDropdown();

  const wasOn = state.previewOn;
  if (!state.manualOff) state.previewOn = true;
  syncToggleUI();
  renderGrid(true);
  if (!wasOn && state.previewOn) {
    showToast(`已为 ${getCatalog().length} 套模板应用你的信息 ✦`);
  }
}

function syncToggleUI() {
  if (el.toggleBtn) el.toggleBtn.setAttribute('aria-checked', state.previewOn ? 'true' : 'false');
}

function syncFilterChipsUI() {
  document.querySelectorAll('[data-filter-style]').forEach((chip) => {
    const on = chip.dataset.filterStyle === state.filters.style;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  if (el.favChip) {
    el.favChip.classList.toggle('is-active', state.filters.favOnly);
    el.favChip.setAttribute('aria-pressed', state.filters.favOnly ? 'true' : 'false');
  }

  document.querySelectorAll('[data-filter-layout]').forEach((chip) => {
    const type = chip.dataset.filterLayout;
    let on = false;
    if (type === 'all') on = state.filters.orient === 'all' && state.filters.sides === 'all';
    else if (['h', 'v', 's'].includes(type)) on = state.filters.orient === type;
    else if (type === '1' || type === '2') on = String(state.filters.sides) === type;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  document.querySelectorAll('[data-filter-craft]').forEach((chip) => {
    const on = chip.dataset.filterCraft === state.filters.craft;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  if (el.sortSelect) el.sortSelect.value = state.filters.sort;
  renderTantouDots();
}

function getFilteredCatalog() {
  const { style, orient, sides, tantou, craft, favOnly, query, sort } = state.filters;
  const favSet = new Set(store.getFavorites());
  const q = query.trim().toLowerCase();

  const list = getCatalog().filter((t) => {
    if (favOnly && !favSet.has(t.id)) return false;
    if (style !== 'all' && t.style !== style) return false;
    if (orient !== 'all' && t.orient !== orient) return false;
    if (sides !== 'all' && String(t.sides) !== String(sides)) return false;
    if (tantou && t.color.toUpperCase() !== tantou.toUpperCase()) return false;
    if (craft !== 'all') {
      if (craft === '无工艺') {
        if (!String(t.craft || '').includes('无工艺')) return false;
      } else if (!String(t.craft || '').includes(craft)) {
        return false;
      }
    }
    if (q) {
      const hay = `${t.id} ${t.name} ${t.jp} ${t.idol} ${t.styleLabel} ${t.craft}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const baseNum = (id) => {
    const m = String(id).match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  };

  if (sort === 'newest') {
    list.sort((a, b) => (b.isCustom ? 1 : 0) - (a.isCustom ? 1 : 0) || baseNum(b.id) - baseNum(a.id));
  } else {
    const rank = (t) => {
      if (t.isCustom) return -1;
      const idx = POPULAR_ORDER.indexOf(t.id);
      return idx === -1 ? 50 + baseNum(t.id) : idx;
    };
    list.sort((a, b) => rank(a) - rank(b));
  }
  return list;
}

function getCardRenderData() {
  if (!state.previewOn) return { data: PLACEHOLDER, accent: '' };
  return {
    data: {
      name: state.prefill.name.trim() || PLACEHOLDER.name,
      title: state.prefill.title.trim() || PLACEHOLDER.title,
      company: state.prefill.company.trim() || PLACEHOLDER.company,
      sns: ACTIVE.sns
    },
    accent: state.accent
  };
}

function renderSkeletons(count, append) {
  const html = Array.from({ length: count })
    .map(
      () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-card__stage"></div>
        <div class="skeleton-card__meta">
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
      </div>`
    )
    .join('');
  if (append) el.grid.insertAdjacentHTML('beforeend', html);
  else {
    el.grid.innerHTML = html;
    el.emptyState.hidden = true;
  }
}

function renderBadges(badges) {
  if (!badges || !badges.length) return '';
  return badges
    .map((b) => {
      const cls = b === 'NEW' ? 'badge--new' : b === 'HOT' ? 'badge--hot' : 'badge--foil';
      return `<span class="badge ${cls}">${escapeHtml(b)}</span>`;
    })
    .join('');
}

function renderGrid(withTransitionFlash) {
  if (el.totalBadge) el.totalBadge.textContent = `共 ${getCatalog().length} 套模板`;
  if (state.loading) {
    renderSkeletons(8, false);
    return;
  }

  const list = getFilteredCatalog();
  el.matchCount.textContent = `已匹配 ${list.length} 套`;

  if (!list.length) {
    el.grid.innerHTML = '';
    el.emptyState.hidden = false;
    el.loadMoreWrap.hidden = true;
    return;
  }

  const slice = list.slice(0, state.visibleCount);
  el.emptyState.hidden = true;
  el.loadMoreWrap.hidden = slice.length >= list.length;
  if (el.loadMoreBtn) {
    el.loadMoreBtn.disabled = false;
    el.loadMoreBtn.querySelector('.btn-more__inner').innerHTML =
      `<span class="btn-more__zh">加载更多 (余 ${list.length - slice.length} 套)</span> MORE <span class="btn-more__arrow" aria-hidden="true">→</span>`;
  }

  const { data, accent } = getCardRenderData();

  el.grid.innerHTML = slice
    .map((t) => {
      const isFav = store.isFavorite(t.id);
      return `
      <article class="tpl-card" data-tpl-id="${escapeHtml(t.id)}">
        <div class="tpl-card__stage stage-backdrop${withTransitionFlash ? ' is-updating is-updated' : ''}">
          <button type="button" class="tpl-card__fav-btn${isFav ? ' is-fav' : ''}" data-fav-tpl="${escapeHtml(t.id)}" aria-label="收藏模板 ${escapeHtml(t.name)}" title="收藏模板">★</button>
          <div class="tpl-card__badges">${renderBadges(t.badges)}</div>
          ${renderCard(t, data, { accent })}
          <div class="tpl-card__overlay">
            <button type="button" class="tpl-card__use-btn" data-use-tpl="${escapeHtml(t.id)}">使用此模板</button>
            <button type="button" class="tpl-card__zoom-btn" data-zoom-tpl="${escapeHtml(t.id)}" aria-label="放大预览 ${escapeHtml(t.name)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="tpl-card__footer">
          <div>
            <div class="tpl-card__name">${escapeHtml(t.name)}</div>
            <div class="tpl-card__jp">${escapeHtml(t.jp)} · ${escapeHtml(t.idol)}</div>
          </div>
          <div class="tpl-card__tags">
            <span class="tpl-card__tag">${escapeHtml(t.styleLabel)}</span>
            <span class="tpl-card__tag">${escapeHtml(t.layoutLabel)}</span>
          </div>
        </div>
      </article>`;
    })
    .join('');

  requestAnimationFrame(() => {
    fitText(el.grid);
    if (withTransitionFlash) {
      setTimeout(() => {
        el.grid.querySelectorAll('.tpl-card__stage.is-updating').forEach((s) => s.classList.remove('is-updating'));
      }, 200);
      setTimeout(() => {
        el.grid.querySelectorAll('.tpl-card__stage.is-updated').forEach((s) => s.classList.remove('is-updated'));
      }, 550);
    }
  });
}

function openPreviewModal(tplId) {
  const t = getCatalog().find((item) => item.id === tplId);
  if (!t || !el.modal) return;
  const { data, accent } = getCardRenderData();
  el.modalTitle.textContent = `${t.name} · ${t.jp}`;

  if (t.sides === 2) {
    el.modalCards.innerHTML = `
      <div><div class="preview-modal__side-label">正面 FRONT</div>${renderCard(t, data, { accent, forceSingle: true })}</div>
      <div><div class="preview-modal__side-label">背面 BACK</div>${renderCard(t, data, { accent, back: true })}</div>`;
  } else {
    el.modalCards.innerHTML = `<div><div class="preview-modal__side-label">单面 FRONT</div>${renderCard(t, data, { accent, forceSingle: true })}</div>`;
  }

  el.modalMeta.innerHTML = `
    <div><dt>担当偶像</dt><dd>${escapeHtml(t.idol)}（${escapeHtml(t.color)}）</dd></div>
    <div><dt>风格与版式</dt><dd>${escapeHtml(t.styleLabel)} · ${escapeHtml(t.layoutLabel)} · ${escapeHtml(t.craft)}</dd></div>
    <div><dt>人物印象 / 性格</dt><dd>${escapeHtml(t.persona)}</dd></div>
    <div><dt>命名灵感</dt><dd>${escapeHtml(t.inspiration)}</dd></div>
  `;
  el.modal.classList.add('is-open');
  el.modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => fitText(el.modalCards));
}

function closePreviewModal() {
  if (!el.modal) return;
  el.modal.classList.remove('is-open');
  el.modal.setAttribute('aria-hidden', 'true');
}

function handlePrefillInput() {
  state.prefill.name = el.nameInput.value;
  state.prefill.title = el.titleInput.value;
  state.prefill.company = el.companyInput.value;
  state.accent = detectAccentFromTitle(state.prefill.title);

  const anyFilled = hasAnyPrefill();
  const wasOn = state.previewOn;
  if (!anyFilled) {
    state.manualOff = false;
    state.previewOn = false;
  } else if (!state.manualOff) {
    state.previewOn = true;
  }
  syncToggleUI();
  renderGrid(true);
  if (!wasOn && state.previewOn) {
    showToast(`已为 ${getCatalog().length} 套模板应用你的信息 ✦`);
  }
}

function resetAllFilters() {
  state.filters = { style: 'all', orient: 'all', sides: 'all', tantou: '', craft: 'all', favOnly: false, query: '', sort: 'popular' };
  state.visibleCount = PAGE_SIZE;
  if (el.searchInput) el.searchInput.value = '';
  syncFilterChipsUI();
  renderGrid(false);
}

function bindEvents() {
  const debouncedInput = debounce(handlePrefillInput, 150);

  [el.nameInput, el.titleInput, el.companyInput].forEach((input) => {
    input.addEventListener('input', () => {
      if (input === el.titleInput) {
        renderDropdown(input.value);
        el.dropdown.classList.add('is-open');
      }
      debouncedInput();
    });
  });

  el.titleInput.addEventListener('focus', openDropdown);
  el.titleInput.addEventListener('click', openDropdown);
  el.titleInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (!document.activeElement || !document.activeElement.closest('.combobox-wrap')) closeDropdown();
    }, 150);
  });

  el.titleInput.addEventListener('keydown', (e) => {
    const options = Array.from(el.dropdown.querySelectorAll('.combobox-option'));
    if (!options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!el.dropdown.classList.contains('is-open')) openDropdown();
      highlightedIndex = (highlightedIndex + 1) % options.length;
      options.forEach((opt, i) => opt.classList.toggle('is-highlighted', i === highlightedIndex));
      el.titleInput.setAttribute('aria-activedescendant', options[highlightedIndex].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + options.length) % options.length;
      options.forEach((opt, i) => opt.classList.toggle('is-highlighted', i === highlightedIndex));
      el.titleInput.setAttribute('aria-activedescendant', options[highlightedIndex].id);
    } else if (e.key === 'Enter' && el.dropdown.classList.contains('is-open') && highlightedIndex >= 0) {
      e.preventDefault();
      const opt = options[highlightedIndex];
      selectIdol(opt.dataset.idolName, opt.dataset.idolColor);
    } else if (e.key === 'Escape') closeDropdown();
  });

  el.dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.combobox-option');
    if (opt) selectIdol(opt.dataset.idolName, opt.dataset.idolColor);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.combobox-wrap')) closeDropdown();
  });

  document.querySelectorAll('[data-quick-company]').forEach((chip) => {
    chip.addEventListener('click', () => {
      el.companyInput.value = chip.dataset.quickCompany;
      handlePrefillInput();
    });
  });

  el.toggleBtn.addEventListener('click', () => {
    const next = !state.previewOn;
    state.previewOn = next;
    state.manualOff = !next;
    syncToggleUI();
    renderGrid(true);
    if (next) showToast(`已为 ${getCatalog().length} 套模板应用你的信息 ✦`);
  });

  el.clearBtn.addEventListener('click', () => {
    el.nameInput.value = '';
    el.titleInput.value = '';
    el.companyInput.value = '';
    state.prefill = { name: '', title: '', company: '' };
    state.accent = '';
    state.previewOn = false;
    state.manualOff = false;
    syncToggleUI();
    renderGrid(true);
  });

  if (el.searchInput) {
    el.searchInput.addEventListener('input', debounce(() => {
      state.filters.query = el.searchInput.value;
      state.visibleCount = PAGE_SIZE;
      renderGrid(false);
    }, 120));
  }

  if (el.favChip) {
    el.favChip.addEventListener('click', () => {
      state.filters.favOnly = !state.filters.favOnly;
      state.visibleCount = PAGE_SIZE;
      syncFilterChipsUI();
      renderGrid(false);
    });
  }

  document.querySelectorAll('[data-filter-style]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filters.style = chip.dataset.filterStyle;
      state.visibleCount = PAGE_SIZE;
      syncFilterChipsUI();
      renderGrid(false);
    });
  });

  document.querySelectorAll('[data-filter-layout]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.filterLayout;
      if (val === 'all') {
        state.filters.orient = 'all';
        state.filters.sides = 'all';
      } else if (['h', 'v', 's'].includes(val)) {
        state.filters.orient = state.filters.orient === val ? 'all' : val;
      } else if (val === '1' || val === '2') {
        state.filters.sides = state.filters.sides === val ? 'all' : val;
      }
      state.visibleCount = PAGE_SIZE;
      syncFilterChipsUI();
      renderGrid(false);
    });
  });

  document.querySelectorAll('[data-filter-craft]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filters.craft = chip.dataset.filterCraft;
      state.visibleCount = PAGE_SIZE;
      syncFilterChipsUI();
      renderGrid(false);
    });
  });

  el.tantouDots.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-tantou-color]');
    if (!dot) return;
    const color = dot.dataset.tantouColor;
    state.filters.tantou = state.filters.tantou.toUpperCase() === color.toUpperCase() ? '' : color;
    state.visibleCount = PAGE_SIZE;
    syncFilterChipsUI();
    renderGrid(false);
  });

  el.sortSelect.addEventListener('change', () => {
    state.filters.sort = el.sortSelect.value;
    renderGrid(false);
  });

  el.filterReset.addEventListener('click', resetAllFilters);
  el.emptyReset.addEventListener('click', resetAllFilters);

  el.grid.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav-tpl]');
    if (favBtn) {
      e.stopPropagation();
      const tplId = favBtn.dataset.favTpl;
      const nowFav = store.toggleFavorite(tplId);
      favBtn.classList.toggle('is-fav', nowFav);
      showToast(nowFav ? '已收藏该模板 ★' : '已取消收藏');
      if (state.filters.favOnly) renderGrid(false);
      return;
    }

    const useBtn = e.target.closest('[data-use-tpl]');
    if (useBtn) {
      const tplId = useBtn.dataset.useTpl || 'T12';
      if (state.previewOn) {
        store.writePrefill({
          name: state.prefill.name.trim(),
          title: state.prefill.title.trim(),
          company: state.prefill.company.trim(),
          accent: state.accent || ''
        });
      } else {
        store.writePrefill(null);
      }
      window.location.href = `editor.html?template=${encodeURIComponent(tplId)}&new=1`;
      return;
    }

    const zoomBtn = e.target.closest('[data-zoom-tpl]');
    if (zoomBtn) openPreviewModal(zoomBtn.dataset.zoomTpl);
  });

  el.modalClose.addEventListener('click', closePreviewModal);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closePreviewModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.modal.classList.contains('is-open')) closePreviewModal();
  });

  el.loadMoreBtn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderGrid(false);
  });

  window.addEventListener('resize', debounce(() => fitText(document), 150));
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const urlState = params.get('state');
  const highlightId = params.get('highlight');

  if (urlState === 'loading') {
    state.permanentSkeleton = true;
    state.loading = true;
    renderSkeletons(8, false);
    return;
  }

  setTimeout(() => {
    state.loading = false;
    if (urlState === 'active') {
      el.nameInput.value = ACTIVE.name;
      el.titleInput.value = ACTIVE.title;
      el.companyInput.value = ACTIVE.company;
      state.prefill = { name: ACTIVE.name, title: ACTIVE.title, company: ACTIVE.company };
      state.accent = '#E30F25';
      state.previewOn = true;
      syncToggleUI();
      renderGrid(true);
      showToast(`已为 ${getCatalog().length} 套模板应用你的信息 ✦`);
    } else if (urlState === 'long') {
      el.nameInput.value = LONG.name;
      el.titleInput.value = LONG.title;
      el.companyInput.value = LONG.company;
      state.prefill = { name: LONG.name, title: LONG.title, company: LONG.company };
      state.accent = '#E30F25';
      state.previewOn = true;
      syncToggleUI();
      renderGrid(true);
    } else if (urlState === 'empty') {
      state.filters.style = 'formal';
      state.filters.orient = 's';
      state.filters.craft = '镭射覆膜';
      syncFilterChipsUI();
      renderGrid(false);
    } else {
      renderGrid(false);
    }

    if (highlightId) {
      requestAnimationFrame(() => {
        const targetCard = el.grid.querySelector(`.tpl-card[data-tpl-id="${CSS.escape(highlightId)}"]`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.classList.add('is-highlight');
          setTimeout(() => targetCard.classList.remove('is-highlight'), 2400);
        }
      });
    }
  }, 180);
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  renderTantouDots();
  syncToggleUI();
  syncFilterChipsUI();
  renderSkeletons(8, false);
  await bootCommon();
  bindEvents();
  applyUrlState();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fitText(document));
  }
});

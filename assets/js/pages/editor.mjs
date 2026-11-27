/**
 * 编辑器交互核心逻辑 (v1.0)
 * 完整支持：极简表单（含立绘上传构图、P-ID/活动印记、背面自定义、单双面、16区域自由材质）
 *          + 自由画布（旋转、6向对齐、图形库、Cmd+C/V 复制粘贴、图层上下置顶、非破坏性切换备份）
 *          + Three.js WebGL 真实物理材质 3D 预览 + 存为个人模板
 */

import { IDOLS, TEMPLATES } from '../core/catalog.mjs';
import * as store from '../core/store.mjs';
import {
  ICONS,
  ICON_LABELS,
  SHAPES,
  STYLE_BG,
  renderCard,
  renderFace,
  convertToElements,
  fitText,
  escapeHtml
} from '../core/card-render.mjs';
import { mount3D } from '../core/preview3d.mjs';
import { apiUploadImage, isServerConnected } from '../core/api-client.mjs';
import { bootCommon, showToast, debounce } from '../ui/common.mjs';

let project = null;
let selectedId = null;
let clipboardEl = null;
let selectedRegion = 'name';
let activeToolTab = 'templates';
let zoom = 1;
let fitScale = 4;
let thumb3d = null;
let modal3d = null;
let historyTimer = null;
let highlightedIdolIdx = -1;

const dom = {};

function cacheDom() {
  dom.fileNameInput = document.getElementById('fileNameInput');
  dom.undoBtn = document.getElementById('undoBtn');
  dom.redoBtn = document.getElementById('redoBtn');
  dom.saveStatus = document.getElementById('saveStatus');
  dom.modeFormBtn = document.getElementById('modeFormBtn');
  dom.modeCanvasBtn = document.getElementById('modeCanvasBtn');
  dom.sidesDoubleBtn = document.getElementById('sidesDoubleBtn');
  dom.sidesSingleBtn = document.getElementById('sidesSingleBtn');
  dom.sideFrontBtn = document.getElementById('sideFrontBtn');
  dom.sideBackBtn = document.getElementById('sideBackBtn');
  dom.saveAsTplBtn = document.getElementById('saveAsTplBtn');
  dom.formPanel = document.getElementById('formPanel');
  dom.restoreCanvasBanner = document.getElementById('restoreCanvasBanner');
  dom.restoreCanvasBtn = document.getElementById('restoreCanvasBtn');
  dom.canvasPanel = document.getElementById('canvasPanel');
  dom.toolDrawer = document.getElementById('toolDrawer');
  dom.canvasStage = document.getElementById('canvasStage');
  dom.canvasBleed = document.getElementById('canvasBleed');
  dom.canvasTrim = document.getElementById('canvasTrim');
  dom.canvasCardMount = document.getElementById('canvasCardMount');
  dom.guideBleed = document.getElementById('guideBleed');
  dom.guideTrim = document.getElementById('guideTrim');
  dom.guideSafe = document.getElementById('guideSafe');
  dom.snapLines = document.getElementById('snapLines');
  dom.specSelect = document.getElementById('specSelect');
  dom.cornerSelect = document.getElementById('cornerSelect');
  dom.statusLeft = document.getElementById('canvasStatusLeft');
  dom.zoomSlider = document.getElementById('zoomSlider');
  dom.zoomLabel = document.getElementById('zoomLabel');
  dom.zoomFitBtn = document.getElementById('zoomFitBtn');
  dom.materialSwatches = document.getElementById('materialSwatches');
  dom.craftChips = document.getElementById('craftChips');
  dom.propPanel = document.getElementById('propPanel');
  dom.layerPanel = document.getElementById('layerPanel');
  dom.modal3d = document.getElementById('modal3d');
  dom.modal3dTags = document.getElementById('modal3dTags');
  dom.autoRotateToggle = document.getElementById('autoRotateToggle');

  // Standee controls
  dom.standeeThumb = document.getElementById('standeeThumb');
  dom.standeeUploadInput = document.getElementById('standeeUploadInput');
  dom.standeeResetBtn = document.getElementById('standeeResetBtn');
  dom.standeeControlsWrap = document.getElementById('standeeControlsWrap');
  dom.standeeScaleSlider = document.getElementById('standeeScaleSlider');
  dom.standeeOffsetXSlider = document.getElementById('standeeOffsetXSlider');
  dom.standeeOffsetYSlider = document.getElementById('standeeOffsetYSlider');

  // Form fields
  dom.efName = document.getElementById('efName');
  dom.efEnName = document.getElementById('efEnName');
  dom.efTitle = document.getElementById('efTitle');
  dom.efIdolDropdown = document.getElementById('efIdolDropdown');
  dom.efUseAccent = document.getElementById('efUseAccent');
  dom.efCompany = document.getElementById('efCompany');
  dom.efPid = document.getElementById('efPid');
  dom.efEventTag = document.getElementById('efEventTag');
  dom.efX = document.getElementById('efX');
  dom.efWeibo = document.getElementById('efWeibo');
  dom.efBilibili = document.getElementById('efBilibili');
  dom.efXhs = document.getElementById('efXhs');
  dom.efFavSong = document.getElementById('efFavSong');
  dom.efBackTitle = document.getElementById('efBackTitle');
  dom.efBackSub = document.getElementById('efBackSub');
  dom.efQrToggle = document.getElementById('efQrToggle');
  dom.efQrModeWrap = document.getElementById('efQrModeWrap');
  dom.efQrMode = document.getElementById('efQrMode');
  dom.efQrCustomUrl = document.getElementById('efQrCustomUrl');
}

function updateSaveLabel(timeStr) {
  if (dom.saveStatus) {
    dom.saveStatus.innerHTML = `<i class="ws-save-status__star" aria-hidden="true">✦</i> 已自动保存于 ${timeStr}`;
  }
}

const debouncedSave = debounce(() => {
  const t = store.save(project);
  updateSaveLabel(t);
}, 380);

function commitChange(immediateHistory) {
  debouncedSave();
  if (immediateHistory) {
    clearTimeout(historyTimer);
    store.history.push(project);
    syncUndoRedoButtons();
  } else {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      store.history.push(project);
      syncUndoRedoButtons();
    }, 550);
  }
}

function syncUndoRedoButtons() {
  if (dom.undoBtn) dom.undoBtn.disabled = !store.history.canUndo;
  if (dom.redoBtn) dom.redoBtn.disabled = !store.history.canRedo;
}

function syncStandeeUI() {
  const t = store.getTemplate(project.templateId);
  const st = project.standee || { dataUrl: '', scale: 1, offsetX: 0, offsetY: 0 };
  if (dom.standeeThumb) {
    dom.standeeThumb.innerHTML = st.dataUrl
      ? `<img src="${escapeHtml(st.dataUrl)}" alt="立绘">`
      : escapeHtml(t.initial || '星');
  }
  if (dom.standeeControlsWrap) {
    dom.standeeControlsWrap.hidden = !st.dataUrl;
  }
  if (dom.standeeScaleSlider) dom.standeeScaleSlider.value = String(st.scale || 1);
  if (dom.standeeOffsetXSlider) dom.standeeOffsetXSlider.value = String(st.offsetX || 0);
  if (dom.standeeOffsetYSlider) dom.standeeOffsetYSlider.value = String(st.offsetY || 0);
}

function syncFormInputs() {
  const f = project.fields || {};
  const t = store.getTemplate(project.templateId);
  dom.fileNameInput.value = project.fileName || `${f.name || '制作人Producer'}_名刺方案`;
  dom.efName.value = f.name || '';
  dom.efEnName.value = f.enName || '';
  dom.efTitle.value = f.title || '';
  dom.efCompany.value = f.company || '';
  if (dom.efPid) dom.efPid.value = f.pid || '';
  if (dom.efEventTag) dom.efEventTag.value = f.eventTag || '';
  dom.efX.value = f.x || '';
  dom.efWeibo.value = f.weibo || '';
  dom.efBilibili.value = f.bilibili || '';
  dom.efXhs.value = f.xhs || '';
  dom.efFavSong.value = f.favSong || '';
  if (dom.efBackTitle) dom.efBackTitle.value = f.backTitle ?? t.jp ?? '';
  if (dom.efBackSub) dom.efBackSub.value = f.backSub ?? `${t.craft} · ${t.layoutLabel}`;
  dom.efQrToggle.setAttribute('aria-checked', f.qr !== false ? 'true' : 'false');
  if (dom.efQrModeWrap) dom.efQrModeWrap.hidden = f.qr === false;
  if (dom.efQrMode) dom.efQrMode.value = f.qrMode || 'h5';
  if (dom.efQrCustomUrl) {
    dom.efQrCustomUrl.hidden = (f.qrMode || 'h5') !== 'custom';
    dom.efQrCustomUrl.value = f.qrCustomUrl || '';
  }

  const matched = IDOLS.find((i) => (f.title || '').includes(i.name));
  const usingTantou = matched ? project.accent.toUpperCase() === matched.color.toUpperCase() : project.accent !== t.color;
  dom.efUseAccent.setAttribute('aria-checked', usingTantou ? 'true' : 'false');

  const sm = project.sideMaterials || {};
  document.querySelectorAll('[data-side-stock]').forEach((sel) => {
    sel.value = sm[sel.dataset.sideStock] || 'inherit';
  });
  const rm = project.regionMaterials || {};
  document.querySelectorAll('[data-region-mat]').forEach((sel) => {
    sel.value = rm[sel.dataset.regionMat] || 'none';
  });

  if (dom.restoreCanvasBanner) {
    dom.restoreCanvasBanner.hidden = project.mode === 'canvas' || !project.savedCanvas;
  }
  syncStandeeUI();
}

function populateMaterialSelects() {
  const gLabel = (store.MATERIALS[project && project.material] || store.MATERIALS.matte).label;
  const stockOpts = [
    `<option value="inherit">跟随全局（${escapeHtml(gLabel)}）</option>`,
    ...Object.values(store.MATERIALS).map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`)
  ].join('');
  document.querySelectorAll('[data-side-stock]').forEach((sel) => {
    const cur = sel.value || 'inherit';
    sel.innerHTML = stockOpts;
    sel.value = cur;
  });

  const surfOpts = Object.values(store.SURFACE_MATERIALS)
    .map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`)
    .join('');
  document.querySelectorAll('[data-region-mat]').forEach((sel) => {
    const cur = sel.value || 'none';
    sel.innerHTML = surfOpts;
    sel.value = cur;
  });
}

function syncTopbarControls() {
  const isCanvas = project.mode === 'canvas';
  dom.modeFormBtn.classList.toggle('is-active', !isCanvas);
  dom.modeFormBtn.setAttribute('aria-selected', !isCanvas ? 'true' : 'false');
  dom.modeCanvasBtn.classList.toggle('is-active', isCanvas);
  dom.modeCanvasBtn.setAttribute('aria-selected', isCanvas ? 'true' : 'false');

  dom.formPanel.hidden = isCanvas;
  dom.canvasPanel.hidden = !isCanvas;
  dom.layerPanel.hidden = !isCanvas;

  const effSides = store.getEffectiveSides(project);
  if (dom.sidesDoubleBtn) dom.sidesDoubleBtn.classList.toggle('is-active', effSides === 2);
  if (dom.sidesSingleBtn) dom.sidesSingleBtn.classList.toggle('is-active', effSides === 1);
  if (dom.sideBackBtn) {
    dom.sideBackBtn.disabled = effSides === 1;
    if (effSides === 1 && project.side === 'back') project.side = 'front';
  }

  dom.sideFrontBtn.classList.toggle('is-active', project.side === 'front');
  dom.sideBackBtn.classList.toggle('is-active', project.side === 'back');

  dom.specSelect.value = project.spec || 'cn';
  dom.cornerSelect.value = String(project.corner || 0);

  document.querySelectorAll('[data-guide]').forEach((btn) => {
    const k = btn.dataset.guide;
    btn.classList.toggle('is-active', Boolean(project.guides && project.guides[k]));
  });
}

function getSelectedElement() {
  if (project.mode !== 'canvas' || !selectedId) return null;
  const list = project.canvas && project.canvas[project.side];
  return Array.isArray(list) ? list.find((e) => e.id === selectedId) || null : null;
}

function renderMaterialsAndCrafts() {
  const sideStock =
    (project.sideMaterials && project.sideMaterials[project.side] && project.sideMaterials[project.side] !== 'inherit'
      ? project.sideMaterials[project.side]
      : project.material) || 'matte';

  dom.materialSwatches.innerHTML = Object.values(store.MATERIALS)
    .map((mat) => {
      const active = project.material === mat.id ? ' is-active' : '';
      const dotStyle =
        mat.id === 'pvc'
          ? 'background:linear-gradient(135deg,#EAFDFF,#FFFFFF);border-style:dashed;'
          : mat.id === 'pearl'
          ? 'background:linear-gradient(135deg,#F6ADC6,#EAFDFF,#C9C3FA);'
          : `background:${mat.edge};`;
      return `<button type="button" class="mat-swatch${active}" data-mat-id="${mat.id}" title="${mat.label}" aria-label="${mat.label}"><span class="mat-swatch__dot" style="${dotStyle}"></span></button>`;
    })
    .join('');

  const el = getSelectedElement();
  const curTargetSurface =
    project.mode === 'canvas' && el
      ? el.craft || 'none'
      : (project.regionMaterials && project.regionMaterials[selectedRegion]) || 'none';

  dom.craftChips.innerHTML = Object.values(store.CRAFTS)
    .map((c) => {
      const active = curTargetSurface === c.id ? ' is-active' : '';
      return `<button type="button" class="craft-chip${active}" data-craft-id="${c.id}" title="点击应用于当前选中区域/元素">${c.label}</button>`;
    })
    .join('');

  if (dom.modal3dTags) {
    const matLabel = (store.MATERIALS[sideStock] || store.MATERIALS.matte).label;
    store.syncCraftsSummary(project);
    const activeCrafts = Object.values(store.CRAFTS)
      .filter((c) => project.crafts && project.crafts[c.id])
      .map((c) => c.label);
    dom.modal3dTags.textContent = `当前面纸张：${matLabel} · 启用区域材质：${activeCrafts.length ? activeCrafts.join(' / ') : '全部原纸直印'}`;
  }
}

function getBleedMm() {
  return project && project.export && project.export.bleed != null ? Number(project.export.bleed) : 3;
}

function computeScale() {
  const dims = store.getDims(project);
  const bleed = getBleedMm();
  const sw = dom.canvasStage ? dom.canvasStage.clientWidth : 720;
  const sh = dom.canvasStage ? dom.canvasStage.clientHeight : 540;
  fitScale = Math.max(1.5, Math.min((sw - 120) / (dims.w + 2 * bleed), (sh - 160) / (dims.h + 2 * bleed)));
  return fitScale * zoom;
}

function renderCanvas() {
  const dims = store.getDims(project);
  const bleed = getBleedMm();
  const scale = computeScale();
  const t = store.getTemplate(project.templateId);
  const guides = project.guides || { bleed: true, trim: true, safe: true };

  const bleedW = (dims.w + 2 * bleed) * scale;
  const bleedH = (dims.h + 2 * bleed) * scale;
  const trimW = dims.w * scale;
  const trimH = dims.h * scale;
  const padPx = bleed * scale;
  const safePx = 3 * scale;

  dom.canvasBleed.style.width = `${bleedW.toFixed(1)}px`;
  dom.canvasBleed.style.height = `${bleedH.toFixed(1)}px`;
  dom.canvasBleed.style.backgroundColor = guides.bleed && bleed > 0 ? STYLE_BG[t.style] || '#FFFFFF' : 'transparent';

  dom.canvasTrim.style.left = `${padPx.toFixed(1)}px`;
  dom.canvasTrim.style.top = `${padPx.toFixed(1)}px`;
  dom.canvasTrim.style.width = `${trimW.toFixed(1)}px`;
  dom.canvasTrim.style.height = `${trimH.toFixed(1)}px`;

  dom.guideBleed.style.display = guides.bleed && bleed > 0 ? 'block' : 'none';
  dom.guideTrim.style.display = guides.trim ? 'block' : 'none';
  dom.guideSafe.style.display = guides.safe ? 'block' : 'none';
  dom.guideSafe.style.inset = `${safePx.toFixed(1)}px`;

  dom.canvasCardMount.innerHTML = renderFace(project, project.side, {
    interactive: project.mode === 'canvas',
    selectedId
  });

  if (project.mode === 'form') {
    if (selectedRegion) {
      dom.canvasCardMount.querySelectorAll(`[data-region="${CSS.escape(selectedRegion)}"]`).forEach((node) => {
        node.classList.add('is-region-focused');
      });
    }
    requestAnimationFrame(() => fitText(dom.canvasCardMount));
  }

  const pct = Math.round(zoom * 100);
  dom.zoomLabel.textContent = `${pct}%`;
  dom.zoomSlider.value = String(pct);
  dom.statusLeft.textContent = `${dims.w}×${dims.h}mm · 出血 ${bleed}mm · ${pct}%`;
}

function update3D() {
  if (thumb3d) thumb3d.update();
  if (modal3d && dom.modal3d.classList.contains('is-open')) modal3d.update();
}

function renderSurfaceMatGrid(currentVal, attrName) {
  return `
    <div class="mat-grid-3">
      ${Object.values(store.SURFACE_MATERIALS)
        .map((m) => {
          const active = (currentVal || 'none') === m.id ? ' is-active' : '';
          const bg = m.id === 'brushed' ? 'background:repeating-linear-gradient(90deg,#8A919B 0 2px,#B8BFC8 2px 4px);' : `background:${m.swatch};`;
          return `<button type="button" class="mat-card-btn${active}" ${attrName}="${m.id}"><span class="mat-card-btn__chip" style="${bg}"></span><span>${escapeHtml(m.label)}</span></button>`;
        })
        .join('')}
    </div>`;
}

function renderStockMatGrid(currentVal, attrName, includeInherit) {
  const globalLabel = (store.MATERIALS[project.material] || store.MATERIALS.matte).label;
  return `
    ${
      includeInherit
        ? `<button type="button" class="ef-chip${currentVal === 'inherit' ? ' is-active' : ''}" ${attrName}="inherit" style="width:100%;margin-bottom:6px;${currentVal === 'inherit' ? 'background:var(--cream-50);border-color:var(--orange-500);color:var(--orange-700);' : ''}">跟随全局纸张（${escapeHtml(globalLabel)}）</button>`
        : ''
    }
    <div class="mat-grid-3">
      ${Object.values(store.MATERIALS)
        .map((m) => {
          const active = currentVal === m.id ? ' is-active' : '';
          const bg =
            m.id === 'pvc'
              ? 'background:linear-gradient(135deg,#EAFDFF,#FFFFFF);border-style:dashed;'
              : m.id === 'pearl'
              ? 'background:linear-gradient(135deg,#F6ADC6,#EAFDFF,#C9C3FA);'
              : `background:${m.edge};`;
          return `<button type="button" class="mat-card-btn${active}" ${attrName}="${m.id}"><span class="mat-card-btn__chip" style="${bg}"></span><span>${escapeHtml(m.label)}</span></button>`;
        })
        .join('')}
    </div>`;
}

function rgbToHex(color) {
  if (!color) return '#333333';
  if (color.startsWith('#')) {
    return color.length === 4 ? '#' + color.slice(1).split('').map((c) => c + c).join('') : color.slice(0, 7);
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return '#333333';
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

function alignElement(el, dir) {
  const dims = store.getDims(project);
  const mx = (3 / dims.w) * 100;
  const my = (3 / dims.h) * 100;
  if (dir === 'left') el.x = Number(mx.toFixed(2));
  else if (dir === 'cx') el.x = Number(((100 - el.w) / 2).toFixed(2));
  else if (dir === 'right') el.x = Number((100 - mx - el.w).toFixed(2));
  else if (dir === 'top') el.y = Number(my.toFixed(2));
  else if (dir === 'cy') el.y = Number(((100 - el.h) / 2).toFixed(2));
  else if (dir === 'bottom') el.y = Number((100 - my - el.h).toFixed(2));
  refreshAll(true);
}

function renderPropertiesPanel() {
  const t = store.getTemplate(project.templateId);
  if (project.mode !== 'canvas') {
    const sideRegions = store.EDITABLE_REGIONS.filter((r) => r.side === project.side);
    if (!sideRegions.some((r) => r.id === selectedRegion)) {
      selectedRegion = project.side === 'back' ? 'qr' : 'name';
    }
    const activeReg = sideRegions.find((r) => r.id === selectedRegion) || sideRegions[0];
    const rm = project.regionMaterials || {};
    const sm = project.sideMaterials || {};
    const pickerHtml =
      activeReg.kind === 'stock'
        ? renderStockMatGrid(sm[project.side] || 'inherit', 'data-pick-side-stock', true)
        : renderSurfaceMatGrid(rm[activeReg.id] || 'none', 'data-pick-region-mat');

    dom.propPanel.innerHTML = `
      <div class="ws-panel-head">
        <h2 class="ws-panel-title">区域材质工作台</h2>
        <span style="font-size:11px;color:var(--orange-700);font-weight:700;">${escapeHtml(activeReg.label)}</span>
      </div>
      <div style="font-size:11px;color:var(--gray-600);">点击标签或画布元素，为各区域自由配置真实材质：</div>
      <div class="region-pill-bar">
        ${sideRegions
          .map((r) => {
            const isAct = r.id === activeReg.id ? ' is-active' : '';
            const hasMat =
              r.kind === 'stock'
                ? sm[project.side] && sm[project.side] !== 'inherit' ? ' has-mat' : ''
                : rm[r.id] && rm[r.id] !== 'none' ? ' has-mat' : '';
            return `<button type="button" class="region-pill${isAct}${hasMat}" data-select-region="${r.id}">${escapeHtml(r.label)}</button>`;
          })
          .join('')}
      </div>
      ${pickerHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;">
        <span style="font-size:11px;color:var(--gray-600);">${escapeHtml(t.name)} · ${escapeHtml(t.styleLabel)}</span>
        <button type="button" id="resetRegionsBtn" class="ef-chip" style="min-height:26px;font-size:11px;">重置材质</button>
      </div>
    `;

    dom.propPanel.querySelectorAll('[data-select-region]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRegion = btn.dataset.selectRegion;
        renderCanvas();
        renderPropertiesPanel();
        renderMaterialsAndCrafts();
      });
    });

    dom.propPanel.querySelectorAll('[data-pick-side-stock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!project.sideMaterials) project.sideMaterials = { front: 'inherit', back: 'inherit' };
        project.sideMaterials[project.side] = btn.dataset.pickSideStock;
        populateMaterialSelects();
        syncFormInputs();
        refreshAll(true);
      });
    });

    dom.propPanel.querySelectorAll('[data-pick-region-mat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!project.regionMaterials) project.regionMaterials = store.defaultRegionMaterials();
        project.regionMaterials[activeReg.id] = btn.dataset.pickRegionMat;
        syncFormInputs();
        refreshAll(true);
      });
    });

    const resetBtn = document.getElementById('resetRegionsBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        project.sideMaterials = { front: 'inherit', back: 'inherit' };
        project.regionMaterials = store.defaultRegionMaterials();
        syncFormInputs();
        refreshAll(true);
        showToast('已重置全部区域材质为原纸直印');
      });
    }
    return;
  }

  const el = getSelectedElement();
  if (!el) {
    const sm = project.sideMaterials || {};
    const rm = project.regionMaterials || {};
    dom.propPanel.innerHTML = `
      <div class="ws-panel-head"><h2 class="ws-panel-title">卡底与装饰材质</h2></div>
      <div style="font-size:12px;color:var(--gray-600);">未选中画布元素（点击元素可调整其属性、对齐、旋转与材质，或在此设置当前面卡底与装饰区材质）：</div>
      <div class="ef-group">
        <div class="ef-label"><span>${project.side === 'back' ? '背面卡底纸张' : '正面卡底纸张'}</span></div>
        ${renderStockMatGrid(sm[project.side] || 'inherit', 'data-canvas-side-stock', true)}
      </div>
      ${
        project.side === 'front'
          ? `<div class="ef-group"><div class="ef-label"><span>模板立绘与装饰区材质</span></div>${renderSurfaceMatGrid(rm.decor || 'none', 'data-canvas-decor-mat')}</div>`
          : ''
      }`;

    dom.propPanel.querySelectorAll('[data-canvas-side-stock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!project.sideMaterials) project.sideMaterials = { front: 'inherit', back: 'inherit' };
        project.sideMaterials[project.side] = btn.dataset.canvasSideStock;
        syncFormInputs();
        refreshAll(true);
      });
    });
    dom.propPanel.querySelectorAll('[data-canvas-decor-mat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!project.regionMaterials) project.regionMaterials = store.defaultRegionMaterials();
        project.regionMaterials.decor = btn.dataset.canvasDecorMat;
        syncFormInputs();
        refreshAll(true);
      });
    });
    return;
  }

  const dims = store.getDims(project);
  const swatches = [project.accent || '#FF7600', '#333333', '#FFFFFF', '#D4AF37', ...IDOLS.map((i) => i.color)];
  const uniqueSwatches = Array.from(new Set(swatches.map((s) => s.toUpperCase())));

  let specificHtml = '';
  if (el.type === 'text') {
    const ptVal = store.ptFromCqw(el.fontSize || 4.2, dims);
    specificHtml = `
      <div class="ef-group">
        <label class="ef-label" for="propText">文字内容</label>
        <textarea id="propText" class="ef-input" rows="2" style="min-height:54px;resize:vertical;">${escapeHtml(el.text || '')}</textarea>
      </div>
      <div class="ef-group">
        <label class="ef-label" for="propFont">字体</label>
        <select id="propFont" class="ef-input">
          <option value="'Noto Sans SC', 'Poppins', sans-serif">Noto Sans SC（黑体）</option>
          <option value="'Noto Serif SC', 'Zen Antique Soft', serif">Noto Serif SC（衬线）</option>
          <option value="'Poppins', sans-serif">Poppins（英文展示）</option>
          <option value="'M PLUS Rounded 1c', 'Noto Sans SC', sans-serif">M PLUS Rounded 1c（圆体）</option>
          <option value="'Zen Antique Soft', serif">Zen Antique Soft（古风日文）</option>
        </select>
      </div>
      <div class="prop-grid-2">
        <div class="ef-group">
          <label class="ef-label" for="propPt">字号 (pt)</label>
          <input id="propPt" class="ef-input" type="number" step="0.5" min="3" max="48" value="${ptVal}">
        </div>
        <div class="ef-group">
          <label class="ef-label">字重与对齐</label>
          <div style="display:flex;gap:4px;">
            <button type="button" id="propBoldBtn" class="ef-chip" style="flex:1;${Number(el.fontWeight) >= 700 ? 'background:var(--orange-500);color:#fff;' : ''}">B</button>
            <button type="button" class="ef-chip" data-prop-align="left">左</button>
            <button type="button" class="ef-chip" data-prop-align="center">中</button>
            <button type="button" class="ef-chip" data-prop-align="right">右</button>
          </div>
        </div>
      </div>
      <div class="ef-group">
        <label class="ef-label" for="propLetterSpacing">字距 (${Number(el.letterSpacing || 0).toFixed(2)}em)</label>
        <input id="propLetterSpacing" type="range" min="-0.05" max="0.4" step="0.01" value="${el.letterSpacing || 0}">
      </div>`;
  } else if (el.type === 'image') {
    specificHtml = `
      <div class="ef-group">
        <label class="ef-label" for="propOpacity">图片不透明度 (${Math.round((el.opacity ?? 1) * 100)}%)</label>
        <input id="propOpacity" type="range" min="0.1" max="1" step="0.05" value="${el.opacity ?? 1}">
      </div>`;
  }

  const colorHtml =
    el.type === 'text' || el.type === 'icon' || el.type === 'shape'
      ? `
      <div class="ef-group">
        <label class="ef-label" for="propColor">颜色</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="propColor" type="color" value="${rgbToHex(el.color || '#333333')}" style="width:36px;height:30px;border:1px solid var(--gray-100);border-radius:6px;">
          <span style="font-size:12px;color:var(--gray-600);">${escapeHtml(rgbToHex(el.color || '#333333'))}</span>
        </div>
        <div class="prop-swatches">
          ${uniqueSwatches.map((c) => `<button type="button" class="prop-swatch" data-prop-swatch="${c}" style="background:${c};" title="${c}"></button>`).join('')}
        </div>
      </div>`
      : '';

  const transformHtml = `
    <div class="ef-group">
      <label class="ef-label" for="propRotate"><span>旋转角度</span><span id="propRotateVal">${Number(el.rotate || 0)}°</span></label>
      <input id="propRotate" type="range" min="-180" max="180" step="1" value="${Number(el.rotate || 0)}">
    </div>
    <div class="ef-group">
      <div class="ef-label"><span>安全区快速对齐</span></div>
      <div class="prop-align-grid">
        <button type="button" class="ef-chip" data-align-box="left" title="左对齐">左</button>
        <button type="button" class="ef-chip" data-align-box="cx" title="水平居中">水</button>
        <button type="button" class="ef-chip" data-align-box="right" title="右对齐">右</button>
        <button type="button" class="ef-chip" data-align-box="top" title="顶对齐">顶</button>
        <button type="button" class="ef-chip" data-align-box="cy" title="垂直居中">垂</button>
        <button type="button" class="ef-chip" data-align-box="bottom" title="底对齐">底</button>
      </div>
    </div>`;

  const surfaceMatHtml = `
    <div class="ef-group">
      <label class="ef-label"><span>表面材质效果</span><span style="font-size:11px;color:var(--orange-700);">${escapeHtml((store.SURFACE_MATERIALS[el.craft || 'none'] || store.SURFACE_MATERIALS.none).label)}</span></label>
      ${renderSurfaceMatGrid(el.craft || 'none', 'data-prop-mat')}
    </div>`;

  dom.propPanel.innerHTML = `
    <div class="ws-panel-head">
      <h2 class="ws-panel-title">元素属性与材质</h2>
      <span style="font-size:11px;color:var(--gray-600);">${el.type.toUpperCase()}</span>
    </div>
    ${specificHtml}
    ${colorHtml}
    ${transformHtml}
    ${surfaceMatHtml}
    <div class="prop-grid-2">
      <button type="button" id="propLockBtn" class="ef-chip">${el.locked ? '解锁' : '锁定'}</button>
      <button type="button" id="propVisBtn" class="ef-chip">${el.visible === false ? '显示' : '隐藏'}</button>
      <button type="button" id="propUpBtn" class="ef-chip">上移一层</button>
      <button type="button" id="propDownBtn" class="ef-chip">下移一层</button>
      <button type="button" id="propTopBtn" class="ef-chip">置顶</button>
      <button type="button" id="propDupBtn" class="ef-chip">复制副本</button>
    </div>
    <button type="button" id="propDelBtn" class="ef-chip" style="color:var(--color-error);border-color:rgba(227,15,37,0.3);">删除此元素</button>
  `;

  if (el.type === 'text') {
    const pf = document.getElementById('propFont');
    if (pf) {
      const matchOpt = Array.from(pf.options).find((o) =>
        (el.fontFamily || '').toLowerCase().includes(o.value.split(',')[0].replace(/'/g, '').toLowerCase())
      );
      if (matchOpt) pf.value = matchOpt.value;
      pf.addEventListener('change', () => { el.fontFamily = pf.value; refreshAll(true); });
    }
    const ptInput = document.getElementById('propText');
    if (ptInput) {
      ptInput.addEventListener('input', () => {
        el.text = ptInput.value;
        if (el.bind && project.fields && el.bind in project.fields) {
          project.fields[el.bind] = ptInput.value;
          syncFormInputs();
        }
        renderCanvas();
        update3D();
        commitChange(false);
      });
    }
    const pPt = document.getElementById('propPt');
    if (pPt) {
      pPt.addEventListener('input', () => {
        el.fontSize = store.cqwFromPt(Math.max(3, Math.min(48, Number(pPt.value) || 8)), dims);
        renderCanvas();
        update3D();
        commitChange(false);
      });
    }
    const pLs = document.getElementById('propLetterSpacing');
    if (pLs) {
      pLs.addEventListener('input', () => {
        el.letterSpacing = Number(pLs.value);
        renderCanvas();
        update3D();
        commitChange(false);
      });
    }
    document.getElementById('propBoldBtn')?.addEventListener('click', () => {
      el.fontWeight = Number(el.fontWeight) >= 700 ? 400 : 700;
      refreshAll(true);
    });
    dom.propPanel.querySelectorAll('[data-prop-align]').forEach((btn) => {
      btn.addEventListener('click', () => { el.align = btn.dataset.propAlign; refreshAll(true); });
    });
  }

  if (el.type === 'image') {
    document.getElementById('propOpacity')?.addEventListener('input', (e) => {
      el.opacity = Number(e.target.value);
      renderCanvas();
      update3D();
      commitChange(false);
    });
  }

  document.getElementById('propColor')?.addEventListener('input', (e) => {
    el.color = e.target.value;
    renderCanvas();
    update3D();
    commitChange(false);
  });
  dom.propPanel.querySelectorAll('[data-prop-swatch]').forEach((btn) => {
    btn.addEventListener('click', () => { el.color = btn.dataset.propSwatch; refreshAll(true); });
  });

  const pRot = document.getElementById('propRotate');
  const pRotVal = document.getElementById('propRotateVal');
  if (pRot) {
    pRot.addEventListener('input', () => {
      el.rotate = Number(pRot.value) || 0;
      if (pRotVal) pRotVal.textContent = `${el.rotate}°`;
      renderCanvas();
      update3D();
      commitChange(false);
    });
  }

  dom.propPanel.querySelectorAll('[data-align-box]').forEach((btn) => {
    btn.addEventListener('click', () => alignElement(el, btn.dataset.alignBox));
  });

  dom.propPanel.querySelectorAll('[data-prop-mat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.craft = btn.dataset.propMat;
      if (el.bind && project.regionMaterials && el.bind in project.regionMaterials) {
        project.regionMaterials[el.bind] = el.craft;
        syncFormInputs();
      }
      refreshAll(true);
    });
  });

  document.getElementById('propLockBtn').addEventListener('click', () => { el.locked = !el.locked; refreshAll(true); });
  document.getElementById('propVisBtn').addEventListener('click', () => { el.visible = el.visible === false; refreshAll(true); });
  document.getElementById('propUpBtn').addEventListener('click', () => moveLayer(el.id, 1));
  document.getElementById('propDownBtn').addEventListener('click', () => moveLayer(el.id, -1));
  document.getElementById('propTopBtn').addEventListener('click', () => moveLayer(el.id, 999));
  document.getElementById('propDupBtn').addEventListener('click', () => duplicateElement(el.id));
  document.getElementById('propDelBtn').addEventListener('click', () => deleteElement(el.id));
}

function renderLayersPanel() {
  if (project.mode !== 'canvas') {
    dom.layerPanel.hidden = true;
    return;
  }
  dom.layerPanel.hidden = false;
  const list = project.canvas && project.canvas[project.side] ? project.canvas[project.side] : [];
  const reversed = [...list].reverse();

  const eyeSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOffSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/></svg>';
  const lockSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  const unlockSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

  dom.layerPanel.innerHTML = `
    <div class="ws-panel-head"><h2 class="ws-panel-title">图层管理 (${list.length})</h2></div>
    ${reversed
      .map((el) => {
        const label =
          el.type === 'text' ? (el.text || '空白文本').slice(0, 10)
          : el.type === 'icon' ? `图标·${ICON_LABELS[el.iconName] || el.iconName}`
          : el.type === 'shape' ? `图形·${(SHAPES[el.shapeName] || { label: '图形' }).label}`
          : el.type === 'image' ? '自定义图片'
          : '动态二维码';
        const typeIcon = el.type === 'text' ? 'T' : el.type === 'icon' ? '✦' : el.type === 'shape' ? '◆' : el.type === 'image' ? '▣' : '⊞';
        const sel = selectedId === el.id ? ' is-selected' : '';
        return `
          <div class="layer-item${sel}" data-layer-id="${escapeHtml(el.id)}">
            <span style="width:18px;text-align:center;font-weight:700;color:var(--orange-700);">${typeIcon}</span>
            <span class="layer-item__name">${escapeHtml(label)}</span>
            <button type="button" class="layer-item__btn" data-layer-vis="${escapeHtml(el.id)}" aria-label="${el.visible === false ? '显示图层' : '隐藏图层'}">${el.visible === false ? eyeOffSvg : eyeSvg}</button>
            <button type="button" class="layer-item__btn" data-layer-lock="${escapeHtml(el.id)}" aria-label="${el.locked ? '解锁图层' : '锁定图层'}">${el.locked ? lockSvg : unlockSvg}</button>
          </div>`;
      })
      .join('')}
  `;
}

function renderToolDrawer() {
  if (!dom.toolDrawer) return;
  if (activeToolTab === 'templates') {
    const tpls = store.getAllTemplates().slice(0, 24);
    dom.toolDrawer.innerHTML = `
      <div class="ws-panel-head"><h3 class="ws-panel-title">切换设计模板</h3></div>
      <div class="drawer-mini-grid">
        ${tpls
          .map(
            (t) => `
            <button type="button" class="mini-tpl-btn${project.templateId === t.id ? ' is-active' : ''}" data-switch-tpl="${escapeHtml(t.id)}">
              <div class="mini-tpl-btn__stage">${renderCard(t, project.fields, { forceSingle: true })}</div>
              <div class="mini-tpl-btn__name">${escapeHtml(t.name)}</div>
            </button>`
          )
          .join('')}
      </div>`;
  } else if (activeToolTab === 'text') {
    dom.toolDrawer.innerHTML = `
      <div class="ws-panel-head"><h3 class="ws-panel-title">添加文字预设</h3></div>
      <button type="button" class="text-preset-btn" data-add-text="heading"><strong>大标题</strong><span style="font-size:12px;color:var(--gray-600);">Bold</span></button>
      <button type="button" class="text-preset-btn" data-add-text="body"><span>正文文字</span><span style="font-size:12px;color:var(--gray-600);">Body</span></button>
      <button type="button" class="text-preset-btn" data-add-text="en"><span>ENGLISH LABEL</span><span style="font-size:12px;color:var(--gray-600);">Poppins</span></button>
      <button type="button" class="text-preset-btn" data-add-text="vert"><span>竖排日文副标</span><span style="font-size:12px;color:var(--gray-600);">纵书</span></button>`;
  } else if (activeToolTab === 'icons') {
    dom.toolDrawer.innerHTML = `
      <div class="ws-panel-head"><h3 class="ws-panel-title">内置矢量图标库</h3></div>
      <div class="icon-lib-grid">
        ${Object.keys(ICONS)
          .map(
            (key) => `
            <button type="button" class="icon-lib-btn" data-add-icon="${key}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>
              <span>${escapeHtml(ICON_LABELS[key] || key)}</span>
            </button>`
          )
          .join('')}
      </div>`;
  } else if (activeToolTab === 'shapes') {
    dom.toolDrawer.innerHTML = `
      <div class="ws-panel-head"><h3 class="ws-panel-title">装饰艺术图形</h3></div>
      <div class="shape-lib-grid">
        ${Object.entries(SHAPES)
          .map(
            ([k, def]) => `
            <button type="button" class="icon-lib-btn" data-add-shape="${k}" style="color:var(--orange-700);">
              <div style="width:36px;height:28px;">${def.svg}</div>
              <span style="color:var(--ink);">${escapeHtml(def.label)}</span>
            </button>`
          )
          .join('')}
      </div>`;
  } else if (activeToolTab === 'images') {
    const imgs = project.images || [];
    dom.toolDrawer.innerHTML = `
      <div class="ws-panel-head"><h3 class="ws-panel-title">上传个人立绘 / 图片</h3></div>
      <label class="upload-drop">
        <input id="imgUploadInput" type="file" accept="image/*" class="sr-only">
        <span>+ 点击选择本地图片</span>
        <span style="font-size:11px;font-weight:400;color:var(--gray-600);">支持 PNG / JPG / WebP（IndexedDB + 云端存储）</span>
      </label>
      <div class="uploaded-img-grid">
        ${imgs
          .map((img) => `<button type="button" class="uploaded-img-thumb" data-place-img="${escapeHtml(img.id)}" title="点击再次添加到画布"><img src="${escapeHtml(img.dataUrl)}" alt="已上传图片"></button>`)
          .join('')}
      </div>`;
  } else if (activeToolTab === 'pattern') {
    dom.toolDrawer.innerHTML = `
      <div class="ws-panel-head"><h3 class="ws-panel-title">名片背景纹理</h3></div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${store.PATTERN_TEXTURES.map((p) => `<button type="button" class="chip${project.pattern === p.id ? ' is-active' : ''}" data-set-pattern="${p.id}" style="justify-content:flex-start;">${p.label}</button>`).join('')}
      </div>`;
  }
}

function refreshAll(pushHist) {
  syncTopbarControls();
  renderMaterialsAndCrafts();
  renderCanvas();
  renderPropertiesPanel();
  renderLayersPanel();
  renderToolDrawer();
  update3D();
  commitChange(pushHist);
}

function ensureCanvasElementsForCurrentSide() {
  if (!project.canvas) project.canvas = { front: null, back: null };
  if (!project.canvas[project.side]) {
    const tmpMode = project.mode;
    project.mode = 'form';
    renderCanvas();
    fitText(dom.canvasCardMount);
    const cardEl = dom.canvasCardMount.querySelector('.bcard');
    project.canvas[project.side] = convertToElements(cardEl, project.side);
    project.mode = tmpMode;
  }
}

function switchMode(targetMode) {
  if (project.mode === targetMode) return;
  if (targetMode === 'canvas') {
    if (project.savedCanvas && (!project.canvas.front && !project.canvas.back)) {
      project.canvas = project.savedCanvas;
      project.savedCanvas = null;
    }
    project.mode = 'canvas';
    ensureCanvasElementsForCurrentSide();
    selectedId = null;
    syncFormInputs();
    refreshAll(true);
  } else {
    // Non-destructive: backup free canvas layout to savedCanvas before returning to Form mode
    if (project.canvas && (project.canvas.front || project.canvas.back)) {
      project.savedCanvas = JSON.parse(JSON.stringify(project.canvas));
    }
    project.canvas = { front: null, back: null };
    project.mode = 'form';
    selectedId = null;
    syncFormInputs();
    refreshAll(true);
    showToast('已切回极简表单（自由画布草稿已暂存，可随时恢复）');
  }
}

function switchSide(side) {
  if (project.side === side) return;
  if (side === 'back' && store.getEffectiveSides(project) === 1) return;
  project.side = side;
  selectedId = null;
  if (project.mode === 'canvas') ensureCanvasElementsForCurrentSide();
  refreshAll(false);
}

function moveLayer(id, delta) {
  const list = project.canvas && project.canvas[project.side];
  if (!list) return;
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const nextIdx = Math.max(0, Math.min(list.length - 1, idx + delta));
  if (nextIdx === idx) return;
  const [item] = list.splice(idx, 1);
  list.splice(nextIdx, 0, item);
  refreshAll(true);
}

function deleteElement(id) {
  const list = project.canvas && project.canvas[project.side];
  if (!list) return;
  const el = list.find((e) => e.id === id);
  if (!el) return;
  if (el.bind && !window.confirm('该元素已绑定名片资料字段，确认从自由画布中删除？')) return;
  project.canvas[project.side] = list.filter((e) => e.id !== id);
  if (el.bind && project.fields && el.bind in project.fields) {
    const stillBound = ['front', 'back'].some(
      (s) => Array.isArray(project.canvas[s]) && project.canvas[s].some((item) => item && item.bind === el.bind)
    );
    if (!stillBound) {
      project.fields[el.bind] = '';
      syncFormInputs();
    }
  }
  if (selectedId === id) selectedId = null;
  refreshAll(true);
}

function duplicateElement(id) {
  const list = project.canvas && project.canvas[project.side];
  if (!list) return;
  const el = list.find((e) => e.id === id);
  if (!el) return;
  const copy = {
    ...JSON.parse(JSON.stringify(el)),
    id: store.uid(),
    x: Math.min(92, el.x + 3),
    y: Math.min(92, el.y + 3)
  };
  list.push(copy);
  selectedId = copy.id;
  refreshAll(true);
}

function addTextPreset(kind) {
  ensureCanvasElementsForCurrentSide();
  const t = store.getTemplate(project.templateId);
  const defaultCol = t.style === 'stage' || t.style === 'starlight' ? '#FFFFFF' : '#333333';
  const presets = {
    heading: { text: '一番星制作人', fontSize: 7.5, fontWeight: 700, fontFamily: "'Noto Sans SC', 'Poppins', sans-serif", letterSpacing: 0.04, vertical: false, w: 46, h: 12 },
    body: { text: '请多关照！欢迎交换名刺', fontSize: 4.0, fontWeight: 500, fontFamily: "'Noto Sans SC', 'Poppins', sans-serif", letterSpacing: 0.04, vertical: false, w: 50, h: 8 },
    en: { text: 'PRODUCER CARD', fontSize: 3.2, fontWeight: 600, fontFamily: "'Poppins', sans-serif", letterSpacing: 0.18, vertical: false, w: 40, h: 7 },
    vert: { text: '輝きの向こう側へ', fontSize: 4.0, fontWeight: 500, fontFamily: "'Noto Serif SC', 'Zen Antique Soft', serif", letterSpacing: 0.2, vertical: true, w: 10, h: 48 }
  };
  const p = presets[kind] || presets.body;
  const el = {
    id: store.uid(),
    type: 'text',
    text: p.text,
    vertical: p.vertical,
    x: Number(((100 - p.w) / 2).toFixed(1)),
    y: Number(((100 - p.h) / 2).toFixed(1)),
    w: p.w,
    h: p.h,
    rotate: 0,
    fontSize: p.fontSize,
    fontFamily: p.fontFamily,
    fontWeight: p.fontWeight,
    letterSpacing: p.letterSpacing,
    color: defaultCol,
    align: 'left',
    craft: 'none',
    visible: true,
    locked: false,
    opacity: 1
  };
  project.canvas[project.side].push(el);
  selectedId = el.id;
  refreshAll(true);
}

function addIconElement(iconName) {
  ensureCanvasElementsForCurrentSide();
  const dims = store.getDims(project);
  const w = 11;
  const h = Number(((w * dims.w) / dims.h).toFixed(2));
  const el = { id: store.uid(), type: 'icon', iconName, x: 44, y: 40, w, h, rotate: 0, color: project.accent || '#FF7600', craft: 'none', visible: true, locked: false, opacity: 1 };
  project.canvas[project.side].push(el);
  selectedId = el.id;
  refreshAll(true);
}

function addShapeElement(shapeName) {
  ensureCanvasElementsForCurrentSide();
  const def = SHAPES[shapeName] || SHAPES.line;
  const el = {
    id: store.uid(),
    type: 'shape',
    shapeName,
    x: Number(((100 - def.w) / 2).toFixed(1)),
    y: Number(((100 - def.h) / 2).toFixed(1)),
    w: def.w,
    h: def.h,
    rotate: 0,
    color: project.accent || '#FF7600',
    craft: 'none',
    visible: true,
    locked: false,
    opacity: 1
  };
  project.canvas[project.side].push(el);
  selectedId = el.id;
  refreshAll(true);
}

function placeImageElement(imgRecord) {
  ensureCanvasElementsForCurrentSide();
  const dims = store.getDims(project);
  const w = 24;
  const aspect = imgRecord.naturalH && imgRecord.naturalW ? imgRecord.naturalH / imgRecord.naturalW : 1;
  const h = Number(Math.min(70, (w * aspect * dims.w) / dims.h).toFixed(2));
  const el = { id: store.uid(), type: 'image', imageId: imgRecord.id, x: 38, y: 25, w, h, rotate: 0, craft: 'none', visible: true, locked: false, opacity: 1 };
  project.canvas[project.side].push(el);
  selectedId = el.id;
  refreshAll(true);
}

function handleImageUpload(file, asFormStandee = false) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let dataUrl = reader.result;
    if (typeof dataUrl !== 'string') return;
    if (isServerConnected()) {
      const uploaded = await apiUploadImage(dataUrl, file.name);
      if (uploaded && uploaded.url) dataUrl = uploaded.url;
    }
    const img = new Image();
    img.onload = () => {
      if (asFormStandee) {
        project.standee = { dataUrl, scale: 1, offsetX: 0, offsetY: 0 };
        syncStandeeUI();
        refreshAll(true);
        showToast('已更新制作人专属立绘插画 ✦');
      } else {
        const record = { id: store.uid(), name: file.name, dataUrl, naturalW: img.naturalWidth || 800, naturalH: img.naturalHeight || 800 };
        if (!project.images) project.images = [];
        project.images.push(record);
        placeImageElement(record);
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function bindCanvasDrag() {
  let dragState = null;

  dom.canvasStage.addEventListener('pointerdown', (e) => {
    if (project.mode !== 'canvas' || !selectedId) return;
    if (!e.target.isConnected || e.target.closest('#canvasTrim') || e.target.closest('.canvas-toolbar')) return;
    selectedId = null;
    renderCanvas();
    renderPropertiesPanel();
    renderLayersPanel();
  });

  dom.canvasTrim.addEventListener('pointerdown', (e) => {
    if (project.mode !== 'canvas') return;
    e.stopPropagation();
    const handle = e.target.closest('[data-resize-handle]');
    const elNode = e.target.closest('[data-el-id]');
    if (!elNode) {
      if (selectedId) {
        selectedId = null;
        renderCanvas();
        renderPropertiesPanel();
        renderLayersPanel();
      }
      return;
    }

    const id = elNode.dataset.elId;
    const el = (project.canvas[project.side] || []).find((item) => item.id === id);
    if (!el) return;

    if (selectedId !== id) {
      selectedId = id;
      renderCanvas();
      renderPropertiesPanel();
      renderLayersPanel();
    }
    if (el.locked) return;

    const trimRect = dom.canvasTrim.getBoundingClientRect();
    dragState = {
      mode: handle ? 'resize' : 'move',
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.w,
      origH: el.h,
      trimW: trimRect.width,
      trimH: trimRect.height,
      keepAspect: el.type === 'icon' || el.type === 'image',
      aspectWH: el.h ? el.w / el.h : 1
    };
    dom.canvasTrim.setPointerCapture && dom.canvasTrim.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const el = (project.canvas[project.side] || []).find((item) => item.id === dragState.id);
    if (!el) return;

    const dxPct = ((e.clientX - dragState.startX) / dragState.trimW) * 100;
    const dyPct = ((e.clientY - dragState.startY) / dragState.trimH) * 100;

    if (dragState.mode === 'resize') {
      const nextW = Math.max(4, Math.min(100 - el.x, dragState.origW + dxPct));
      el.w = Number(nextW.toFixed(2));
      if (dragState.keepAspect) el.h = Number(Math.max(4, nextW / dragState.aspectWH).toFixed(2));
      else el.h = Number(Math.max(4, Math.min(100 - el.y, dragState.origH + dyPct)).toFixed(2));
    } else {
      let nx = dragState.origX + dxPct;
      let ny = dragState.origY + dyPct;

      const dims = store.getDims(project);
      const safeX = (3 / dims.w) * 100;
      const safeY = (3 / dims.h) * 100;
      const xTargets = [0, safeX, 50, 100 - safeX, 100];
      const yTargets = [0, safeY, 50, 100 - safeY, 100];

      (project.canvas[project.side] || []).forEach((other) => {
        if (other.id === el.id || other.visible === false) return;
        xTargets.push(other.x, other.x + other.w / 2, other.x + other.w);
        yTargets.push(other.y, other.y + other.h / 2, other.y + other.h);
      });

      let snapX = null;
      let snapY = null;
      for (const tVal of xTargets) {
        for (const off of [0, el.w / 2, el.w]) {
          if (Math.abs(nx + off - tVal) <= 1.5) {
            nx = tVal - off;
            snapX = tVal;
            break;
          }
        }
        if (snapX !== null) break;
      }
      for (const tVal of yTargets) {
        for (const off of [0, el.h / 2, el.h]) {
          if (Math.abs(ny + off - tVal) <= 1.5) {
            ny = tVal - off;
            snapY = tVal;
            break;
          }
        }
        if (snapY !== null) break;
      }

      el.x = Number(Math.max(-20, Math.min(96, nx)).toFixed(2));
      el.y = Number(Math.max(-20, Math.min(96, ny)).toFixed(2));
      dom.snapLines.innerHTML =
        (snapX !== null ? `<div class="snap-line snap-line--x" style="left:${snapX}%"></div>` : '') +
        (snapY !== null ? `<div class="snap-line snap-line--y" style="top:${snapY}%"></div>` : '');
    }

    const liveNode = dom.canvasCardMount.querySelector(`[data-el-id="${CSS.escape(el.id)}"]`);
    if (liveNode) {
      liveNode.style.left = `${el.x}%`;
      liveNode.style.top = `${el.y}%`;
      liveNode.style.width = `${el.w}%`;
      liveNode.style.height = `${el.h}%`;
    }
  });

  function endDrag() {
    if (!dragState) return;
    dragState = null;
    dom.snapLines.innerHTML = '';
    renderCanvas();
    update3D();
    commitChange(true);
  }

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  dom.canvasTrim.addEventListener('click', (e) => {
    if (project.mode !== 'form') return;
    const regNode = e.target.closest('[data-region]');
    if (!regNode) return;
    const regId = regNode.dataset.region;
    if (regId) {
      selectedRegion = regId;
      renderCanvas();
      renderPropertiesPanel();
      renderMaterialsAndCrafts();
    }
  });

  dom.canvasTrim.addEventListener('dblclick', (e) => {
    const elNode = e.target.closest('[data-el-id]');
    if (!elNode) return;
    const el = getSelectedElement();
    if (el && el.type === 'text') document.getElementById('propText')?.focus();
  });
}

function bindIdolCombobox() {
  const renderOpts = (query) => {
    const q = (query || '').trim().replace(/担当$/g, '');
    const list = q ? IDOLS.filter((i) => i.name.includes(q) || i.initial.includes(q)) : IDOLS;
    highlightedIdolIdx = -1;
    dom.efIdolDropdown.innerHTML = list
      .map(
        (idol, idx) => `
        <button type="button" id="efIdolOpt-${idx}" class="combobox-option" role="option" data-idol-name="${escapeHtml(idol.name)}" data-idol-color="${escapeHtml(idol.color)}">
          <span class="combobox-option__avatar" style="background:${escapeHtml(idol.color)};${idol.light ? 'color:#333;border:1px solid #BFBFBF;' : ''}">${escapeHtml(idol.initial)}</span>
          <span class="combobox-option__dot" style="background:${escapeHtml(idol.color)}"></span>
          <span>${escapeHtml(idol.name)}</span>
        </button>`
      )
      .join('');
  };

  dom.efTitle.addEventListener('focus', () => {
    renderOpts(dom.efTitle.value);
    dom.efIdolDropdown.classList.add('is-open');
    dom.efTitle.setAttribute('aria-expanded', 'true');
  });

  dom.efTitle.addEventListener('blur', () => {
    setTimeout(() => {
      if (!document.activeElement || !document.activeElement.closest('.combobox-wrap')) {
        dom.efIdolDropdown.classList.remove('is-open');
        dom.efTitle.setAttribute('aria-expanded', 'false');
      }
    }, 150);
  });

  function applyIdolSelection(name, color) {
    const val = `${name}担当`;
    dom.efTitle.value = val;
    project.fields.title = val;
    project.tantouIdol = name;
    if (dom.efUseAccent.getAttribute('aria-checked') === 'true') project.accent = color;
    dom.efIdolDropdown.classList.remove('is-open');
    renderCanvas();
    update3D();
    commitChange(true);
  }

  dom.efTitle.addEventListener('keydown', (e) => {
    const opts = Array.from(dom.efIdolDropdown.querySelectorAll('.combobox-option'));
    if (!opts.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIdolIdx = (highlightedIdolIdx + 1) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('is-highlighted', i === highlightedIdolIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIdolIdx = (highlightedIdolIdx - 1 + opts.length) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('is-highlighted', i === highlightedIdolIdx));
    } else if (e.key === 'Enter' && highlightedIdolIdx >= 0) {
      e.preventDefault();
      const opt = opts[highlightedIdolIdx];
      applyIdolSelection(opt.dataset.idolName, opt.dataset.idolColor);
    } else if (e.key === 'Escape') dom.efIdolDropdown.classList.remove('is-open');
  });

  dom.efIdolDropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.combobox-option');
    if (opt) applyIdolSelection(opt.dataset.idolName, opt.dataset.idolColor);
  });
}

function bindEvents() {
  dom.fileNameInput.addEventListener('blur', () => {
    project.fileName = dom.fileNameInput.value.trim() || '未命名名刺方案';
    commitChange(true);
  });

  dom.undoBtn.addEventListener('click', () => {
    const prev = store.history.undo();
    if (!prev) return;
    project = prev;
    selectedId = null;
    syncFormInputs();
    refreshAll(false);
    syncUndoRedoButtons();
    store.save(project);
  });

  dom.redoBtn.addEventListener('click', () => {
    const next = store.history.redo();
    if (!next) return;
    project = next;
    selectedId = null;
    syncFormInputs();
    refreshAll(false);
    syncUndoRedoButtons();
    store.save(project);
  });

  dom.modeFormBtn.addEventListener('click', () => switchMode('form'));
  dom.modeCanvasBtn.addEventListener('click', () => switchMode('canvas'));
  dom.sideFrontBtn.addEventListener('click', () => switchSide('front'));
  dom.sideBackBtn.addEventListener('click', () => switchSide('back'));

  dom.sidesDoubleBtn?.addEventListener('click', () => {
    project.sides = 2;
    refreshAll(true);
  });
  dom.sidesSingleBtn?.addEventListener('click', () => {
    project.sides = 1;
    project.side = 'front';
    refreshAll(true);
  });

  dom.restoreCanvasBtn?.addEventListener('click', () => {
    if (!project.savedCanvas) return;
    project.canvas = project.savedCanvas;
    project.savedCanvas = null;
    project.mode = 'canvas';
    syncFormInputs();
    refreshAll(true);
    showToast('已恢复自由画布排版 ✦');
  });

  dom.saveAsTplBtn?.addEventListener('click', async () => {
    const name = window.prompt('将当前名刺存为个人模板，请输入模板名称：', `${project.fileName || '我的制作人名刺'} 模板`);
    if (!name || !name.trim()) return;
    const savedTpl = await store.saveProjectAsTemplate(project, name.trim());
    showToast(`已存为个人模板：${savedTpl.name} ✦`);
  });

  ['backTemplatesBtn', 'goWorksBtn', 'goPhygitalBtn', 'goExportBtn'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => store.save(project));
  });

  // Standee upload & framing
  dom.standeeUploadInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleImageUpload(file, true);
    e.target.value = '';
  });
  dom.standeeResetBtn?.addEventListener('click', () => {
    project.standee = { dataUrl: '', scale: 1, offsetX: 0, offsetY: 0 };
    syncStandeeUI();
    refreshAll(true);
    showToast('已恢复偶像初始立绘徽章');
  });
  [
    [dom.standeeScaleSlider, 'scale'],
    [dom.standeeOffsetXSlider, 'offsetX'],
    [dom.standeeOffsetYSlider, 'offsetY']
  ].forEach(([slider, prop]) => {
    slider?.addEventListener('input', () => {
      if (!project.standee) project.standee = { dataUrl: '', scale: 1, offsetX: 0, offsetY: 0 };
      project.standee[prop] = Number(slider.value);
      renderCanvas();
      update3D();
      commitChange(false);
    });
  });

  const fieldMap = [
    [dom.efName, 'name'],
    [dom.efEnName, 'enName'],
    [dom.efTitle, 'title'],
    [dom.efCompany, 'company'],
    [dom.efPid, 'pid'],
    [dom.efEventTag, 'eventTag'],
    [dom.efX, 'x'],
    [dom.efWeibo, 'weibo'],
    [dom.efBilibili, 'bilibili'],
    [dom.efXhs, 'xhs'],
    [dom.efFavSong, 'favSong'],
    [dom.efBackTitle, 'backTitle'],
    [dom.efBackSub, 'backSub'],
    [dom.efQrCustomUrl, 'qrCustomUrl']
  ].filter(([inp]) => Boolean(inp));

  const onFormInput = debounce(() => {
    fieldMap.forEach(([input, key]) => {
      project.fields[key] = input.value;
    });
    const matched = IDOLS.find((i) => (project.fields.title || '').includes(i.name));
    project.tantouIdol = matched ? matched.name : '';
    if (matched && dom.efUseAccent.getAttribute('aria-checked') === 'true') {
      project.accent = matched.color;
    }
    renderCanvas();
    update3D();
    commitChange(false);
  }, 150);

  fieldMap.forEach(([input]) => input.addEventListener('input', onFormInput));

  dom.efQrMode?.addEventListener('change', () => {
    project.fields.qrMode = dom.efQrMode.value;
    if (dom.efQrCustomUrl) dom.efQrCustomUrl.hidden = project.fields.qrMode !== 'custom';
    renderCanvas();
    update3D();
    commitChange(true);
  });

  document.querySelectorAll('[data-ef-company]').forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.efCompany.value = chip.dataset.efCompany;
      project.fields.company = dom.efCompany.value;
      renderCanvas();
      update3D();
      commitChange(true);
    });
  });

  dom.efUseAccent.addEventListener('click', () => {
    const next = dom.efUseAccent.getAttribute('aria-checked') !== 'true';
    dom.efUseAccent.setAttribute('aria-checked', next ? 'true' : 'false');
    const t = store.getTemplate(project.templateId);
    const matched = IDOLS.find((i) => (project.fields.title || '').includes(i.name));
    project.accent = next && matched ? matched.color : t.color;
    renderCanvas();
    update3D();
    commitChange(true);
  });

  dom.efQrToggle.addEventListener('click', () => {
    const next = dom.efQrToggle.getAttribute('aria-checked') !== 'true';
    dom.efQrToggle.setAttribute('aria-checked', next ? 'true' : 'false');
    project.fields.qr = next;
    if (dom.efQrModeWrap) dom.efQrModeWrap.hidden = !next;
    renderCanvas();
    update3D();
    commitChange(true);
  });

  bindIdolCombobox();

  dom.specSelect.addEventListener('change', () => {
    project.spec = dom.specSelect.value;
    renderCanvas();
    renderPropertiesPanel();
    update3D();
    commitChange(true);
  });

  dom.cornerSelect.addEventListener('change', () => {
    project.corner = Number(dom.cornerSelect.value) || 0;
    renderCanvas();
    update3D();
    commitChange(true);
  });

  document.querySelectorAll('[data-guide]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.guide;
      if (!project.guides) project.guides = { bleed: true, trim: true, safe: true };
      project.guides[k] = !project.guides[k];
      syncTopbarControls();
      renderCanvas();
      commitChange(false);
    });
  });

  dom.zoomSlider.addEventListener('input', () => { zoom = Number(dom.zoomSlider.value) / 100; renderCanvas(); });
  dom.zoomFitBtn.addEventListener('click', () => { zoom = 1; renderCanvas(); });

  document.querySelectorAll('[data-side-stock]').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (!project.sideMaterials) project.sideMaterials = { front: 'inherit', back: 'inherit' };
      project.sideMaterials[sel.dataset.sideStock] = sel.value;
      selectedRegion = sel.dataset.sideStock === 'back' ? 'backBg' : 'frontBg';
      refreshAll(true);
    });
  });

  document.querySelectorAll('[data-region-mat]').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (!project.regionMaterials) project.regionMaterials = store.defaultRegionMaterials();
      const rKey = sel.dataset.regionMat;
      project.regionMaterials[rKey] = sel.value;
      selectedRegion = rKey;
      refreshAll(true);
    });
  });

  dom.materialSwatches.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mat-id]');
    if (!btn) return;
    project.material = btn.dataset.matId;
    populateMaterialSelects();
    syncFormInputs();
    refreshAll(true);
  });

  dom.craftChips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-craft-id]');
    if (!btn) return;
    const k = btn.dataset.craftId;
    const el = getSelectedElement();
    if (project.mode === 'canvas' && el) {
      el.craft = el.craft === k ? 'none' : k;
      if (el.bind && project.regionMaterials && el.bind in project.regionMaterials) {
        project.regionMaterials[el.bind] = el.craft;
      }
    } else {
      if (!project.regionMaterials) project.regionMaterials = store.defaultRegionMaterials();
      const targetRegion =
        selectedRegion && selectedRegion !== 'frontBg' && selectedRegion !== 'backBg'
          ? selectedRegion
          : project.side === 'back' ? 'backJp' : 'name';
      project.regionMaterials[targetRegion] = project.regionMaterials[targetRegion] === k ? 'none' : k;
    }
    syncFormInputs();
    refreshAll(true);
  });

  document.querySelectorAll('[data-tool-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeToolTab = btn.dataset.toolTab;
      document.querySelectorAll('[data-tool-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderToolDrawer();
    });
  });

  dom.toolDrawer.addEventListener('click', (e) => {
    const tplBtn = e.target.closest('[data-switch-tpl]');
    if (tplBtn) {
      const nextId = tplBtn.dataset.switchTpl;
      if (project.canvas && (project.canvas.front || project.canvas.back)) {
        if (!window.confirm('切换模板将重置正反两面的自由排版，是否继续？')) return;
        project.canvas.front = null;
        project.canvas.back = null;
      }
      project.templateId = nextId;
      const t = store.getTemplate(nextId);
      if (dom.efUseAccent.getAttribute('aria-checked') !== 'true') project.accent = t.color;
      if (project.mode === 'canvas') ensureCanvasElementsForCurrentSide();
      refreshAll(true);
      return;
    }

    const txtBtn = e.target.closest('[data-add-text]');
    if (txtBtn) { addTextPreset(txtBtn.dataset.addText); return; }

    const iconBtn = e.target.closest('[data-add-icon]');
    if (iconBtn) { addIconElement(iconBtn.dataset.addIcon); return; }

    const shapeBtn = e.target.closest('[data-add-shape]');
    if (shapeBtn) { addShapeElement(shapeBtn.dataset.addShape); return; }

    const placeImg = e.target.closest('[data-place-img]');
    if (placeImg) {
      const rec = (project.images || []).find((i) => i.id === placeImg.dataset.placeImg);
      if (rec) placeImageElement(rec);
      return;
    }

    const patBtn = e.target.closest('[data-set-pattern]');
    if (patBtn) { project.pattern = patBtn.dataset.setPattern; refreshAll(true); }
  });

  dom.toolDrawer.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'imgUploadInput') {
      handleImageUpload(e.target.files[0], false);
    }
  });

  dom.layerPanel.addEventListener('click', (e) => {
    const visBtn = e.target.closest('[data-layer-vis]');
    if (visBtn) {
      e.stopPropagation();
      const el = (project.canvas[project.side] || []).find((item) => item.id === visBtn.dataset.layerVis);
      if (el) { el.visible = el.visible === false; refreshAll(true); }
      return;
    }
    const lockBtn = e.target.closest('[data-layer-lock]');
    if (lockBtn) {
      e.stopPropagation();
      const el = (project.canvas[project.side] || []).find((item) => item.id === lockBtn.dataset.layerLock);
      if (el) { el.locked = !el.locked; refreshAll(true); }
      return;
    }
    const row = e.target.closest('[data-layer-id]');
    if (row) {
      selectedId = row.dataset.layerId;
      renderCanvas();
      renderPropertiesPanel();
      renderLayersPanel();
    }
  });

  let current3dEnv = 'studio';
  document.getElementById('expand3dBtn').addEventListener('click', () => {
    dom.modal3d.classList.add('is-open');
    dom.modal3d.setAttribute('aria-hidden', 'false');
    if (thumb3d && thumb3d.setPaused) thumb3d.setPaused(true);
    if (!modal3d) {
      modal3d = mount3D(document.getElementById('preview3dModalMount'), () => project, {
        interactive: true,
        autoRotate: dom.autoRotateToggle.getAttribute('aria-checked') === 'true',
        env: current3dEnv,
        size: 560
      });
    } else {
      modal3d.setPaused && modal3d.setPaused(false);
      modal3d.update();
    }
  });

  const closeModal3d = () => {
    dom.modal3d.classList.remove('is-open');
    dom.modal3d.setAttribute('aria-hidden', 'true');
    if (modal3d) { modal3d.setAutoRotate(false); modal3d.setPaused && modal3d.setPaused(true); }
    if (thumb3d && thumb3d.setPaused) { thumb3d.setPaused(false); thumb3d.update(); }
  };

  document.getElementById('close3dBtn').addEventListener('click', closeModal3d);
  dom.modal3d.addEventListener('click', (e) => { if (e.target === dom.modal3d) closeModal3d(); });
  document.querySelectorAll('[data-3d-view]').forEach((btn) => {
    btn.addEventListener('click', () => modal3d && modal3d.setView(btn.dataset['3dView']));
  });
  document.querySelectorAll('[data-3d-env]').forEach((btn) => {
    btn.addEventListener('click', () => {
      current3dEnv = btn.dataset['3dEnv'];
      document.querySelectorAll('[data-3d-env]').forEach((b) => b.classList.toggle('is-active', b === btn));
      if (modal3d && modal3d.setEnv) modal3d.setEnv(current3dEnv);
    });
  });
  document.getElementById('lightAngleSlider').addEventListener('input', (e) => modal3d && modal3d.setLight(e.target.value));
  dom.autoRotateToggle.addEventListener('click', () => {
    const next = dom.autoRotateToggle.getAttribute('aria-checked') !== 'true';
    dom.autoRotateToggle.setAttribute('aria-checked', next ? 'true' : 'false');
    if (modal3d) modal3d.setAutoRotate(next);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modal3d.classList.contains('is-open')) { closeModal3d(); return; }
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) dom.redoBtn.click();
      else dom.undoBtn.click();
      return;
    }

    if (project.mode !== 'canvas') return;
    const el = getSelectedElement();

    if (isMod && e.key.toLowerCase() === 'c' && el) {
      clipboardEl = JSON.parse(JSON.stringify(el));
      showToast('已复制元素');
      return;
    }
    if (isMod && e.key.toLowerCase() === 'v' && clipboardEl) {
      e.preventDefault();
      ensureCanvasElementsForCurrentSide();
      const copy = { ...JSON.parse(JSON.stringify(clipboardEl)), id: store.uid(), x: Math.min(92, clipboardEl.x + 3), y: Math.min(92, clipboardEl.y + 3) };
      project.canvas[project.side].push(copy);
      selectedId = copy.id;
      refreshAll(true);
      return;
    }

    if (!el) return;
    if (isMod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateElement(el.id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteElement(el.id); return; }

    if (!el.locked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 2 : 0.5;
      if (e.key === 'ArrowLeft') el.x = Number((el.x - step).toFixed(2));
      if (e.key === 'ArrowRight') el.x = Number((el.x + step).toFixed(2));
      if (e.key === 'ArrowUp') el.y = Number((el.y - step).toFixed(2));
      if (e.key === 'ArrowDown') el.y = Number((el.y + step).toFixed(2));
      renderCanvas();
      update3D();
      commitChange(false);
    }
  });

  bindCanvasDrag();
  window.addEventListener('resize', debounce(renderCanvas, 120));
}

function applyFocusParam() {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('focus');
  const side = params.get('side');
  if (side === 'front' || side === 'back') project.side = side;
  if (!focus) return;

  if (focus.startsWith('field:')) {
    const fieldKey = focus.slice(6);
    project.mode = 'form';
    syncTopbarControls();
    renderCanvas();
    const target = { name: dom.efName, enName: dom.efEnName, title: dom.efTitle, company: dom.efCompany, x: dom.efX }[fieldKey] || dom.efName;
    if (target) {
      requestAnimationFrame(() => {
        target.focus();
        target.classList.add('is-focus-flash');
        setTimeout(() => target.classList.remove('is-focus-flash'), 1800);
      });
    }
  } else if (focus.startsWith('el:') || focus.startsWith('image:')) {
    const targetId = focus.split(':')[1];
    project.mode = 'canvas';
    ensureCanvasElementsForCurrentSide();
    selectedId = targetId;
    refreshAll(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  dom.specSelect.innerHTML = Object.entries(store.SPECS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  await bootCommon();
  project = store.initProject();
  store.history.restoreOrInit(project);
  populateMaterialSelects();
  syncUndoRedoButtons();
  syncFormInputs();
  syncTopbarControls();
  renderMaterialsAndCrafts();
  renderCanvas();
  renderPropertiesPanel();
  renderLayersPanel();
  renderToolDrawer();

  thumb3d = mount3D(document.getElementById('preview3dThumb'), () => project, { interactive: true, autoRotate: false, size: 260 });
  bindEvents();
  applyFocusParam();

  updateSaveLabel(store.formatTime(project.updatedAt));
  setInterval(() => updateSaveLabel(store.save(project)), 5000);
});

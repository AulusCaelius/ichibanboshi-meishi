/**
 * 印前检查与导出页面逻辑 (v1.0)：8 项质检 + 一键自动修复 + DeviceCMYK PDF / 多面 ZIP 导出
 */

import * as store from '../core/store.mjs';
import { STYLE_BG, renderFace, fitText, escapeHtml } from '../core/card-render.mjs';
import { runPreflight, applyAutoFix, applyAllAutoFixes, estimateSize } from '../core/preflight.mjs';
import { detectActiveCrafts, buildCompositeSvgMarkup, exportProject } from '../core/print-engine.mjs';
import { bootCommon, showToast } from '../ui/common.mjs';

let project = null;
let lastChecks = [];
let previewTab = 'front';
let lastExportResult = null;
const dom = {};

function cacheDom() {
  dom.saveStatus = document.getElementById('expSaveStatus');
  dom.pfSummary = document.getElementById('pfSummary');
  dom.pfAutoFixAllBtn = document.getElementById('pfAutoFixAllBtn');
  dom.pfList = document.getElementById('pfList');
  dom.recheckBtn = document.getElementById('recheckBtn');
  dom.sandbox = document.getElementById('pfMeasureSandbox');
  dom.previewTabs = document.getElementById('expPreviewTabs');
  dom.bleedWrap = document.getElementById('expBleedWrap');
  dom.previewCard = document.getElementById('expPreviewCard');
  dom.cropMarks = document.getElementById('expCropMarks');
  dom.specCaption = document.getElementById('expSpecCaption');
  dom.colorForceHint = document.getElementById('colorForceHint');
  dom.cropMarksSwitch = document.getElementById('cropMarksSwitch');
  dom.spotSwitch = document.getElementById('spotSwitch');
  dom.spotHint = document.getElementById('spotHint');
  dom.estSizeVal = document.getElementById('estSizeVal');
  dom.blockAlert = document.getElementById('expBlockAlert');
  dom.ignoreRiskChk = document.getElementById('ignoreRiskChk');
  dom.downloadBtn = document.getElementById('downloadPrintBtn');
  dom.progressWrap = document.getElementById('expProgressWrap');
  dom.progressFill = document.getElementById('expProgressFill');
  dom.configPanel = document.getElementById('expConfigPanel');
  dom.receiptPanel = document.getElementById('expReceiptPanel');
  dom.receiptSummary = document.getElementById('expReceiptSummary');
  dom.dlMainAgainBtn = document.getElementById('dlMainAgainBtn');
  dom.dlSideBtnsMount = document.getElementById('dlSideBtnsMount');
  dom.dlSpotBtn = document.getElementById('dlSpotBtn');
}

function saveProject() {
  const t = store.save(project);
  if (dom.saveStatus) {
    dom.saveStatus.innerHTML = `<i class="ws-save-status__star" aria-hidden="true">✦</i> 已自动保存于 ${t}`;
  }
}

function inferBindFromClass(node) {
  if (node.classList.contains('bcard__name')) return 'name';
  if (node.classList.contains('bcard__en')) return 'enName';
  if (node.classList.contains('bcard__title')) return 'title';
  if (node.classList.contains('bcard__company')) return 'company';
  if (node.classList.contains('bcard__sns-item')) return node.dataset.snsKey || 'x';
  return undefined;
}

function measureRenderedTexts() {
  const texts = [];
  const textSelector =
    '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__pid, .bcard__event, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en, .bcard-el--text';

  const sides = store.getEffectiveSides(project) === 2 ? ['front', 'back'] : ['front'];
  sides.forEach((side) => {
    dom.sandbox.innerHTML = `<div style="width:540px;">${renderFace(project, side)}</div>`;
    const cardEl = dom.sandbox.querySelector('.bcard');
    if (!cardEl) return;
    if (!project.canvas || !project.canvas[side]) fitText(dom.sandbox);
    const cardRect = cardEl.getBoundingClientRect();
    const cardPx = cardRect.width || 540;

    cardEl.querySelectorAll(textSelector).forEach((node) => {
      if (!node.textContent || !node.textContent.trim()) return;
      const cs = window.getComputedStyle(node);
      if (cs.display === 'none') return;
      const px = parseFloat(cs.fontSize) || 12;
      texts.push({ side, elId: node.dataset.elId || undefined, bind: inferBindFromClass(node), px, cardPx, color: cs.color });
    });
  });

  dom.sandbox.innerHTML = '';
  return { texts };
}

function runChecksAndRender() {
  const measured = measureRenderedTexts();
  lastChecks = runPreflight(project, measured);

  const errCount = lastChecks.filter((c) => c.status === 'error').length;
  const warnCount = lastChecks.filter((c) => c.status === 'warn').length;
  const autoFixableCount = lastChecks.filter((c) => c.status !== 'pass' && c.canAutoFix).length;

  if (errCount === 0 && warnCount === 0) {
    dom.pfSummary.className = 'pf-summary pf-summary--ok';
    dom.pfSummary.textContent = '✦ 8/8 全部质检通过，可安全印刷';
  } else {
    dom.pfSummary.className = 'pf-summary pf-summary--issue';
    dom.pfSummary.textContent = `发现 ${errCount} 项错误，${warnCount} 项警告`;
  }

  if (dom.pfAutoFixAllBtn) {
    dom.pfAutoFixAllBtn.hidden = autoFixableCount === 0;
    if (autoFixableCount > 0) {
      dom.pfAutoFixAllBtn.textContent = `✦ 一键修复全部 ${autoFixableCount} 项可自动处理问题`;
    }
  }

  dom.pfList.innerHTML = lastChecks
    .map((item) => {
      const autoBtn =
        item.status !== 'pass' && item.canAutoFix
          ? `<button type="button" class="pf-autofix-btn" data-autofix-rule="${escapeHtml(item.id)}">${escapeHtml(item.autoFixLabel || '一键修复')}</button>`
          : '';
      const fixLink =
        item.status !== 'pass' && item.fix
          ? `<a class="pf-fix-link" href="editor.html?focus=${encodeURIComponent(`${item.fix.type}:${item.fix.target}`)}&side=${encodeURIComponent(item.fix.side || 'front')}">定位修复 →</a>`
          : '';
      return `
        <div class="pf-item">
          <div class="pf-item__left">
            <span class="pf-dot pf-dot--${item.status}"></span>
            <div>
              <div class="pf-item__title">${escapeHtml(item.title)}</div>
              <div class="pf-item__detail">${escapeHtml(item.detail)}</div>
            </div>
          </div>
          <div class="pf-actions-bar">${autoBtn}${fixLink}</div>
        </div>`;
    })
    .join('');

  updateBlockState(errCount);
}

function updateBlockState(errCount) {
  const exp = project.export || {};
  const isVectorPrint = exp.format === 'pdf' || exp.format === 'svg';
  const blocked = errCount > 0 && isVectorPrint;
  dom.blockAlert.hidden = !blocked;
  dom.ignoreRiskChk.checked = Boolean(exp.ignoreRisk);
  dom.downloadBtn.disabled = blocked && !exp.ignoreRisk;
}

function syncExportUI() {
  const exp = project.export || {};
  const dims = store.getDims(project);
  const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
  const t = store.getTemplate(project.templateId);
  const activeCrafts = detectActiveCrafts(project);
  const isDouble = store.getEffectiveSides(project) === 2;

  const backTab = dom.previewTabs ? dom.previewTabs.querySelector('[data-exp-tab="back"]') : null;
  if (backTab) {
    backTab.hidden = !isDouble;
    if (!isDouble && previewTab === 'back') previewTab = 'front';
  }
  const spotTab = dom.previewTabs ? dom.previewTabs.querySelector('[data-exp-tab="spot"]') : null;
  if (spotTab) {
    spotTab.hidden = !exp.spot;
    if (!exp.spot && previewTab === 'spot') previewTab = 'front';
  }
  if (dom.previewTabs) {
    dom.previewTabs.querySelectorAll('[data-exp-tab]').forEach((btn) => {
      const active = btn.dataset.expTab === previewTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  const isSpotView = previewTab === 'spot';
  const renderSide = previewTab === 'back' ? 'back' : 'front';

  dom.bleedWrap.style.padding = `${bleed * 3}px`;
  dom.bleedWrap.style.backgroundColor = isSpotView ? '#FFFFFF' : bleed > 0 ? STYLE_BG[t.style] || '#FFFFFF' : 'transparent';
  dom.bleedWrap.classList.toggle('spot-preview-wrap', isSpotView);
  dom.cropMarks.style.display = exp.cropMarks !== false ? 'block' : 'none';
  dom.previewCard.innerHTML = renderFace(project, renderSide);
  requestAnimationFrame(() => fitText(dom.previewCard));

  dom.specCaption.textContent = isSpotView
    ? `K100 专色黑版 · 识别工艺：${activeCrafts.length ? activeCrafts.map((c) => c.label).join(' / ') : '未标注工艺'}`
    : `成品 ${dims.w}×${dims.h}mm · 含出血 ${dims.w + 2 * bleed}×${dims.h + 2 * bleed}mm`;

  document.querySelectorAll('[data-exp-fmt]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.expFmt === exp.format));

  const isRaster = exp.format === 'png' || exp.format === 'jpg';
  if (isRaster && exp.color !== 'rgb') exp.color = 'rgb';
  dom.colorForceHint.hidden = !isRaster;

  document.querySelectorAll('[data-exp-color]').forEach((btn) => {
    const c = btn.dataset.expColor;
    btn.classList.toggle('is-active', c === exp.color);
    btn.disabled = isRaster && c === 'cmyk';
  });

  document.querySelectorAll('[data-exp-dpi]').forEach((btn) => btn.classList.toggle('is-active', Number(btn.dataset.expDpi) === Number(exp.dpi)));
  document.querySelectorAll('[data-exp-bleed]').forEach((btn) => btn.classList.toggle('is-active', Number(btn.dataset.expBleed) === Number(exp.bleed)));

  dom.cropMarksSwitch.setAttribute('aria-checked', exp.cropMarks !== false ? 'true' : 'false');
  dom.spotSwitch.setAttribute('aria-checked', exp.spot ? 'true' : 'false');
  dom.spotHint.textContent = exp.spot
    ? activeCrafts.length
      ? `已激活专色分离：${activeCrafts.map((c) => c.label).join('、')}（导出附带 K100 通道）`
      : '已开启专色导出；建议先在编辑器标注元素/区域工艺'
    : '开启后将输出 K100 专色黑版用于烫金 / 烫银 / 局部 UV / 凹凸制版';

  document.querySelectorAll('[data-exp-text]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.expText === exp.text));
  dom.estSizeVal.textContent = estimateSize(project);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSvgPreview() {
  const exp = project.export || {};
  const sides = store.getEffectiveSides(project) === 2 ? ['front', 'back'] : ['front'];
  const svgContent = buildCompositeSvgMarkup(project, dom.sandbox, {
    bleed: exp.bleed != null ? Number(exp.bleed) : 3,
    cropMarks: exp.cropMarks !== false,
    spotMode: false,
    sides
  });
  triggerDownload(new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' }), `${project.fileName || '一番星名刺'}_矢量预览.svg`);
}

function downloadSpecTxt() {
  const dims = store.getDims(project);
  const exp = project.export || {};
  const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
  const crafts = detectActiveCrafts(project);
  const lines = [
    '=== 一番星 ICHIBANBOSHI · 印刷规格与质检单 ===',
    `方案名称：${project.fileName}`,
    `制作人：${(project.fields && project.fields.name) || ''}`,
    `担当职位：${(project.fields && project.fields.title) || ''}`,
    `所属事务所：${(project.fields && project.fields.company) || ''}`,
    '',
    '【印刷导出规格】',
    `导出格式：${String(exp.format || 'pdf').toUpperCase()}`,
    `成品尺寸：${dims.w} × ${dims.h} mm`,
    `含出血尺寸：${dims.w + 2 * bleed} × ${dims.h + 2 * bleed} mm（每边出血 ${bleed}mm）`,
    `色彩空间：${exp.color === 'cmyk' ? 'DeviceCMYK' : 'sRGB'}`,
    `分辨率：${exp.dpi || 300} DPI`,
    `纸张材质：${(store.MATERIALS[project.material] || store.MATERIALS.matte).label}`,
    `专色工艺通道：${exp.spot ? '已分离（' + (crafts.map((c) => c.label).join(' / ') || '通用 K100 版') + '）' : '未分离'}`,
    '',
    '【Preflight 质检结果】',
    ...lastChecks.map((c, idx) => `${idx + 1}. [${c.status.toUpperCase()}] ${c.title} - ${c.detail}`)
  ];
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `${project.fileName || '一番星名刺'}_印刷规格单.txt`);
}

function showReceipt(result) {
  const dims = store.getDims(project);
  const exp = project.export || {};
  const bleed = exp.bleed != null ? Number(exp.bleed) : 3;

  lastExportResult = result;
  dom.configPanel.hidden = true;
  dom.receiptPanel.hidden = false;

  const fmtUpper = String(exp.format || 'pdf').toUpperCase();
  dom.receiptSummary.innerHTML = `
    <div><dt>导出格式</dt><dd>${escapeHtml(fmtUpper)}（${result.pageCount} 页/文件）</dd></div>
    <div><dt>成品尺寸</dt><dd>${dims.w} × ${dims.h} mm</dd></div>
    <div><dt>含出血尺寸</dt><dd>${dims.w + 2 * bleed} × ${dims.h + 2 * bleed} mm</dd></div>
    <div><dt>色彩 / 分辨率</dt><dd>${exp.color === 'cmyk' ? 'DeviceCMYK' : 'RGB'} · ${exp.dpi} DPI</dd></div>
    <div><dt>工艺专色通道</dt><dd>${exp.spot ? '已分离 K100 通道' : '普通合版'}</dd></div>
    <div><dt>实际文件体积</dt><dd>${escapeHtml(result.sizeText)}</dd></div>
  `;

  dom.dlMainAgainBtn.textContent = `重新下载成品 (${result.filename} · ${result.sizeText})`;
  dom.dlSpotBtn.hidden = !result.spotBlob;

  if (dom.dlSideBtnsMount) {
    dom.dlSideBtnsMount.innerHTML = (result.sideFiles || [])
      .map(
        (sf, idx) =>
          `<button type="button" class="chip" style="width:100%;min-height:38px;" data-dl-side-idx="${idx}">单独下载：${escapeHtml(sf.name)}</button>`
      )
      .join('');
    dom.dlSideBtnsMount.querySelectorAll('[data-dl-side-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sf = result.sideFiles[Number(btn.dataset.dlSideIdx)];
        if (sf) triggerDownload(sf.blob, sf.name);
      });
    });
  }
}

function bindEvents() {
  dom.recheckBtn.addEventListener('click', () => {
    runChecksAndRender();
    showToast('已完成全项印前重新校验 ✦');
  });

  if (dom.pfAutoFixAllBtn) {
    dom.pfAutoFixAllBtn.addEventListener('click', () => {
      const count = applyAllAutoFixes(project, lastChecks);
      if (count > 0) {
        saveProject();
        runChecksAndRender();
        showToast(`已一键自动修复 ${count} 项印前问题 ✦`);
      }
    });
  }

  dom.pfList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-autofix-rule]');
    if (!btn) return;
    if (applyAutoFix(project, btn.dataset.autofixRule)) {
      saveProject();
      runChecksAndRender();
      showToast('已自动修复该项印前风险 ✦');
    }
  });

  if (dom.previewTabs) {
    dom.previewTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-exp-tab]');
      if (!btn) return;
      previewTab = btn.dataset.expTab;
      syncExportUI();
    });
  }

  document.querySelectorAll('[data-exp-fmt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      project.export.format = btn.dataset.expFmt;
      syncExportUI();
      runChecksAndRender();
      saveProject();
    });
  });

  document.querySelectorAll('[data-exp-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      project.export.color = btn.dataset.expColor;
      syncExportUI();
      runChecksAndRender();
      saveProject();
    });
  });

  document.querySelectorAll('[data-exp-dpi]').forEach((btn) => {
    btn.addEventListener('click', () => {
      project.export.dpi = Number(btn.dataset.expDpi);
      syncExportUI();
      saveProject();
    });
  });

  document.querySelectorAll('[data-exp-bleed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      project.export.bleed = Number(btn.dataset.expBleed);
      syncExportUI();
      saveProject();
    });
  });

  dom.cropMarksSwitch.addEventListener('click', () => {
    project.export.cropMarks = project.export.cropMarks === false;
    syncExportUI();
    saveProject();
  });

  dom.spotSwitch.addEventListener('click', () => {
    project.export.spot = !project.export.spot;
    if (project.export.spot) {
      previewTab = 'spot';
      showToast('已开启工艺专色分离，可切换「专色黑版」预览 ✦');
    }
    syncExportUI();
    saveProject();
  });

  document.querySelectorAll('[data-exp-text]').forEach((btn) => {
    btn.addEventListener('click', () => {
      project.export.text = btn.dataset.expText;
      syncExportUI();
      saveProject();
    });
  });

  dom.ignoreRiskChk.addEventListener('change', () => {
    project.export.ignoreRisk = dom.ignoreRiskChk.checked;
    updateBlockState(lastChecks.filter((c) => c.status === 'error').length);
    saveProject();
  });

  dom.downloadBtn.addEventListener('click', async () => {
    if (dom.downloadBtn.disabled) return;
    dom.downloadBtn.disabled = true;
    dom.progressWrap.hidden = false;
    dom.progressFill.style.width = '10%';
    try {
      const result = await exportProject(project, dom.sandbox, (pct) => {
        dom.progressFill.style.width = `${pct}%`;
      });
      setTimeout(() => {
        dom.progressWrap.hidden = true;
        dom.downloadBtn.disabled = false;
        triggerDownload(result.blob, result.filename);
        showToast(`已生成并下载：${result.filename} (${result.sizeText}) ✦`);
        showReceipt(result);
      }, 220);
    } catch {
      dom.progressWrap.hidden = true;
      dom.downloadBtn.disabled = false;
      showToast('导出生成失败，请重试');
    }
  });

  dom.dlMainAgainBtn.addEventListener('click', () => {
    if (lastExportResult) triggerDownload(lastExportResult.blob, lastExportResult.filename);
  });
  dom.dlSpotBtn.addEventListener('click', () => {
    if (lastExportResult && lastExportResult.spotBlob) {
      triggerDownload(lastExportResult.spotBlob, lastExportResult.spotFilename);
    }
  });

  document.getElementById('dlSvgBtn').addEventListener('click', downloadSvgPreview);
  document.getElementById('dlTxtBtn').addEventListener('click', downloadSpecTxt);
  document.getElementById('expBackEditor').addEventListener('click', saveProject);
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await bootCommon();
  project = store.initProject();
  syncExportUI();
  runChecksAndRender();
  bindEvents();
  saveProject();
});

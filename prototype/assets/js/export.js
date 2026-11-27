/* ==========================================================
   印前检查与导出页面逻辑 (export.html)
   ========================================================== */

(function () {
  const { fitText, escapeHtml } = window.IchibanCard;
  const { showToast } = window.IchibanCommon;
  const store = window.IchibanStore;
  const renderer = window.IchibanProject;
  const preflight = window.IchibanPreflight;
  const printExport = window.IchibanPrintExport;

  let project = null;
  let lastChecks = [];
  let previewTab = 'front';
  let lastExportResult = null;
  const dom = {};

  function cacheDom() {
    dom.saveStatus = document.getElementById('expSaveStatus');
    dom.pfSummary = document.getElementById('pfSummary');
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
    dom.dlSpotBtn = document.getElementById('dlSpotBtn');
  }

  function saveProject() {
    const t = store.save(project);
    if (dom.saveStatus) {
      dom.saveStatus.innerHTML = `<i class="ws-save-status__star" aria-hidden="true">✦</i> 已自动保存于 ${t}`;
    }
  }

  function measureRenderedTexts() {
    const texts = [];
    const textSelector =
      '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en, .bcard-el--text';

    ['front', 'back'].forEach((side) => {
      dom.sandbox.innerHTML = `<div style="width:540px;">${renderer.renderFace(project, side)}</div>`;
      const cardEl = dom.sandbox.querySelector('.bcard');
      if (!cardEl) return;
      if (!project.canvas || !project.canvas[side]) {
        fitText(dom.sandbox);
      }
      const cardRect = cardEl.getBoundingClientRect();
      const cardPx = cardRect.width || 540;

      cardEl.querySelectorAll(textSelector).forEach((node) => {
        if (!node.textContent || !node.textContent.trim()) return;
        const cs = window.getComputedStyle(node);
        if (cs.display === 'none') return;
        const px = parseFloat(cs.fontSize) || 12;
        texts.push({
          side,
          elId: node.dataset.elId || undefined,
          bind: inferBindFromClass(node),
          px,
          cardPx,
          color: cs.color
        });
      });
    });

    dom.sandbox.innerHTML = '';
    return { texts };
  }

  function inferBindFromClass(node) {
    if (node.classList.contains('bcard__name')) return 'name';
    if (node.classList.contains('bcard__en')) return 'enName';
    if (node.classList.contains('bcard__title')) return 'title';
    if (node.classList.contains('bcard__company')) return 'company';
    if (node.classList.contains('bcard__sns-item')) return node.dataset.snsKey || 'x';
    return undefined;
  }

  function runPreflight() {
    const measured = measureRenderedTexts();
    lastChecks = preflight.run(project, measured);

    const errCount = lastChecks.filter((c) => c.status === 'error').length;
    const warnCount = lastChecks.filter((c) => c.status === 'warn').length;

    if (errCount === 0 && warnCount === 0) {
      dom.pfSummary.className = 'pf-summary pf-summary--ok';
      dom.pfSummary.textContent = '✦ 全部质检通过，可安全印刷';
    } else {
      dom.pfSummary.className = 'pf-summary pf-summary--issue';
      dom.pfSummary.textContent = `发现 ${errCount} 项错误，${warnCount} 项警告`;
    }

    dom.pfList.innerHTML = lastChecks
      .map((item) => {
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
            ${fixLink}
          </div>
        `;
      })
      .join('');

    updateBlockState(errCount);
  }

  function updateBlockState(errCount) {
    const exp = project.export || {};
    const isVectorPrint = exp.format === 'pdf' || exp.format === 'svg';
    const hasError = errCount > 0;
    const blocked = hasError && isVectorPrint;

    dom.blockAlert.hidden = !blocked;
    dom.ignoreRiskChk.checked = Boolean(exp.ignoreRisk);
    dom.downloadBtn.disabled = blocked && !exp.ignoreRisk;
  }

  function syncExportUI() {
    const exp = project.export || {};
    const dims = store.getDims(project);
    const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
    const t = store.getTemplate(project.templateId);
    const activeCrafts = printExport ? printExport.detectActiveCrafts(project) : [];

    const spotTab = dom.previewTabs ? dom.previewTabs.querySelector('[data-exp-tab="spot"]') : null;
    if (spotTab) {
      spotTab.hidden = !exp.spot;
      if (!exp.spot && previewTab === 'spot') {
        previewTab = 'front';
      }
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

    // 预览卡出血边距与裁切标记
    dom.bleedWrap.style.padding = `${bleed * 3}px`;
    dom.bleedWrap.style.backgroundColor = isSpotView
      ? '#FFFFFF'
      : bleed > 0
      ? renderer.STYLE_BG[t.style] || '#FFFFFF'
      : 'transparent';
    dom.bleedWrap.classList.toggle('spot-preview-wrap', isSpotView);
    dom.cropMarks.style.display = exp.cropMarks !== false ? 'block' : 'none';
    dom.previewCard.innerHTML = renderer.renderFace(project, renderSide);
    requestAnimationFrame(() => fitText(dom.previewCard));

    dom.specCaption.textContent = isSpotView
      ? `K100 专色黑版 · 识别工艺：${activeCrafts.length ? activeCrafts.map((c) => c.label).join(' / ') : '未标注工艺（请先在编辑器开启或标注）'}`
      : `成品 ${dims.w}×${dims.h}mm · 含出血 ${dims.w + 2 * bleed}×${dims.h + 2 * bleed}mm`;

    // 格式 Chips
    document.querySelectorAll('[data-exp-fmt]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.expFmt === exp.format);
    });

    const isRaster = exp.format === 'png' || exp.format === 'jpg';
    if (isRaster && exp.color !== 'rgb') {
      exp.color = 'rgb';
    }
    dom.colorForceHint.hidden = !isRaster;

    document.querySelectorAll('[data-exp-color]').forEach((btn) => {
      const c = btn.dataset.expColor;
      btn.classList.toggle('is-active', c === exp.color);
      btn.disabled = isRaster && c === 'cmyk';
    });

    document.querySelectorAll('[data-exp-dpi]').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.expDpi) === Number(exp.dpi));
    });

    document.querySelectorAll('[data-exp-bleed]').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.expBleed) === Number(exp.bleed));
    });

    dom.cropMarksSwitch.setAttribute('aria-checked', exp.cropMarks !== false ? 'true' : 'false');

    if (dom.spotSwitch) {
      dom.spotSwitch.setAttribute('aria-checked', exp.spot ? 'true' : 'false');
    }
    if (dom.spotHint) {
      dom.spotHint.textContent = exp.spot
        ? activeCrafts.length
          ? `已激活专色分离：${activeCrafts.map((c) => c.label).join('、')}（导出时附带 K100 专色通道版）`
          : '已开启专色导出；建议先在编辑器开启烫金/烫银/局部 UV 或标注元素工艺'
        : '开启后将输出 K100 专色黑版用于烫金 / 烫银 / 局部 UV / 凹凸制版';
    }

    document.querySelectorAll('[data-exp-text]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.expText === exp.text);
    });

    dom.estSizeVal.textContent = preflight.estimateSize(project);
  }

  function downloadSvgPreview() {
    const t = store.getTemplate(project.templateId);
    const exp = project.export || {};
    const sides = t && t.sides === 2 ? ['front', 'back'] : ['front'];
    const svgContent = printExport.buildCompositeSvgMarkup(project, dom.sandbox, {
      bleed: exp.bleed != null ? Number(exp.bleed) : 3,
      cropMarks: exp.cropMarks !== false,
      spotMode: false,
      sides
    });
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${project.fileName || '一番星名刺'}_矢量预览.svg`);
  }

  function downloadSpecTxt() {
    const dims = store.getDims(project);
    const exp = project.export || {};
    const bleed = exp.bleed != null ? Number(exp.bleed) : 3;
    const crafts = printExport ? printExport.detectActiveCrafts(project) : [];
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
      `圆角半径：${project.corner || 0} mm`,
      `色彩空间：${String(exp.color || 'cmyk').toUpperCase()}`,
      `分辨率：${exp.dpi || 300} DPI`,
      `裁切线标记：${exp.cropMarks !== false ? '包含' : '不包含'}`,
      `文字处理：${exp.text === 'embed' ? '内嵌字体子集' : '全部文字转曲'}`,
      `纸张材质：${(store.MATERIALS[project.material] || store.MATERIALS.matte).label}`,
      `专色工艺通道：${exp.spot ? '已分离导出（' + (crafts.map((c) => c.label).join(' / ') || '通用 K100 版') + '）' : '未分离'}`,
      '',
      '【Preflight 质检结果】',
      ...lastChecks.map((c, idx) => `${idx + 1}. [${c.status.toUpperCase()}] ${c.title} - ${c.detail}`),
      '',
      '注：本规格单及印前文件由一番星前端印刷引擎生成。'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${project.fileName || '一番星名刺'}_印刷规格单.txt`);
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

  function showReceipt(result) {
    const dims = store.getDims(project);
    const exp = project.export || {};
    const bleed = exp.bleed != null ? Number(exp.bleed) : 3;

    lastExportResult = result;
    dom.configPanel.hidden = true;
    dom.receiptPanel.hidden = false;

    const fmtUpper = String(exp.format || 'pdf').toUpperCase();
    dom.receiptSummary.innerHTML = `
      <div><dt>导出格式</dt><dd>${escapeHtml(fmtUpper)}（${result.pageCount} 页）</dd></div>
      <div><dt>成品尺寸</dt><dd>${dims.w} × ${dims.h} mm</dd></div>
      <div><dt>含出血尺寸</dt><dd>${dims.w + 2 * bleed} × ${dims.h + 2 * bleed} mm</dd></div>
      <div><dt>色彩 / 分辨率</dt><dd>${escapeHtml(String(exp.color).toUpperCase())} · ${exp.dpi} DPI</dd></div>
      <div><dt>工艺专色通道</dt><dd>${exp.spot ? '已分离 K100 通道' : '普通合版'}</dd></div>
      <div><dt>实际文件体积</dt><dd>${escapeHtml(result.sizeText)}</dd></div>
    `;

    if (dom.dlMainAgainBtn) {
      dom.dlMainAgainBtn.textContent = `重新下载印刷成品 (.${exp.format || 'pdf'} · ${result.sizeText})`;
    }
    if (dom.dlSpotBtn) {
      dom.dlSpotBtn.hidden = !result.spotBlob;
    }
  }

  function bindEvents() {
    dom.recheckBtn.addEventListener('click', () => {
      runPreflight();
      showToast('已完成全项印前重新校验 ✦');
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
        runPreflight();
        saveProject();
      });
    });

    document.querySelectorAll('[data-exp-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        project.export.color = btn.dataset.expColor;
        syncExportUI();
        runPreflight();
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

    if (dom.spotSwitch) {
      dom.spotSwitch.addEventListener('click', () => {
        project.export.spot = !project.export.spot;
        if (project.export.spot) {
          previewTab = 'spot';
          showToast('已开启工艺专色分离，可切换「专色黑版」预览 ✦');
        }
        syncExportUI();
        saveProject();
      });
    }

    document.querySelectorAll('[data-exp-text]').forEach((btn) => {
      btn.addEventListener('click', () => {
        project.export.text = btn.dataset.expText;
        syncExportUI();
        saveProject();
      });
    });

    dom.ignoreRiskChk.addEventListener('change', () => {
      project.export.ignoreRisk = dom.ignoreRiskChk.checked;
      const errCount = lastChecks.filter((c) => c.status === 'error').length;
      updateBlockState(errCount);
      saveProject();
    });

    dom.downloadBtn.addEventListener('click', async () => {
      if (dom.downloadBtn.disabled) return;
      dom.downloadBtn.disabled = true;
      dom.progressWrap.hidden = false;
      dom.progressFill.style.width = '10%';

      try {
        const result = await printExport.exportProject(project, dom.sandbox, (pct) => {
          dom.progressFill.style.width = `${pct}%`;
        });
        setTimeout(() => {
          dom.progressWrap.hidden = true;
          dom.downloadBtn.disabled = false;
          triggerDownload(result.blob, result.filename);
          showToast(`已生成并下载：${result.filename} (${result.sizeText}) ✦`);
          showReceipt(result);
        }, 260);
      } catch (err) {
        dom.progressWrap.hidden = true;
        dom.downloadBtn.disabled = false;
        showToast('导出生成失败，请重试');
      }
    });

    if (dom.dlMainAgainBtn) {
      dom.dlMainAgainBtn.addEventListener('click', () => {
        if (lastExportResult) {
          triggerDownload(lastExportResult.blob, lastExportResult.filename);
        }
      });
    }

    if (dom.dlSpotBtn) {
      dom.dlSpotBtn.addEventListener('click', () => {
        if (lastExportResult && lastExportResult.spotBlob) {
          triggerDownload(lastExportResult.spotBlob, lastExportResult.spotFilename);
        }
      });
    }

    document.getElementById('dlSvgBtn').addEventListener('click', downloadSvgPreview);
    document.getElementById('dlTxtBtn').addEventListener('click', downloadSpecTxt);
    document.getElementById('expBackEditor').addEventListener('click', saveProject);
  }

  document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    project = store.initProject();
    if (!project.export) {
      project.export = { format: 'pdf', color: 'cmyk', dpi: 300, bleed: 3, cropMarks: true, text: 'outline', spot: false, ignoreRisk: false };
    }
    syncExportUI();
    runPreflight();
    bindEvents();
    saveProject();
  });
})();


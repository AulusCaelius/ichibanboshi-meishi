import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import {
  DEFAULT_EXPORT_OPTIONS,
  applyPreflightFix,
  buildPrintSpecText,
  estimateExportSize,
  runPreflightChecks,
  type ExportOptions,
  type PreflightCheck,
} from '../engines/preflight';
import { detectActiveCrafts, runExportJob, type ExportResult } from '../engines/printExport';
import { getCardDims, useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

export function ExportPage() {
  const navigate = useNavigate();
  const { activeProject, getTemplate, updateActiveProject, lastSavedAt } = useStudioStore();
  const { showToast } = useToastStore();
  const tpl = getTemplate(activeProject.tplId);

  const [exp, setExp] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [previewTab, setPreviewTab] = useState<'front' | 'back' | 'spot'>('front');
  const [ignoreRisk, setIgnoreRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const sandboxRef = useRef<HTMLDivElement | null>(null);

  const checks = useMemo(
    () => runPreflightChecks(activeProject, tpl, exp),
    [activeProject, tpl, exp],
  );
  const hasErrors = checks.some((c) => c.status === 'error');
  const issueCount = checks.filter((c) => c.status !== 'pass').length;
  const fixableChecks = checks.filter((c) => c.status !== 'pass' && c.canAutoFix);
  const activeCrafts = useMemo(() => detectActiveCrafts(activeProject), [activeProject]);
  const dims = getCardDims(activeProject);
  const estSize = useMemo(() => estimateExportSize(activeProject, exp), [activeProject, exp]);

  const handleFixOne = (id: PreflightCheck['id']) => {
    const res = applyPreflightFix(activeProject, exp, id);
    if (res.changed) {
      updateActiveProject(() => res.project);
      setExp(res.exp);
      showToast('已自动完成该项印前修复 ✦', 'success');
    }
  };

  const handleFixAll = () => {
    let curProj = activeProject;
    let curExp = exp;
    let count = 0;
    for (const c of fixableChecks) {
      const res = applyPreflightFix(curProj, curExp, c.id);
      if (res.changed) {
        curProj = res.project;
        curExp = res.exp;
        count += 1;
      }
    }
    if (count > 0) {
      updateActiveProject(() => curProj);
      setExp(curExp);
      showToast(`已一键自动修复 ${count} 项印前建议 ✦`, 'success');
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleGenerate = async () => {
    if (hasErrors && !ignoreRisk) {
      showToast('存在红色阻断项，请修复或勾选忽略风险强行导出', 'error');
      return;
    }
    setBusy(true);
    setProgress(8);
    try {
      const result = await runExportJob(activeProject, tpl, exp, sandboxRef.current, setProgress);
      setLastResult(result);
      triggerDownload(result.blob, result.filename);
      showToast(`已生成并下载 ${result.filename}（${result.sizeText}）✦`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出印刷成品失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleFormatPick = (fmt: ExportOptions['format']) => {
    const forceRgb = fmt === 'png' || fmt === 'jpg';
    setExp({ ...exp, format: fmt, color: forceRgb ? 'rgb' : exp.color });
  };

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <div className="flex items-center gap-3">
          <Link
            to="/editor"
            className="w-10 h-10 rounded-[0_12px_0_12px] border border-[#E9E9E7] bg-white flex items-center justify-center text-[#333333] hover:border-[#F39800]"
            aria-label="返回编辑器"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="text-sm font-semibold text-[#333333] flex items-center gap-2">
            <Link to="/editor" className="hover:text-[#D95F00]">编辑器</Link>
            <span className="text-[#BFBFBF]">/</span>
            <span>印前检查与导出</span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-[#535353]">
            <span className="text-[#FF7600]">✦</span> {lastSavedAt}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/works" className="ws-nav-btn">我的作品</Link>
          <Link to="/phygital" className="ws-nav-btn">Phygital 双栖</Link>
        </div>
      </header>

      {/* PRD §7.6 1200px 左 7 右 5 双栏 */}
      <section className="w-[min(1200px,calc(100%-48px))] mx-auto my-4 grid lg:grid-cols-12 gap-5 items-start">
        {/* 左栏 7 栏：Preflight 印前质检清单 */}
        <div className="lg:col-span-7 bg-white border border-[#E9E9E7] rounded-[0_32px_0_32px] p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-[#333333]">Preflight 印前质检清单 ✦</h1>
            <div className="flex items-center gap-2">
              {fixableChecks.length > 0 && (
                <button type="button" onClick={handleFixAll} className="btn-cta btn-cta--sm !min-h-[36px] !text-xs">
                  一键修复全部 ({fixableChecks.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => showToast('已完成全套 8 项规则重检 ✦', 'info')}
                className="prd-chip !min-h-[36px] !text-xs"
              >
                重新检查
              </button>
            </div>
          </div>

          <div
            className={`px-4 py-3.5 rounded-[0_16px_0_16px] border text-sm font-bold flex items-center justify-between ${
              issueCount === 0
                ? 'bg-[#008969]/10 text-[#008969] border-[#008969]/25'
                : 'bg-[#F8C112]/15 text-[#333333] border-[#F39800]/40'
            }`}
          >
            <span>
              {issueCount === 0
                ? '全部 8 项印前质检通过，可安心直接输出印厂成品 ✦'
                : `发现 ${issueCount} 项待关注条目，建议一键修复或前往编辑器确认`}
            </span>
          </div>

          <div className="space-y-2.5">
            {checks.map((c) => {
              const dotCls =
                c.status === 'pass'
                  ? 'bg-[#008969]'
                  : c.status === 'warn'
                    ? 'bg-[#F8C112]'
                    : 'bg-[#E30F25]';
              return (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-[#E9E9E7] flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotCls}`} />
                    <div>
                      <div className="text-sm font-bold text-[#333333]">{c.title}</div>
                      <div className="text-xs text-[#535353] mt-0.5">{c.detail}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.canAutoFix && c.status !== 'pass' && (
                      <button
                        type="button"
                        onClick={() => handleFixOne(c.id)}
                        className="text-xs font-bold text-[#D95F00] hover:underline cursor-pointer"
                      >
                        {c.autoFixLabel}
                      </button>
                    )}
                    {c.fixTarget && c.status !== 'pass' && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/editor?focus=${c.fixTarget!.mode}:${c.fixTarget!.target}&side=${c.fixTarget!.side}`)
                        }
                        className="text-xs font-semibold text-[#535353] hover:text-[#D95F00] cursor-pointer"
                      >
                        定位修复 →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右栏 5 栏：导出规格配置与下载回执 */}
        <div className="lg:col-span-5 bg-white border border-[#E9E9E7] rounded-[32px_0_32px_0] p-5 shadow-sm space-y-3.5">
          <h2 className="text-lg font-bold text-[#333333]">导出规格配置</h2>

          {/* 三标签预览框 */}
          <div className="bg-[#F0F0F0] rounded-[0_18px_0_18px] p-3.5 text-center space-y-2.5">
            <div className="inline-flex bg-white border border-[#E9E9E7] rounded-full p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreviewTab('front')}
                className={`px-3 py-1 rounded-full cursor-pointer ${
                  previewTab === 'front' ? 'bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white' : 'text-[#535353]'
                }`}
              >
                正面成品
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('back')}
                className={`px-3 py-1 rounded-full cursor-pointer ${
                  previewTab === 'back' ? 'bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white' : 'text-[#535353]'
                }`}
              >
                背面成品
              </button>
              {exp.spot && (
                <button
                  type="button"
                  onClick={() => setPreviewTab('spot')}
                  className={`px-3 py-1 rounded-full cursor-pointer ${
                    previewTab === 'spot' ? 'bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white' : 'text-[#535353]'
                  }`}
                >
                  专色黑版
                </button>
              )}
            </div>

            <div className="relative inline-block border border-dashed border-[#E30F25] p-1.5">
              <div className={`w-48 ${previewTab === 'spot' ? 'grayscale contrast-200' : ''}`}>
                <CardFaceView
                  project={activeProject}
                  template={tpl}
                  side={previewTab === 'back' ? 'back' : 'front'}
                />
              </div>
            </div>

            <div className="text-xs font-semibold text-[#535353]">
              成品 {dims.w}×{dims.h}mm · 含出血 {dims.w + 2 * exp.bleed}×{dims.h + 2 * exp.bleed}mm
            </div>
          </div>

          {/* 参数芯片组 */}
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-bold text-[#333333] mb-1.5">导出格式</div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['pdf', 'PDF（推荐）'],
                    ['svg', 'SVG'],
                    ['png', 'PNG'],
                    ['jpg', 'JPG'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleFormatPick(id)}
                    className={`prd-chip !min-h-[34px] !px-3.5 !text-xs ${exp.format === id ? 'is-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-bold text-[#333333] mb-1.5">色彩空间</div>
                <div className="flex gap-1.5">
                  {(
                    [
                      ['cmyk', 'CMYK'],
                      ['rgb', 'RGB'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setExp({ ...exp, color: id })}
                      className={`prd-chip !min-h-[34px] !px-3 !text-xs ${exp.color === id ? 'is-active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-[#333333] mb-1.5">分辨率</div>
                <div className="flex gap-1.5">
                  {([300, 600] as const).map((dpi) => (
                    <button
                      key={dpi}
                      type="button"
                      onClick={() => setExp({ ...exp, dpi })}
                      className={`prd-chip !min-h-[34px] !px-3 !text-xs ${exp.dpi === dpi ? 'is-active' : ''}`}
                    >
                      {dpi} DPI
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-[#333333] mb-1.5">出血设置</div>
              <div className="flex gap-2">
                {([3, 2, 0] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setExp({ ...exp, bleed: b })}
                    className={`prd-chip !min-h-[34px] !px-3.5 !text-xs ${exp.bleed === b ? 'is-active' : ''}`}
                  >
                    {b === 3 ? '3mm（推荐）' : `${b}mm`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-bold text-[#333333] mb-1.5">文字处理</div>
              <div className="flex gap-2">
                {(
                  [
                    ['outline', '全部文字转曲'],
                    ['embed', '内嵌字体子集'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setExp({ ...exp, textMode: id })}
                    className={`prd-chip !min-h-[34px] !px-3.5 !text-xs ${exp.textMode === id ? 'is-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1 font-semibold text-[#333333]">
              <label className="flex items-center justify-between cursor-pointer">
                <span>显示裁切线与套准标记</span>
                <input
                  type="checkbox"
                  checked={exp.cropMarks}
                  onChange={(e) => setExp({ ...exp, cropMarks: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>分离导出工艺专色通道（K100）</span>
                <input
                  type="checkbox"
                  checked={exp.spot}
                  onChange={(e) => setExp({ ...exp, spot: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>CMYK 小字单色黑 K100 保护</span>
                <input
                  type="checkbox"
                  checked={exp.autoK100Text}
                  onChange={(e) => setExp({ ...exp, autoK100Text: e.target.checked })}
                />
              </label>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-[#FFF7EC] flex items-center justify-between font-semibold">
              <span>预估输出体积（{activeCrafts.length} 种表面工艺）</span>
              <span className="text-[#D95F00]">{estSize}</span>
            </div>

            {hasErrors && (
              <div className="p-3 rounded-xl bg-[#E30F25]/10 border border-[#E30F25]/30 text-[#E30F25] space-y-1.5">
                <div className="font-bold">存在红色阻断项，请先补全姓名或勾选忽略强行导出</div>
                <label className="inline-flex items-center gap-2 text-[#333333] cursor-pointer">
                  <input type="checkbox" checked={ignoreRisk} onChange={(e) => setIgnoreRisk(e.target.checked)} />
                  <span>忽略风险强行导出</span>
                </label>
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGenerate()}
              className="btn-cta w-full"
            >
              {busy ? `正在渲染印刷文件 (${progress}%)...` : `下载印刷文件 (${exp.format.toUpperCase()})`}
            </button>

            {lastResult && (
              <div className="p-3.5 rounded-[0_16px_0_16px] bg-[#008969]/10 border border-[#008969]/30 space-y-2">
                <div className="font-bold text-[#008969]">
                  已就绪：{lastResult.filename}（{lastResult.sizeText} · {lastResult.pageCount} 页）
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => triggerDownload(lastResult.blob, lastResult.filename)}
                    className="px-3 py-1.5 rounded-lg bg-[#008969] text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载成品
                  </button>
                  {lastResult.spotBlob && (
                    <button
                      type="button"
                      onClick={() => triggerDownload(lastResult.spotBlob!, lastResult.spotFilename)}
                      className="px-3 py-1.5 rounded-lg border border-[#008969] bg-white text-[#008969] font-bold cursor-pointer"
                    >
                      下载 K100 专色版
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const txt = buildPrintSpecText(activeProject, tpl, exp);
                      triggerDownload(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${activeProject.fields.name || 'card'}_印刷规格单.txt`);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#E9E9E7] bg-white text-[#333333] font-semibold cursor-pointer"
                  >
                    规格单 .txt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div ref={sandboxRef} aria-hidden="true" className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none" />
    </div>
  );
}

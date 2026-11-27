import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  Wand2,
  XCircle,
} from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { PAPER_STOCKS } from '../data/templates';
import {
  DEFAULT_EXPORT_OPTIONS,
  applyPreflightFix,
  estimateExportSize,
  runPreflightChecks,
  type ExportOptions,
  type PreflightCheck,
} from '../engines/preflight';
import { detectActiveCrafts, runExportJob, type ExportResult } from '../engines/printExport';
import { getCardDims, useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

export function ExportPage() {
  const { activeProject, getTemplate, updateActiveProject } = useStudioStore();
  const { showToast } = useToastStore();
  const tpl = getTemplate(activeProject.tplId);

  const [exp, setExp] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);
  const sandboxRef = useRef<HTMLDivElement | null>(null);

  const checks = useMemo(
    () => runPreflightChecks(activeProject, tpl, exp),
    [activeProject, tpl, exp],
  );
  const hasErrors = checks.some((c) => c.status === 'error');
  const fixableChecks = checks.filter((c) => c.status !== 'pass' && c.canAutoFix);
  const activeCrafts = useMemo(() => detectActiveCrafts(activeProject), [activeProject]);
  const dims = getCardDims(activeProject);
  const estSize = useMemo(() => estimateExportSize(activeProject, exp), [activeProject, exp]);

  const handleFixOne = (id: PreflightCheck['id']) => {
    const res = applyPreflightFix(activeProject, exp, id);
    if (res.changed) {
      updateActiveProject(() => res.project);
      setExp(res.exp);
      showToast('已自动完成该项印前修复', 'success');
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
      showToast(`已一键自动修复 ${count} 项印前建议`, 'success');
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
    if (hasErrors) {
      showToast('存在未通过的关键错误检查，请先完善主姓名后再导出', 'error');
      return;
    }
    setBusy(true);
    setProgress(5);
    try {
      const result = await runExportJob(activeProject, tpl, exp, sandboxRef.current, setProgress);
      setLastResult(result);
      triggerDownload(result.blob, result.filename);
      showToast(`已生成并下载 ${result.filename}（${result.sizeText}）`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出印刷成品失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Preflight 印前质检 &amp; CMYK 成品输出</h1>
        <p className="text-sm text-slate-500 mt-1">
          纯浏览器端计算分色：支持 DeviceCMYK 印刷 PDF 1.4、双面全分辨率 ZIP 套装与 K100 工艺专色刀版导出
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Export Settings */}
        <section className="lg:col-span-5 bg-white border border-slate-200 leaf-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">输出参数配置</h2>
            <span className="text-xs font-mono text-slate-500">
              {dims.w}×{dims.h}mm · {estSize}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-bold text-slate-600 block mb-1.5">导出文件格式</span>
              <div className="grid grid-cols-4 gap-2 font-bold">
                {(
                  [
                    ['pdf', 'PDF 1.4'],
                    ['png', 'PNG 高清'],
                    ['jpg', 'JPG 图稿'],
                    ['svg', 'SVG 矢量'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setExp({ ...exp, format: id })}
                    className={`py-2 rounded-lg border cursor-pointer ${
                      exp.format === id
                        ? 'border-[#FF7600] bg-orange-50 text-[#FF7600]'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-bold text-slate-600 block mb-1.5">色彩空间</span>
                <div className="grid grid-cols-2 gap-1.5 font-bold">
                  {(
                    [
                      ['cmyk', 'CMYK 印刷'],
                      ['rgb', 'RGB 屏幕'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setExp({ ...exp, color: id })}
                      className={`py-2 rounded-lg border cursor-pointer ${
                        exp.color === id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-600 block mb-1.5">光栅分辨率</span>
                <div className="grid grid-cols-2 gap-1.5 font-bold">
                  {([300, 600] as const).map((dpi) => (
                    <button
                      key={dpi}
                      type="button"
                      onClick={() => setExp({ ...exp, dpi })}
                      className={`py-2 rounded-lg border cursor-pointer ${
                        exp.dpi === dpi
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {dpi} DPI
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100 font-semibold text-slate-700">
              <label className="flex items-center justify-between cursor-pointer">
                <span>含 3mm 出血边界与四角裁切线</span>
                <input
                  type="checkbox"
                  checked={exp.bleed === 3 && exp.cropMarks}
                  onChange={(e) =>
                    setExp({
                      ...exp,
                      bleed: e.target.checked ? 3 : 0,
                      cropMarks: e.target.checked,
                    })
                  }
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>正反双面联合输出</span>
                <input
                  type="checkbox"
                  checked={exp.doubleSided}
                  onChange={(e) => setExp({ ...exp, doubleSided: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>附加 K100 工艺专色通道版</span>
                <input
                  type="checkbox"
                  checked={exp.spot}
                  onChange={(e) => setExp({ ...exp, spot: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>CMYK 深色文字单色黑 K100 保护</span>
                <input
                  type="checkbox"
                  checked={exp.autoK100Text}
                  onChange={(e) => setExp({ ...exp, autoK100Text: e.target.checked })}
                />
              </label>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800">当前工程表面工艺汇总</div>
              <div className="text-slate-500">纸基：{PAPER_STOCKS[activeProject.paper].name}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeCrafts.length ? (
                  activeCrafts.map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF7600] text-[11px] font-bold"
                    >
                      {c.label}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">未指定特殊表面工艺（常规四色印刷）</span>
                )}
              </div>
            </div>

            {busy && (
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#FF7600] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <button
              type="button"
              disabled={busy || hasErrors}
              onClick={() => void handleGenerate()}
              className="w-full py-3 rounded-xl btn-brand text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {busy ? `正在渲染输出 (${progress}%)...` : `生成并下载 ${exp.format.toUpperCase()} 印刷文件`}
            </button>

            {lastResult && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="font-bold text-emerald-900">
                  已就绪：{lastResult.filename} ({lastResult.sizeText} · {lastResult.pageCount} 页)
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => triggerDownload(lastResult.blob, lastResult.filename)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    再次下载成品
                  </button>
                  {lastResult.spotBlob && (
                    <button
                      type="button"
                      onClick={() => triggerDownload(lastResult.spotBlob!, lastResult.spotFilename)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-400 bg-white text-emerald-900 font-bold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      单独下载专色刀版 SVG
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Preflight + Preview */}
        <section className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-slate-200 leaf-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-900">8 项 Preflight 印前自动体检</h2>
                <p className="text-xs text-slate-500">
                  自动检测裁切安全区、可辨字号、线条阈值与 CMYK 单色黑保护
                </p>
              </div>
              {fixableChecks.length > 0 && (
                <button
                  type="button"
                  onClick={handleFixAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  一键修复全部 ({fixableChecks.length})
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {checks.map((c) => {
                const Icon =
                  c.status === 'pass'
                    ? CheckCircle2
                    : c.status === 'warn'
                      ? AlertTriangle
                      : XCircle;
                const color =
                  c.status === 'pass'
                    ? 'text-emerald-600'
                    : c.status === 'warn'
                      ? 'text-amber-500'
                      : 'text-rose-600';

                return (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                      <div>
                        <div className="font-bold text-slate-900">{c.title}</div>
                        <div className="text-slate-500">{c.detail}</div>
                      </div>
                    </div>
                    {c.canAutoFix && c.status !== 'pass' && (
                      <button
                        type="button"
                        onClick={() => handleFixOne(c.id)}
                        className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-bold shrink-0 cursor-pointer"
                      >
                        {c.autoFixLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 leaf-card p-6 space-y-3">
            <h2 className="font-bold text-slate-900 text-sm">待导出正反面校对</h2>
            <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <CardFaceView project={activeProject} template={tpl} side="front" showGuides={exp.cropMarks} />
              {exp.doubleSided && (
                <CardFaceView project={activeProject} template={tpl} side="back" showGuides={exp.cropMarks} />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Offscreen Sandbox for Print Measurement */}
      <div
        ref={sandboxRef}
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}

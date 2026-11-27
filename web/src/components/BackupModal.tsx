import { useRef, useState } from 'react';
import {
  Download,
  FileJson,
  HardDriveDownload,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildSingleCardFile,
  buildSingleTemplateFile,
  buildWorkspaceBackup,
  parseImportedJson,
  triggerJsonDownload,
  type ParsedImportPayload,
} from '../storage/backup';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

interface BackupModalProps {
  open: boolean;
  onClose: () => void;
}

export function BackupModal({ open, onClose }: BackupModalProps) {
  const {
    profile,
    favorites,
    works,
    customTemplates,
    activeProject,
    getTemplate,
    importPayload,
    clearLocalWorkspace,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedImportPayload | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const dateTag = new Date().toISOString().slice(0, 10);

  const handleExportWorkspace = () => {
    const backup = buildWorkspaceBackup({
      profile,
      favorites,
      works,
      customTemplates,
      activeProjectId: activeProject.id,
    });
    triggerJsonDownload(`ichibanboshi-backup-${dateTag}.ichiban-backup.json`, backup);
    showToast(`已导出完整工作台备份（含 ${works.length} 份名片、${customTemplates.length} 套模板）`, 'success');
  };

  const handleExportActiveCard = () => {
    const file = buildSingleCardFile(activeProject);
    const safe = (activeProject.fields.name || 'card').replace(/[\\/:*?"<>|]/g, '_');
    triggerJsonDownload(`${safe}.ichiban-card.json`, file);
    showToast(`已导出当前名片工程「${activeProject.title}」`, 'success');
  };

  const handleExportActiveTemplate = () => {
    const tpl = getTemplate(activeProject.tplId);
    const file = buildSingleTemplateFile({
      ...tpl,
      isCustom: true,
      color: activeProject.color,
      accent: activeProject.accent,
      bgDark: activeProject.bgDark,
      paper: activeProject.paper,
      craft: activeProject.craft,
      fieldsPreset: { ...activeProject.fields },
      regionCraftsPreset: { ...activeProject.regionCrafts },
    });
    triggerJsonDownload(`${tpl.name}.ichiban-template.json`, file);
    showToast(`已导出模板文件「${tpl.name}」`, 'success');
  };

  const handleFilePick = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg('');
    try {
      const text = await file.text();
      const result = parseImportedJson(text);
      setParsed(result);
    } catch (err) {
      setParsed(null);
      setErrorMsg(err instanceof Error ? err.message : '导入解析失败');
    }
  };

  const handleConfirmImport = () => {
    if (!parsed) return;
    const { summary } = importPayload(parsed, importMode);
    showToast(summary, 'success');
    setParsed(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl leaf-card border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">本地备份导出 &amp; 工程导入续作</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              纯本地文件迁移：把缓存或修改的名片、自定义模板与资料导出保存，随时导入恢复上次进度
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label="关闭弹窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Export section */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#FF7600]" />
              1. 导出保存到本地电脑
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleExportWorkspace}
                className="text-left p-3.5 rounded-xl border-2 border-[#FF7600]/30 bg-orange-50/50 hover:border-[#FF7600] cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                  <HardDriveDownload className="w-4 h-4 text-[#FF7600]" />
                  导出完整工作台备份
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  打包全部 {works.length} 份名片 + {customTemplates.length} 套模板 + 收藏与资料
                </p>
              </button>

              <button
                type="button"
                onClick={handleExportActiveCard}
                className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-white cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                  <FileJson className="w-4 h-4 text-blue-600" />
                  仅导出当前名片工程
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  生成 `.ichiban-card.json`，便于分享单卡或存档
                </p>
              </button>

              <button
                type="button"
                onClick={handleExportActiveTemplate}
                className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-white cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  仅导出当前配置模板
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  生成 `.ichiban-template.json` 复用当前版式与材质预设
                </p>
              </button>
            </div>
          </section>

          {/* Import section */}
          <section className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#FF7600]" />
              2. 导入上次保存的文件继续制作
            </h3>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFilePick(e.dataTransfer.files?.[0]);
              }}
              className="border-2 border-dashed border-slate-300 hover:border-[#FF7600] rounded-xl p-5 text-center bg-slate-50/70"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFilePick(e.target.files?.[0])}
                className="hidden"
              />
              <p className="text-sm font-semibold text-slate-800">
                拖拽 `.ichiban-backup.json` / `.ichiban-card.json` / `.ichiban-template.json` 到此处
              </p>
              <p className="text-xs text-slate-500 mt-1">或点击下方按钮从本地磁盘选择已保存的工程文件</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:border-[#FF7600] text-xs font-bold text-slate-800 cursor-pointer"
              >
                选择本地 JSON 文件
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            {parsed && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="text-xs font-bold text-emerald-900">
                  {parsed.kind === 'workspace' &&
                    `识别为工作台全量备份：含 ${parsed.backup.works.length} 份名片、${parsed.backup.customTemplates.length} 套自定义模板（导出时间：${parsed.backup.exportedAt.slice(0, 10)}）`}
                  {parsed.kind === 'card' &&
                    `识别为单张名片工程：「${parsed.card.title}」（姓名：${parsed.card.fields.name}）`}
                  {parsed.kind === 'template' &&
                    `识别为可复用模板：「${parsed.template.name}」`}
                </div>

                {parsed.kind === 'workspace' && (
                  <div className="flex flex-wrap gap-4 text-xs text-emerald-950">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                      />
                      <span>增量合并（保留现有本地数据并合并新增项目）</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                      />
                      <span>完整覆盖恢复（完全还原至该备份快照）</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setParsed(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-4 py-1.5 rounded-lg btn-brand text-xs font-bold cursor-pointer"
                  >
                    确认导入并打开
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Danger Zone */}
          <section className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              清空当前浏览器本地缓存后将重置为 1 份默认初始名片。
            </div>
            <button
              type="button"
              onClick={async () => {
                await clearLocalWorkspace();
                showToast('已重置本地工作台缓存', 'info');
                onClose();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空本地缓存
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

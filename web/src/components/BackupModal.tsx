import { useRef, useState } from 'react';
import { Download, FileJson, HardDriveDownload, Trash2, Upload } from 'lucide-react';
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
    showToast(`已导出完整工作台备份（含 ${works.length} 份名片、${customTemplates.length} 套模板）✦`, 'success');
  };

  const handleExportActiveCard = () => {
    const file = buildSingleCardFile(activeProject);
    const safe = (activeProject.fields.name || 'card').replace(/[\\/:*?"<>|]/g, '_');
    triggerJsonDownload(`${safe}.ichiban-card.json`, file);
    showToast(`已导出当前名片工程「${activeProject.title}」✦`, 'success');
  };

  const handleExportActiveTemplate = () => {
    const tpl = getTemplate(activeProject.tplId);
    const file = buildSingleTemplateFile({
      ...tpl,
      isCustom: true,
      color: activeProject.color,
      accent: activeProject.accent,
      bgDark: activeProject.bgDark,
      paper: activeProject.frontPaper || activeProject.paper,
      craft: activeProject.craft,
      fieldsPreset: { ...activeProject.fields },
      regionCraftsPreset: { ...activeProject.regionCrafts },
    });
    triggerJsonDownload(`${tpl.name}.ichiban-template.json`, file);
    showToast(`已导出模板文件「${tpl.name}」✦`, 'success');
  };

  const handleFilePick = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg('');
    try {
      const text = await file.text();
      setParsed(parseImportedJson(text));
    } catch (err) {
      setParsed(null);
      setErrorMsg(err instanceof Error ? err.message : '导入解析失败');
    }
  };

  const handleConfirmImport = () => {
    if (!parsed) return;
    const { summary } = importPayload(parsed, importMode);
    showToast(`${summary} ✦`, 'success');
    setParsed(null);
    onClose();
  };

  return (
    <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-labelledby="backupModalTitle">
      <div className="auth-modal__dialog !w-[min(680px,100%)] max-h-[88vh] overflow-y-auto">
        <div className="auth-modal__head">
          <div>
            <div className="auth-modal__eyebrow">✦ LOCAL WORKSPACE CONTINUITY</div>
            <h2 id="backupModalTitle" className="auth-modal__title">本地工程备份导出 &amp; 导入续作</h2>
            <p className="text-xs text-[#535353] mt-1">
              纯本地文件持久化：将新建/修改的名片、自定义模板导出保存，下次通过导入无缝接续制作
            </p>
          </div>
          <button type="button" onClick={onClose} className="auth-modal__close cursor-pointer" aria-label="关闭窗口">
            ×
          </button>
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-[#333333] flex items-center gap-2">
              <Download className="w-4 h-4 text-[#FF7600]" />
              1. 导出保存到本地磁盘
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleExportWorkspace}
                className="text-left p-3.5 rounded-[0_18px_0_18px] border-2 border-[#FF7600]/40 bg-[#FFF7EC] hover:border-[#FF7600] cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#333333]">
                  <HardDriveDownload className="w-4 h-4 text-[#FF7600]" />
                  导出完整备份
                </div>
                <p className="text-xs text-[#535353] mt-1">
                  {works.length} 份名片 + {customTemplates.length} 套模板 + 收藏与资料
                </p>
              </button>

              <button
                type="button"
                onClick={handleExportActiveCard}
                className="text-left p-3.5 rounded-[0_18px_0_18px] border border-[#E9E9E7] hover:border-[#F39800] bg-white cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#333333]">
                  <FileJson className="w-4 h-4 text-[#0C7BBB]" />
                  仅导出当前名片
                </div>
                <p className="text-xs text-[#535353] mt-1">
                  生成 `.ichiban-card.json` 单卡工程文件
                </p>
              </button>

              <button
                type="button"
                onClick={handleExportActiveTemplate}
                className="text-left p-3.5 rounded-[0_18px_0_18px] border border-[#E9E9E7] hover:border-[#F39800] bg-white cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#333333]">
                  <FileJson className="w-4 h-4 text-[#008969]" />
                  仅导出当前模板
                </div>
                <p className="text-xs text-[#535353] mt-1">
                  生成 `.ichiban-template.json` 复用当前版式材质
                </p>
              </button>
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-[#E9E9E7]">
            <h3 className="text-sm font-bold text-[#333333] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#FF7600]" />
              2. 导入上次保存的文件继续制作
            </h3>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFilePick(e.dataTransfer.files?.[0]);
              }}
              className="border-2 border-dashed border-[#F39800]/50 hover:border-[#FF7600] rounded-[0_20px_0_20px] p-5 text-center bg-[#FFF7EC]/60"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFilePick(e.target.files?.[0])}
                className="hidden"
              />
              <p className="text-sm font-semibold text-[#333333]">
                拖拽 `.ichiban-backup.json` / `.ichiban-card.json` / `.ichiban-template.json` 到此处
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 btn-outline btn-outline--sm bg-white"
              >
                选择本地 JSON 文件
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#E30F25]/10 border border-[#E30F25]/30 text-xs text-[#E30F25] font-medium">
                {errorMsg}
              </div>
            )}

            {parsed && (
              <div className="p-4 rounded-[0_18px_0_18px] bg-[#008969]/10 border border-[#008969]/30 space-y-3">
                <div className="text-xs font-bold text-[#008969]">
                  {parsed.kind === 'workspace' &&
                    `识别为工作台全量备份：含 ${parsed.backup.works.length} 份名片、${parsed.backup.customTemplates.length} 套自定义模板（导出时间：${parsed.backup.exportedAt.slice(0, 10)}）`}
                  {parsed.kind === 'card' &&
                    `识别为单张名片工程：「${parsed.card.title}」（姓名：${parsed.card.fields.name}）`}
                  {parsed.kind === 'template' &&
                    `识别为可复用模板：「${parsed.template.name}」`}
                </div>

                {parsed.kind === 'workspace' && (
                  <div className="flex flex-wrap gap-4 text-xs text-[#333333]">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                      />
                      <span>增量合并（保留现有数据并合并导入项目）</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                      />
                      <span>完整覆盖恢复（完全还原至该快照）</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setParsed(null)}
                    className="prd-chip"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="btn-cta btn-cta--sm"
                  >
                    确认导入并打开
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="pt-4 border-t border-[#E9E9E7] flex items-center justify-between gap-3">
            <span className="text-xs text-[#535353]">清空当前浏览器 IndexedDB 缓存后将重置为默认名片。</span>
            <button
              type="button"
              onClick={async () => {
                await clearLocalWorkspace();
                showToast('已重置本地工作台缓存', 'info');
                onClose();
              }}
              className="auth-logout-btn inline-flex items-center gap-1.5 cursor-pointer"
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

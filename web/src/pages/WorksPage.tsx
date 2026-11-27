import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  Download,
  Edit3,
  FolderSync,
  Printer,
  Trash2,
} from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { PAPER_STOCKS, createProjectFromTemplate } from '../data/templates';
import {
  buildSingleCardFile,
  buildSingleTemplateFile,
  triggerJsonDownload,
} from '../storage/backup';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

interface WorksPageProps {
  onOpenBackup: () => void;
}

export function WorksPage({ onOpenBackup }: WorksPageProps) {
  const navigate = useNavigate();
  const {
    works,
    customTemplates,
    activeProject,
    getTemplate,
    openWork,
    duplicateWork,
    deleteWork,
    selectTemplate,
    deleteCustomTemplate,
  } = useStudioStore();
  const { showToast } = useToastStore();
  const [section, setSection] = useState<'cards' | 'templates'>('cards');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">本地资产与模板管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            所有制作过的名片与自定义修改的模板均自动缓存在本地；也可随时导出文件保存并在下次导入继续编辑
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenBackup}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-brand text-xs sm:text-sm font-bold cursor-pointer shrink-0"
        >
          <FolderSync className="w-4 h-4" />
          导入 / 导出全部工程备份
        </button>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setSection('cards')}
          className={`px-4 py-2 rounded-lg cursor-pointer ${
            section === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          本地名片作品 ({works.length})
        </button>
        <button
          type="button"
          onClick={() => setSection('templates')}
          className={`px-4 py-2 rounded-lg cursor-pointer ${
            section === 'templates' ? 'bg-[#FF7600] text-white' : 'text-slate-600'
          }`}
        >
          自定义 / 修改模板 ({customTemplates.length})
        </button>
      </div>

      {section === 'cards' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {works.map((w) => {
            const tpl = getTemplate(w.tplId);
            const isCurrent = w.id === activeProject.id;
            return (
              <article
                key={w.id}
                className={`bg-white border leaf-card p-5 flex flex-col justify-between gap-4 ${
                  isCurrent ? 'border-[#FF7600] ring-2 ring-orange-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-900 text-sm">{w.title}</h2>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF7600] text-[10px] font-bold">
                          当前正在编辑
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tpl.name} · {PAPER_STOCKS[w.paper].name}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex justify-center">
                  <div className={w.orient === 'v' ? 'w-40' : w.orient === 's' ? 'w-48' : 'w-full'}>
                    <CardFaceView project={w} template={tpl} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <span className="text-[11px] text-slate-400">
                    更新：{w.updatedAt.slice(0, 16).replace('T', ' ')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const safe = (w.fields.name || w.title).replace(/[\\/:*?"<>|]/g, '_');
                        triggerJsonDownload(`${safe}.ichiban-card.json`, buildSingleCardFile(w));
                        showToast(`已导出「${w.title}」单卡工程文件`, 'success');
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-600 cursor-pointer"
                      title="导出单卡工程 JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        duplicateWork(w.id);
                        showToast(`已复制副本「${w.title}」`, 'success');
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-600 cursor-pointer"
                      title="复制"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openWork(w.id);
                        navigate('/export');
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-600 cursor-pointer"
                      title="印刷导出"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteWork(w.id);
                        showToast(`已从本地移除「${w.title}」`, 'info');
                      }}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openWork(w.id);
                        navigate('/editor');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-[#FF7600] text-white font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      编辑
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : customTemplates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800">暂无自定义保存的模板</p>
          <p className="text-xs text-slate-500">
            在「在线设计台」中调整配色、纸张、工艺或文字后，点击顶部「存为新模板」，即可将个人版式持久化保存在本地或导出分享。
          </p>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="px-4 py-2 rounded-lg btn-brand text-xs font-bold cursor-pointer"
          >
            前往设计台保存模板
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {customTemplates.map((tpl) => {
            const previewProject = createProjectFromTemplate(tpl);
            return (
              <article
                key={tpl.id}
                className="bg-white border border-slate-200 leaf-card p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">{tpl.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{tpl.desc}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex justify-center">
                  <div className={tpl.orient === 'v' ? 'w-40' : tpl.orient === 's' ? 'w-48' : 'w-full'}>
                    <CardFaceView project={previewProject} template={tpl} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    修改：{(tpl.updatedAt || tpl.createdAt || '').slice(0, 10)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerJsonDownload(
                          `${tpl.name}.ichiban-template.json`,
                          buildSingleTemplateFile(tpl),
                        );
                        showToast(`已导出模板「${tpl.name}」`, 'success');
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-600 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteCustomTemplate(tpl.id);
                        showToast(`已删除模板「${tpl.name}」`, 'info');
                      }}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectTemplate(tpl.id);
                        navigate('/editor');
                      }}
                      className="px-3 py-1.5 rounded-lg btn-brand font-bold cursor-pointer"
                    >
                      套用新建
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

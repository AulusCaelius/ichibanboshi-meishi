import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, Edit3, FolderSync, Search, Trash2 } from 'lucide-react';
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
  onOpenProfile: () => void;
}

export function WorksPage({ onOpenBackup, onOpenProfile }: WorksPageProps) {
  const navigate = useNavigate();
  const {
    works,
    customTemplates,
    profile,
    activeProject,
    getTemplate,
    openWork,
    renameWork,
    duplicateWork,
    deleteWork,
    selectTemplate,
    deleteCustomTemplate,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const [tab, setTab] = useState<'cards' | 'templates'>('cards');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'hot'>('recent');
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const totalPv = useMemo(() => works.reduce((acc, w) => acc + (w.stats?.pv || 0), 0), [works]);
  const totalSaves = useMemo(() => works.reduce((acc, w) => acc + (w.stats?.saves || 0), 0), [works]);

  const filteredWorks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = works.filter((w) => {
      if (!q) return true;
      return `${w.title} ${w.fields.name} ${w.fields.title} ${w.fields.company}`.toLowerCase().includes(q);
    });
    if (sortBy === 'hot') return [...list].sort((a, b) => (b.stats?.pv || 0) - (a.stats?.pv || 0));
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [works, query, sortBy]);

  return (
    <div>
      {/* 顶部标题带与汇总统计 */}
      <section className="relative pt-28 pb-10 bg-gradient-to-b from-[#FFF7EC] to-white overflow-hidden">
        <div className="bg-text bg-text--stroke absolute right-[4%] top-16 opacity-45" aria-hidden="true">Works</div>
        <div className="prd-container relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <nav className="text-sm text-[#535353] flex items-center gap-2 mb-2">
              <Link to="/" className="hover:text-[#D95F00]">首页</Link>
              <span>/</span>
              <span>我的作品</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#333333]">
              我的作品 <span className="text-[#FF7600]">✦</span>
            </h1>
            <p className="text-sm text-[#535353] mt-1.5">
              本地 IndexedDB 自动持久化保存，随时导出 `.json` 备份并在下次导入继续编辑
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              [works.length, '已存名刺'],
              [customTemplates.length, '本地模板'],
              [totalPv, 'H5 累计 PV'],
              [totalSaves, '通讯录保存'],
            ].map(([num, label]) => (
              <div
                key={String(label)}
                className="bg-white/90 backdrop-blur border border-[#FF7600]/20 rounded-[0_18px_0_18px] px-4 py-3 min-w-[104px] shadow-sm"
              >
                <div className="text-2xl font-extrabold text-[#D95F00]" style={{ fontFamily: 'var(--font-rounded)' }}>
                  {num}
                </div>
                <div className="text-[11px] text-[#535353]">{label}</div>
              </div>
            ))}

            <button
              type="button"
              onClick={onOpenProfile}
              className="text-left bg-white/90 backdrop-blur border border-[#FF7600]/20 hover:border-[#FF7600] rounded-[0_18px_0_18px] px-4 py-3 min-w-[156px] shadow-sm cursor-pointer transition"
            >
              <div className="text-[11px] text-[#535353]">制作人名籍</div>
              <div className="text-sm font-bold text-[#333333] mt-0.5 truncate max-w-[160px]">
                {profile.nickname || '点击配置'} ✦
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 工具条 */}
      <section className="filter-bar-wrap">
        <div className="prd-container flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex bg-[#F0F0F0] rounded-full p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTab('cards')}
                className={`px-4 py-1.5 rounded-full cursor-pointer ${
                  tab === 'cards' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                名刺方案 ({works.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('templates')}
                className={`px-4 py-1.5 rounded-full cursor-pointer ${
                  tab === 'templates' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                修改保存的模板 ({customTemplates.length})
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#535353] absolute left-3 top-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索方案名称 / P 名 / 担当..."
                className="prd-input !min-h-[40px] !pl-9 !py-1.5 !w-60 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex bg-[#F0F0F0] rounded-full p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSortBy('recent')}
                className={`px-3 py-1 rounded-full cursor-pointer ${
                  sortBy === 'recent' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                最近编辑
              </button>
              <button
                type="button"
                onClick={() => setSortBy('hot')}
                className={`px-3 py-1 rounded-full cursor-pointer ${
                  sortBy === 'hot' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                访问热度
              </button>
            </div>

            <div className="inline-flex bg-[#F0F0F0] rounded-full p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPreviewSide('front')}
                className={`px-3 py-1 rounded-full cursor-pointer ${
                  previewSide === 'front' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                正面
              </button>
              <button
                type="button"
                onClick={() => setPreviewSide('back')}
                className={`px-3 py-1 rounded-full cursor-pointer ${
                  previewSide === 'back' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                反面
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenBackup}
              className="btn-outline btn-outline--sm bg-white"
            >
              <FolderSync className="w-4 h-4" />
              导入 / 导出备份
            </button>

            <Link to="/templates" className="btn-cta btn-cta--sm">
              + 从模板新建
            </Link>
          </div>
        </div>
      </section>

      {/* 作品网格 */}
      <section className="py-10 pb-20 bg-[#F0F0F0] min-h-[55vh]">
        <div className="prd-container">
          {tab === 'cards' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorks.map((w) => {
                const tpl = getTemplate(w.tplId);
                const isCurrent = w.id === activeProject.id;
                return (
                  <article
                    key={w.id}
                    className={`bg-white rounded-[0_24px_0_24px] overflow-hidden flex flex-col border transition hover:-translate-y-1 hover:shadow-xl ${
                      isCurrent ? 'border-2 border-[#FF7600]' : 'border-[#E9E9E7]'
                    }`}
                  >
                    <div className="relative h-56 p-5 bg-gradient-to-b from-[#FFF8EE] to-[#EFEFEF] flex items-center justify-center border-b border-[#E9E9E7]">
                      {isCurrent && (
                        <span className="absolute top-3 left-3 z-10 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white text-[11px] font-bold shadow">
                          当前正在编辑
                        </span>
                      )}
                      <div className={w.orient === 'v' ? 'w-28' : w.orient === 's' ? 'w-40' : 'w-64'}>
                        <CardFaceView project={w} template={tpl} side={previewSide} />
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base font-bold text-[#333333] break-words">{w.title}</h2>
                        <span className="text-[11px] text-[#535353] shrink-0">
                          {w.updatedAt.slice(5, 16).replace('T', ' ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                        <span className="px-2 py-0.5 rounded bg-[#F0F0F0] text-[#535353]">{tpl.name}</span>
                        <span className="px-2 py-0.5 rounded bg-[#FFF7EC] text-[#D95F00]">
                          {PAPER_STOCKS[w.frontPaper || w.paper].name}
                        </span>
                      </div>

                      <div className="px-3 py-2 rounded-lg bg-[#F0F0F0] flex items-center justify-between text-xs text-[#535353]">
                        <span>H5 PV：{w.stats?.pv || 0} · 保存：{w.stats?.saves || 0}</span>
                        <button
                          type="button"
                          onClick={() => {
                            openWork(w.id);
                            navigate('/phygital');
                          }}
                          className="text-[#D95F00] font-bold hover:underline cursor-pointer"
                        >
                          双栖联动 ↗
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 mt-auto">
                        <button
                          type="button"
                          onClick={() => {
                            openWork(w.id);
                            navigate('/editor');
                          }}
                          className="btn-cta btn-cta--sm !min-h-[38px] !px-2 !text-xs col-span-2"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          进入编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openWork(w.id);
                            navigate('/export');
                          }}
                          className="btn-outline btn-outline--sm !min-h-[38px] !px-2 !text-xs bg-white"
                        >
                          导出
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#E9E9E7] text-xs font-semibold text-[#535353]">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(w.id);
                            setRenameVal(w.title);
                          }}
                          className="hover:text-[#D95F00] cursor-pointer"
                        >
                          重命名
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            duplicateWork(w.id);
                            showToast(`已复制副本「${w.title}」`, 'success');
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#D95F00] cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerJsonDownload(`${w.title}.ichiban-card.json`, buildSingleCardFile(w));
                            showToast(`已导出「${w.title}」工程文件`, 'success');
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#D95F00] cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          导出文件
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteWork(w.id);
                            showToast(`已删除「${w.title}」`, 'info');
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#E30F25] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : customTemplates.length === 0 ? (
            <div className="bg-white rounded-[0_32px_0_32px] border border-dashed border-[#BFBFBF] p-14 text-center space-y-3">
              <h2 className="text-lg font-bold text-[#333333]">暂无自定义保存的模板</h2>
              <p className="text-sm text-[#535353]">
                在编辑器中修改任意样式、材质与排版后点击「存为新模板」，即可保存在此处或导出 `.ichiban-template.json` 复用。
              </p>
              <button type="button" onClick={() => navigate('/editor')} className="btn-cta btn-cta--sm">
                前往编辑器创建模板
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {customTemplates.map((tpl) => {
                const previewProj = createProjectFromTemplate(tpl);
                return (
                  <article
                    key={tpl.id}
                    className="bg-white rounded-[0_24px_0_24px] overflow-hidden border border-[#E9E9E7] p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <h2 className="font-bold text-[#333333]">{tpl.name}</h2>
                      <p className="text-xs text-[#535353] mt-0.5">{tpl.desc}</p>
                    </div>
                    <div className="stage-backdrop h-48 p-4 rounded-xl">
                      <div className={tpl.orient === 'v' ? 'w-24' : tpl.orient === 's' ? 'w-36' : 'w-full'}>
                        <CardFaceView project={previewProj} template={tpl} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          triggerJsonDownload(`${tpl.name}.ichiban-template.json`, buildSingleTemplateFile(tpl));
                          showToast(`已导出模板「${tpl.name}」`, 'success');
                        }}
                        className="btn-outline btn-outline--sm !min-h-[36px]"
                      >
                        导出模板
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteCustomTemplate(tpl.id);
                          showToast(`已删除模板「${tpl.name}」`, 'info');
                        }}
                        className="text-[#E30F25] font-semibold cursor-pointer"
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          selectTemplate(tpl.id);
                          navigate('/editor');
                        }}
                        className="btn-cta btn-cta--sm !min-h-[36px]"
                      >
                        套用新建
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 重命名模态框 */}
      {renamingId && (
        <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-label="重命名名刺方案">
          <div className="auth-modal__dialog !w-[min(420px,100%)]">
            <div className="auth-modal__head">
              <div>
                <div className="auth-modal__eyebrow">✦ RENAME WORK</div>
                <h2 className="auth-modal__title">重命名名刺方案</h2>
              </div>
              <button type="button" onClick={() => setRenamingId(null)} className="auth-modal__close cursor-pointer">×</button>
            </div>
            <div className="auth-modal__form">
              <div className="auth-field">
                <label htmlFor="renameInput">新方案名称</label>
                <input
                  id="renameInput"
                  type="text"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRenamingId(null)} className="prd-chip">取消</button>
                <button
                  type="button"
                  onClick={() => {
                    renameWork(renamingId, renameVal);
                    setRenamingId(null);
                    showToast('已更新方案名称 ✦', 'success');
                  }}
                  className="btn-cta btn-cta--sm"
                >
                  保存命名
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

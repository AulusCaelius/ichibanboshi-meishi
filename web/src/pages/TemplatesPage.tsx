import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Heart, Plus, Search, Trash2, Upload } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import {
  TEMPLATE_STYLE_LABELS,
  createProjectFromTemplate,
} from '../data/templates';
import {
  buildSingleTemplateFile,
  parseImportedJson,
  triggerJsonDownload,
} from '../storage/backup';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';
import type { TemplateOrient, TemplateStyle } from '../types/card';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    customTemplates,
    favorites,
    getAllTemplates,
    selectTemplate,
    toggleFavorite,
    deleteCustomTemplate,
    importPayload,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const initialStyle = (searchParams.get('style') || 'all') as 'all' | 'custom' | 'fav' | TemplateStyle;
  const [styleFilter, setStyleFilter] = useState<'all' | 'custom' | 'fav' | TemplateStyle>(initialStyle);
  const [orientFilter, setOrientFilter] = useState<'all' | TemplateOrient>('all');
  const [keyword, setKeyword] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const allTemplates = getAllTemplates();

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return allTemplates.filter((t) => {
      if (styleFilter === 'custom' && !t.isCustom) return false;
      if (styleFilter === 'fav' && !favorites.includes(t.id)) return false;
      if (
        styleFilter !== 'all' &&
        styleFilter !== 'custom' &&
        styleFilter !== 'fav' &&
        t.style !== styleFilter
      ) {
        return false;
      }
      if (orientFilter !== 'all' && t.orient !== orientFilter) return false;
      if (q) {
        const hay = `${t.id} ${t.name} ${t.subtitle} ${t.desc} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTemplates, styleFilter, orientFilter, keyword, favorites]);

  const handleStylePick = (val: typeof styleFilter) => {
    setStyleFilter(val);
    if (val === 'all') searchParams.delete('style');
    else searchParams.set('style', val);
    setSearchParams(searchParams, { replace: true });
  };

  const handleImportTpl = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedJson(text);
      const { summary } = importPayload(parsed, 'merge');
      showToast(summary, 'success');
      if (parsed.kind === 'template') navigate('/editor');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入模板失败', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">通用名刺模板库</h1>
          <p className="text-sm text-slate-500 mt-1">
            共 {allTemplates.length} 套模板（含 {customTemplates.length} 套本地新建/修改模板），覆盖六大通用设计风格与三种画幅比例
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImportTpl(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:border-[#FF7600] text-xs font-bold text-slate-800 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#FF7600]" />
            导入 `.ichiban-template.json`
          </button>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-brand text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            返回当前编辑台
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleStylePick('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                styleFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              全部 ({allTemplates.length})
            </button>
            <button
              type="button"
              onClick={() => handleStylePick('custom')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                styleFilter === 'custom' ? 'bg-[#FF7600] text-white' : 'bg-orange-50 text-[#FF7600] hover:bg-orange-100'
              }`}
            >
              我保存的模板 ({customTemplates.length})
            </button>
            <button
              type="button"
              onClick={() => handleStylePick('fav')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                styleFilter === 'fav' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              收藏 ({favorites.length})
            </button>
            {(Object.keys(TEMPLATE_STYLE_LABELS) as TemplateStyle[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStylePick(st)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                  styleFilter === st ? 'bg-[#FF7600] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {TEMPLATE_STYLE_LABELS[st]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs bg-slate-50">
              {(
                [
                  ['all', '全版式'],
                  ['h', '横版'],
                  ['v', '竖版'],
                  ['s', '方卡'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOrientFilter(id)}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    orientFilter === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜风格、材质、关键词..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600] w-44 sm:w-56"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-500">
          未找到符合筛选条件的模板，请切换风格标签或清除搜索关键词。
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((tpl) => {
            const isFav = favorites.includes(tpl.id);
            const previewProject = createProjectFromTemplate(tpl);
            return (
              <article
                key={tpl.id}
                className="bg-white border border-slate-200 leaf-card p-5 flex flex-col justify-between gap-4 hover:border-[#FF7600] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-900 text-sm">{tpl.name}</h2>
                      {tpl.isCustom && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-100 text-[#FF7600] text-[10px] font-bold">
                          本地模板
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tpl.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(tpl.id)}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      isFav ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-400 hover:text-rose-500'
                    }`}
                    aria-label="收藏模板"
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className={tpl.orient === 'v' ? 'w-40' : tpl.orient === 's' ? 'w-48' : 'w-full'}>
                    <CardFaceView project={previewProject} template={tpl} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {tpl.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerJsonDownload(`${tpl.name}.ichiban-template.json`, buildSingleTemplateFile(tpl));
                        showToast(`已导出模板「${tpl.name}」`, 'success');
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-600 cursor-pointer"
                      title="导出该模板 JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {tpl.isCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          deleteCustomTemplate(tpl.id);
                          showToast(`已删除自定义模板「${tpl.name}」`, 'info');
                        }}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="删除自定义模板"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        selectTemplate(tpl.id);
                        showToast(`已载入模板「${tpl.name}」`, 'success');
                        navigate('/editor');
                      }}
                      className="px-3.5 py-1.5 rounded-lg btn-brand text-xs font-bold cursor-pointer"
                    >
                      立即使用
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

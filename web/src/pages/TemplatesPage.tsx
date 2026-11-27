import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Heart, Search, Trash2, Upload, ZoomIn } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import {
  COMPANY_PRESETS,
  IDOL_PRESETS,
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
import type { CardTemplate, TemplateOrient, TemplateStyle } from '../types/card';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full || '000000', 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}

function matchesIdolColorFamily(color: string, _accent: string, targetHex: string): boolean {
  if (color.toLowerCase() === targetHex.toLowerCase()) return true;
  const a = hexToHsl(color);
  const b = hexToHsl(targetHex);
  if (b.l > 0.88 || b.s < 0.22) {
    return a.s < 0.32 || a.l > 0.78 || (Math.abs(a.h - 200) <= 25 && a.l > 0.55);
  }
  if (a.s < 0.22) return false;
  if (b.h >= 70 && b.h <= 160) return a.h >= 70 && a.h <= 170;
  const diff = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  const tol = b.h >= 270 && b.h <= 320 ? 40 : 28;
  return diff <= tol;
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    customTemplates,
    favorites,
    prefill,
    setPrefill,
    getAllTemplates,
    selectTemplate,
    toggleFavorite,
    deleteCustomTemplate,
    importPayload,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const stateParam = searchParams.get('state');
  const [styleFilter, setStyleFilter] = useState<'all' | 'custom' | 'fav' | TemplateStyle>(
    (searchParams.get('style') as 'all' | 'custom' | 'fav' | TemplateStyle) || 'all',
  );
  const [layoutFilter, setLayoutFilter] = useState<'all' | TemplateOrient | '1' | '2'>('all');
  const [craftFilter, setCraftFilter] = useState<'all' | 'foil' | 'uv' | 'relief' | 'none'>('all');
  const [colorFilter, setColorFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest'>('popular');
  const [keyword, setKeyword] = useState('');
  const [pageLimit, setPageLimit] = useState(16);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [zoomTpl, setZoomTpl] = useState<CardTemplate | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Sync URL showcase states from PRD §7.3 (?state=active|long|empty|loading)
  useEffect(() => {
    if (stateParam === 'active') {
      setPrefill({
        name: '制作人Producer',
        title: '花海咲季担当',
        company: '初星学園',
        accentColor: '#E30F25',
        enabled: true,
      });
    } else if (stateParam === 'long') {
      setPrefill({
        name: '制作人Producer（初星学園プロデューサー科 首席）',
        title: '花海咲季・花海佑芽 姉妹担当',
        company: '765プロダクション × 初星学園 合同プロデュース部',
        accentColor: '#FF7600',
        enabled: true,
      });
    } else if (stateParam === 'empty') {
      setStyleFilter('minimal');
      setLayoutFilter('s');
      setCraftFilter('foil');
    }
  }, [stateParam, setPrefill]);

  const allTemplates = getAllTemplates();

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = allTemplates.filter((t) => {
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
      if (layoutFilter === '1' && t.sides !== 1) return false;
      if (layoutFilter === '2' && (t.sides || 2) !== 2) return false;
      if ((layoutFilter === 'h' || layoutFilter === 'v' || layoutFilter === 's') && t.orient !== layoutFilter) {
        return false;
      }
      if (craftFilter === 'foil' && !['gold', 'silver', 'copper'].includes(t.craft)) return false;
      if (craftFilter === 'uv' && t.craft !== 'uv') return false;
      if (craftFilter === 'relief' && !['emboss', 'deboss'].includes(t.craft)) return false;
      if (craftFilter === 'none' && t.craft !== 'none') return false;
      if (colorFilter && !matchesIdolColorFamily(t.color, t.accent, colorFilter)) return false;
      if (q) {
        const hay = `${t.id} ${t.name} ${t.subtitle} ${t.desc} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sortBy === 'newest') return [...list].reverse();
    return list;
  }, [allTemplates, styleFilter, layoutFilter, craftFilter, colorFilter, keyword, favorites, sortBy]);

  const visibleTemplates = filtered.slice(0, pageLimit);

  const handleTogglePreview = () => {
    const next = !prefill.enabled;
    setPrefill({ enabled: next });
    if (next) {
      showToast(`已为 ${allTemplates.length} 套模板应用你的信息 ✦`, 'success');
    }
  };

  const handleResetFilters = () => {
    setStyleFilter('all');
    setLayoutFilter('all');
    setCraftFilter('all');
    setColorFilter('');
    setKeyword('');
    searchParams.delete('state');
    searchParams.delete('style');
    setSearchParams(searchParams, { replace: true });
  };

  const handleImportTpl = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseImportedJson(await file.text());
      const { summary } = importPayload(parsed, 'merge');
      showToast(`${summary} ✦`, 'success');
      if (parsed.kind === 'template') navigate('/editor');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入模板失败', 'error');
    }
  };

  const buildPreviewProject = (tpl: CardTemplate) => {
    const activePrefill =
      prefill.enabled && (prefill.name.trim() || prefill.title.trim() || prefill.company.trim());
    return createProjectFromTemplate(
      tpl,
      activePrefill
        ? {
            name: prefill.name.trim() || '制作人Producer',
            title: prefill.title.trim() || '〇〇担当',
            company: prefill.company.trim() || '初星学園',
          }
        : undefined,
      activePrefill && prefill.accentColor ? prefill.accentColor : undefined,
    );
  };

  return (
    <div>
      {/* 1. 标题带 */}
      <section className="tpl-hero">
        <div className="bg-text bg-text--stroke absolute right-10 -bottom-4" aria-hidden="true">Templates</div>
        <div className="prd-container relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <nav className="text-sm text-[#535353] flex items-center gap-2 mb-2" aria-label="面包屑">
              <Link to="/" className="hover:text-[#D95F00]">首页</Link>
              <span>/</span>
              <span>模板库</span>
            </nav>
            <h1 className="section-heading !text-[38px]">
              模板库 <span className="section-heading__star">✦</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
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
              className="btn-outline btn-outline--sm bg-white"
            >
              <Upload className="w-4 h-4" />
              导入模板 JSON
            </button>
            <div
              className="px-5 py-2.5 rounded-[0_18px_0_18px] bg-[#FFF7EC] border border-[#F39800]/35 text-[#D95F00] font-bold text-sm"
              style={{ fontFamily: 'var(--font-rounded)' }}
            >
              共 {allTemplates.length} 套模板
            </div>
          </div>
        </div>
      </section>

      {/* 2. 信息预填实时渲染面板 */}
      <section className="pb-6" aria-label="信息预填实时渲染">
        <div className="prd-container">
          <div className="prefill-panel">
            <div className="grid lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-[#333333] block mb-1.5" htmlFor="prefillName">
                  制作人名称
                </label>
                <input
                  id="prefillName"
                  className="prd-input"
                  type="text"
                  placeholder="制作人Producer"
                  value={prefill.name}
                  onChange={(e) => setPrefill({ name: e.target.value, enabled: true })}
                />
              </div>

              <div className="lg:col-span-3 relative">
                <label className="text-xs font-bold text-[#333333] block mb-1.5" htmlFor="prefillTitle">
                  职位 / 担当偶像（支持快捷选择或自由输入）
                </label>
                <input
                  id="prefillTitle"
                  className="prd-input"
                  type="text"
                  placeholder="〇〇担当（如：花海咲季担当）"
                  value={prefill.title}
                  onFocus={() => setComboboxOpen(true)}
                  onBlur={() => window.setTimeout(() => setComboboxOpen(false), 180)}
                  onChange={(e) => setPrefill({ title: e.target.value, enabled: true })}
                />
                {comboboxOpen && (
                  <div className="combobox-menu is-open">
                    {IDOL_PRESETS.map((idol) => (
                      <button
                        key={idol.id}
                        type="button"
                        onMouseDown={() => {
                          setPrefill({
                            title: `${idol.name}担当`,
                            accentColor: idol.color,
                            enabled: true,
                          });
                          setComboboxOpen(false);
                          showToast(`已切换「${idol.name}担当」与担当色点缀 ✦`, 'success');
                        }}
                        className="combobox-option cursor-pointer"
                      >
                        <span className="combobox-option__avatar" style={{ backgroundColor: idol.color }}>
                          {idol.short}
                        </span>
                        <span className="font-semibold">{idol.name}担当</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-[#333333] block mb-1.5" htmlFor="prefillCompany">
                  公司 / 事务所 / 工作室
                </label>
                <input
                  id="prefillCompany"
                  className="prd-input"
                  type="text"
                  placeholder="初星学園 / 765プロダクション"
                  value={prefill.company}
                  onChange={(e) => setPrefill({ company: e.target.value, enabled: true })}
                />
              </div>

              <div className="lg:col-span-3 flex items-center justify-between gap-3 h-[44px]">
                <div className="inline-flex items-center gap-2.5">
                  <span className="text-sm font-bold text-[#333333] whitespace-nowrap">预览效果</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefill.enabled}
                    aria-label="预览效果开关"
                    onClick={handleTogglePreview}
                    className="toggle-switch"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPrefill({ name: '', title: '', company: '', accentColor: '#FF7600', enabled: false })}
                  className="text-sm font-semibold text-[#535353] hover:text-[#D95F00] cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#535353]">快捷事务所：</span>
                {COMPANY_PRESETS.map((cp) => (
                  <button
                    key={cp}
                    type="button"
                    onClick={() => setPrefill({ company: cp, enabled: true })}
                    className="px-3 py-1 rounded-full bg-[#F0F0F0] hover:border-[#F39800] border border-[#E9E9E7] text-[#333333] cursor-pointer"
                  >
                    {cp}
                  </button>
                ))}
              </div>
              <span className="text-[#D95F00] font-semibold">输入后，所有 60+ 通用模板将实时显示你的信息 ✦</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 吸顶多维筛选栏 */}
      <section className="filter-bar-wrap" aria-label="模板多维筛选">
        <div className="prd-container space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#535353] mr-1">风格</span>
              <button
                type="button"
                onClick={() => setStyleFilter('all')}
                className={`prd-chip ${styleFilter === 'all' ? 'is-active' : ''}`}
              >
                全部 ({allTemplates.length})
              </button>
              {(Object.keys(TEMPLATE_STYLE_LABELS) as TemplateStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStyleFilter(st)}
                  className={`prd-chip ${styleFilter === st ? 'is-active' : ''}`}
                >
                  {TEMPLATE_STYLE_LABELS[st]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStyleFilter('custom')}
                className={`prd-chip ${styleFilter === 'custom' ? 'is-active' : ''}`}
              >
                本地保存 ({customTemplates.length})
              </button>
              <button
                type="button"
                onClick={() => setStyleFilter('fav')}
                className={`prd-chip ${styleFilter === 'fav' ? 'is-active' : ''}`}
              >
                收藏 ({favorites.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#D95F00]">已匹配 {filtered.length} 套</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'popular' | 'newest')}
                className="prd-input !min-h-[38px] !w-auto !py-1 text-xs font-semibold"
                aria-label="排序方式"
              >
                <option value="popular">热门优先</option>
                <option value="newest">最新发布</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-dashed border-[#E9E9E7]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-[#535353] mr-1">版式</span>
              {(
                [
                  ['all', '全部版式'],
                  ['h', '横版'],
                  ['v', '竖版'],
                  ['s', '方形'],
                  ['1', '单面'],
                  ['2', '双面'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLayoutFilter(id)}
                  className={`prd-chip !min-h-[32px] !px-3 !text-xs ${layoutFilter === id ? 'is-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 13 担当色圆点 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-[#535353] mr-1">色系</span>
              {IDOL_PRESETS.map((idol) => {
                const active = colorFilter.toLowerCase() === idol.color.toLowerCase();
                return (
                  <button
                    key={idol.id}
                    type="button"
                    title={`${idol.name} (${idol.color})`}
                    onClick={() => setColorFilter(active ? '' : idol.color)}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110 ${
                      idol.light ? 'border border-[#BFBFBF]' : ''
                    } ${active ? 'ring-2 ring-offset-2 ring-[#FF7600]' : ''}`}
                    style={{ backgroundColor: idol.color }}
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', '全工艺'],
                  ['foil', '烫金/银/铜'],
                  ['uv', '局部 UV'],
                  ['relief', '凹凸'],
                  ['none', '原纸'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCraftFilter(id)}
                  className={`prd-chip !min-h-[32px] !px-3 !text-xs ${craftFilter === id ? 'is-active' : ''}`}
                >
                  {label}
                </button>
              ))}

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#535353] absolute left-2.5 top-2.5" />
                <input
                  type="search"
                  placeholder="关键词搜索..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="prd-input !min-h-[34px] !pl-8 !py-1 !text-xs !w-36"
                />
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-[#D95F00] hover:underline px-2 cursor-pointer"
              >
                清除筛选
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 模板网格 */}
      <section className="py-10 pb-20">
        <div className="prd-container">
          {stateParam === 'loading' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-[0_24px_0_24px] border border-[#E9E9E7] bg-white overflow-hidden animate-pulse">
                  <div className="h-52 bg-[#F0F0F0]" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-[#F0F0F0] rounded w-3/4" />
                    <div className="h-3 bg-[#F0F0F0] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleTemplates.length === 0 ? (
            <div className="p-16 text-center bg-[#FFF7EC] border border-dashed border-[#F39800]/50 rounded-[0_32px_0_32px] flex flex-col items-center gap-4">
              <svg width="96" height="96" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <circle cx="60" cy="60" r="46" stroke="#F39800" strokeWidth="1.5" strokeDasharray="4 4" />
                <path d="M60 18L65 55L102 60L65 65L60 102L55 65L18 60L55 55Z" stroke="#FF7600" strokeWidth="1.5" fill="rgba(255,118,0,0.08)" />
              </svg>
              <h2 className="text-xl font-bold text-[#333333]">暂无完全匹配当前条件的模板 ✦</h2>
              <p className="text-sm text-[#535353]">可尝试放宽色系、版式或工艺条件。</p>
              <button type="button" onClick={handleResetFilters} className="btn-outline btn-outline--sm">
                清除所有筛选
              </button>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {visibleTemplates.map((tpl) => {
                  const previewProj = buildPreviewProject(tpl);
                  const isFav = favorites.includes(tpl.id);
                  return (
                    <article
                      key={tpl.id}
                      className="tpl-card group relative bg-white border border-[#E9E9E7] rounded-[0_24px_0_24px] overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl transition"
                    >
                      <div className="stage-backdrop relative h-[220px] p-5">
                        <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
                          {tpl.badge === 'NEW' && (
                            <span className="px-2 py-0.5 rounded-full bg-[#E30F25] text-white text-[11px] font-bold">NEW</span>
                          )}
                          {tpl.badge === 'HOT' && (
                            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white text-[11px] font-bold">HOT</span>
                          )}
                          {tpl.badge === '烫金' && (
                            <span className="px-2 py-0.5 rounded-full bg-[#FFF3AE] text-[#D95F00] text-[11px] font-bold">烫金</span>
                          )}
                          {tpl.isCustom && (
                            <span className="px-2 py-0.5 rounded-full bg-[#333333] text-white text-[11px] font-bold">本地</span>
                          )}
                        </div>

                        <div className={tpl.orient === 'v' ? 'w-[106px]' : tpl.orient === 's' ? 'w-[160px]' : 'w-full'}>
                          <CardFaceView project={previewProj} template={tpl} flipOnHover />
                        </div>

                        {/* 悬停玻璃操作遮罩 */}
                        <div className="absolute inset-0 bg-white/85 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2.5 z-20">
                          <button
                            type="button"
                            onClick={() => {
                              selectTemplate(tpl.id);
                              showToast(`已套用模板「${tpl.name}」✦`, 'success');
                              navigate('/editor');
                            }}
                            className="btn-cta btn-cta--sm !text-xs"
                          >
                            使用此模板
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomTpl(tpl)}
                            className="w-10 h-10 rounded-full bg-white border border-[#F39800] text-[#D95F00] flex items-center justify-center hover:bg-[#FFF7EC] cursor-pointer"
                            aria-label="放大预览"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-[15px] font-bold text-[#333333] truncate">{tpl.name}</h2>
                          <p className="text-xs text-[#535353] truncate mt-0.5">{tpl.subtitle}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#535353] text-[11px] font-semibold">
                            {TEMPLATE_STYLE_LABELS[tpl.style]}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFavorite(tpl.id)}
                              className={`p-1 rounded cursor-pointer ${isFav ? 'text-[#E30F25]' : 'text-[#BFBFBF] hover:text-[#E30F25]'}`}
                              aria-label="收藏模板"
                            >
                              <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                            </button>
                            {tpl.isCustom && (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteCustomTemplate(tpl.id);
                                  showToast(`已删除本地模板「${tpl.name}」`, 'info');
                                }}
                                className="p-1 rounded text-[#E30F25] cursor-pointer"
                                aria-label="删除自定义模板"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {visibleTemplates.length < filtered.length && (
                <div className="mt-12 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setPageLimit((n) => n + 16)}
                    className="btn-more"
                  >
                    <span className="btn-more__inner">
                      加载更多 MORE（剩余 {filtered.length - visibleTemplates.length}）
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 放大预览弹窗 */}
      {zoomTpl && (
        <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-label="模板双面放大预览">
          <div className="auth-modal__dialog !w-[min(880px,100%)] max-h-[90vh] overflow-y-auto">
            <div className="auth-modal__head">
              <div>
                <div className="auth-modal__eyebrow">✦ {TEMPLATE_STYLE_LABELS[zoomTpl.style]} · {zoomTpl.id}</div>
                <h2 className="auth-modal__title">{zoomTpl.name}（{zoomTpl.subtitle}）</h2>
              </div>
              <button type="button" onClick={() => setZoomTpl(null)} className="auth-modal__close cursor-pointer">×</button>
            </div>

            <div className="stage-backdrop rounded-[0_20px_0_20px] p-6 flex flex-wrap items-center justify-center gap-8">
              <div className={zoomTpl.orient === 'v' ? 'w-44' : zoomTpl.orient === 's' ? 'w-56' : 'w-80'}>
                <div className="text-center text-xs font-bold text-[#535353] mb-2">正面预览</div>
                <CardFaceView project={buildPreviewProject(zoomTpl)} template={zoomTpl} side="front" />
              </div>
              {(zoomTpl.sides || 2) === 2 && (
                <div className={zoomTpl.orient === 'v' ? 'w-44' : zoomTpl.orient === 's' ? 'w-56' : 'w-80'}>
                  <div className="text-center text-xs font-bold text-[#535353] mb-2">背面预览</div>
                  <CardFaceView project={buildPreviewProject(zoomTpl)} template={zoomTpl} side="back" />
                </div>
              )}
            </div>

            <p className="text-sm text-[#535353] mt-4">{zoomTpl.desc}</p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerJsonDownload(`${zoomTpl.name}.ichiban-template.json`, buildSingleTemplateFile(zoomTpl));
                  showToast(`已导出模板「${zoomTpl.name}」`, 'success');
                }}
                className="btn-outline btn-outline--sm"
              >
                <Download className="w-4 h-4" />
                导出模板 JSON
              </button>

              <button
                type="button"
                onClick={() => {
                  const id = zoomTpl.id;
                  setZoomTpl(null);
                  selectTemplate(id);
                  navigate('/editor');
                }}
                className="btn-cta btn-cta--sm"
              >
                立即使用此模板 ✦
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

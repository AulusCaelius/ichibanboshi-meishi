import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowLeft,
  BookmarkPlus,
  CopyPlus,
  Download,
  Eye,
  EyeOff,
  FolderSync,
  ImagePlus,
  Layers,
  Lock,
  Maximize2,
  QrCode,
  Redo2,
  RefreshCw,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
} from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { CardPreview3D } from '../components/CardPreview3D';
import {
  CARD_SPECS,
  COMPANY_PRESETS,
  EDITABLE_REGIONS,
  IDOL_PRESETS,
  PAPER_STOCKS,
  SURFACE_CRAFTS,
  THEME_COLORS,
} from '../data/templates';
import { getEffectiveSidePaper } from '../engines/renderCardHtml';
import { buildSingleCardFile, parseImportedJson, triggerJsonDownload } from '../storage/backup';
import { getCardDims, useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';
import type {
  CanvasElement,
  EditableRegionId,
  PaperStockId,
  SpecId,
  SurfaceCraftId,
} from '../types/card';

interface EditorPageProps {
  onOpenBackup: () => void;
}

const STOCK_SWATCH_COLORS: Record<PaperStockId, string> = {
  matte: '#FFFFFF',
  cotton: '#FAF6EE',
  pearl: '#E2E8F0',
  black: '#1A1C23',
  washi: '#F5EFE1',
  pvc: '#DBEAFE',
};

export function EditorPage({ onOpenBackup }: EditorPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    activeProject,
    getAllTemplates,
    getTemplate,
    selectTemplate,
    updateActiveProject,
    undo,
    redo,
    undoStack,
    redoStack,
    lastSavedAt,
    saveActiveWorkCopy,
    saveCurrentAsNewTemplate,
    updateCurrentCustomTemplate,
    importPayload,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const tpl = getTemplate(activeProject.tplId);
  const dims = getCardDims(activeProject);
  const [mode, setMode] = useState<'form' | 'canvas'>('form');
  const [canvasTab, setCanvasTab] = useState<'templates' | 'text' | 'icons' | 'images' | 'shapes'>('templates');
  const [selectedRegion, setSelectedRegion] = useState<EditableRegionId>('name');
  const [selectedElId, setSelectedElId] = useState<string>('');
  const [showBleed, setShowBleed] = useState(true);
  const [showTrim, setShowTrim] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [idolDropdownOpen, setIdolDropdownOpen] = useState(false);
  const [show3DModal, setShow3DModal] = useState(false);
  const [showSaveTplModal, setShowSaveTplModal] = useState(false);
  const [newTplName, setNewTplName] = useState(`${tpl.name} · 改版`);
  const [newTplDesc, setNewTplDesc] = useState('');

  const artInputRef = useRef<HTMLInputElement | null>(null);
  const cardImportRef = useRef<HTMLInputElement | null>(null);
  const canvasImgInputRef = useRef<HTMLInputElement | null>(null);

  // Support deep linking ?focus=field:name | el:id
  useEffect(() => {
    const focus = searchParams.get('focus');
    const sideParam = searchParams.get('side');
    if (sideParam === 'front' || sideParam === 'back') {
      updateActiveProject((p) => ({ ...p, side: sideParam }), false);
    }
    if (!focus) return;
    if (focus.startsWith('el:')) {
      setMode('canvas');
      setSelectedElId(focus.slice(3));
    } else if (focus.startsWith('field:')) {
      setMode('form');
      setSelectedRegion((focus.slice(6) as EditableRegionId) || 'name');
    }
  }, [searchParams, updateActiveProject]);

  // Keyboard shortcuts Cmd/Ctrl+Z & arrows
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inInput) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === 'Escape') {
        setShow3DModal(false);
        setShowSaveTplModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const setField = (key: keyof typeof activeProject.fields, val: string) => {
    updateActiveProject((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: val },
    }));
  };

  const setRegionCraft = (region: EditableRegionId, craft: SurfaceCraftId) => {
    updateActiveProject((prev) => ({
      ...prev,
      craft: region === 'name' ? craft : prev.craft,
      regionCrafts: { ...prev.regionCrafts, [region]: craft },
    }));
  };

  const setSideStock = (side: 'front' | 'back', stock: PaperStockId) => {
    updateActiveProject((prev) => ({
      ...prev,
      paper: side === 'front' ? stock : prev.paper,
      frontPaper: side === 'front' ? stock : prev.frontPaper || prev.paper,
      backPaper: side === 'back' ? stock : prev.backPaper || prev.paper,
    }));
  };

  const handleUploadArtwork = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      showToast('图片文件过大（建议 ≤ 6MB）', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateActiveProject((prev) => ({
        ...prev,
        standee: { ...prev.standee, enabled: true, dataUrl: String(reader.result || '') },
      }));
      showToast('已载入自定义插画立绘，3D 与印刷画布实时同步 ✦', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCanvasImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `el_${Date.now().toString(36)}`;
      const nextEl: CanvasElement = {
        id,
        side: activeProject.side,
        type: 'image',
        label: file.name.slice(0, 14),
        src: String(reader.result || ''),
        x: 62,
        y: 16,
        w: 28,
        h: 50,
        radius: 6,
        craft: 'none',
      };
      updateActiveProject((prev) => ({
        ...prev,
        customElements: [...prev.customElements, nextEl],
      }));
      setSelectedElId(id);
      showToast('已添加画布图片图层', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleImportCard = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseImportedJson(await file.text());
      const { summary } = importPayload(parsed, 'merge');
      showToast(`${summary} ✦`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入工程失败', 'error');
    }
  };

  const addCanvasElement = (
    type: CanvasElement['type'],
    presetText?: string,
    presetLabel?: string,
  ) => {
    const id = `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const nextEl: CanvasElement =
      type === 'text'
        ? {
            id,
            side: activeProject.side,
            type: 'text',
            label: presetLabel || '自由文本',
            text: presetText || 'STUDIO TEXT',
            x: 12,
            y: 16,
            w: 38,
            h: 12,
            fontSize: 3.4,
            fontWeight: 700,
            color: activeProject.bgDark ? '#F8FAFC' : '#333333',
            craft: 'none',
          }
        : type === 'qr'
          ? {
              id,
              side: activeProject.side,
              type: 'qr',
              label: '附加二维码',
              x: 68,
              y: 52,
              w: 22,
              h: 36,
              color: '#333333',
              craft: 'none',
            }
          : {
              id,
              side: activeProject.side,
              type,
              label: presetLabel || (type === 'circle' ? '圆形色块' : type === 'pill' ? '胶囊装饰' : '矩形色块'),
              x: 64,
              y: 16,
              w: 22,
              h: type === 'circle' ? 35 : 16,
              bg: activeProject.color,
              opacity: 0.28,
              radius: 8,
              craft: 'none',
            };
    updateActiveProject((prev) => ({
      ...prev,
      customElements: [...prev.customElements, nextEl],
    }));
    setSelectedElId(id);
    showToast(`已在${activeProject.side === 'front' ? '正' : '背'}面添加「${nextEl.label}」`, 'success');
  };

  const currentSideEls = activeProject.customElements.filter((e) => e.side === activeProject.side);
  const activeCanvasEl = currentSideEls.find((e) => e.id === selectedElId) || currentSideEls[0] || null;

  const updateCanvasEl = (id: string, patch: Partial<CanvasElement>) => {
    updateActiveProject((prev) => ({
      ...prev,
      customElements: prev.customElements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  };

  const alignCanvasEl = (a: 'left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom') => {
    if (!activeCanvasEl) return;
    const patch: Partial<CanvasElement> = {};
    if (a === 'left') patch.x = 5;
    if (a === 'cx') patch.x = Number(((100 - activeCanvasEl.w) / 2).toFixed(1));
    if (a === 'right') patch.x = Number((95 - activeCanvasEl.w).toFixed(1));
    if (a === 'top') patch.y = 6;
    if (a === 'cy') patch.y = Number(((100 - activeCanvasEl.h) / 2).toFixed(1));
    if (a === 'bottom') patch.y = Number((94 - activeCanvasEl.h).toFixed(1));
    updateCanvasEl(activeCanvasEl.id, patch);
  };

  const currentSideStock = getEffectiveSidePaper(activeProject, activeProject.side);

  return (
    <div className="ws-shell !h-screen overflow-hidden">
      {/* PRD §7.4 顶栏 64px */}
      <header className="ws-topbar">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to="/templates"
            className="w-10 h-10 rounded-[0_12px_0_12px] border border-[#E9E9E7] bg-white flex items-center justify-center text-[#333333] hover:border-[#F39800] shrink-0"
            aria-label="返回模板库"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <input
            type="text"
            aria-label="方案名称"
            value={activeProject.title}
            onChange={(e) => updateActiveProject((p) => ({ ...p, title: e.target.value }))}
            className="h-9 px-2.5 rounded-[0_10px_0_10px] border border-transparent hover:border-[#E9E9E7] focus:border-[#FF7600] focus:outline-none text-sm font-bold text-[#333333] w-44 sm:w-56"
          />
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              disabled={!undoStack.length}
              onClick={() => undo()}
              className="w-9 h-9 rounded-lg border border-[#E9E9E7] flex items-center justify-center disabled:opacity-35 cursor-pointer"
              title="撤销 (Cmd/Ctrl+Z)"
              aria-label="撤销"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!redoStack.length}
              onClick={() => redo()}
              className="w-9 h-9 rounded-lg border border-[#E9E9E7] flex items-center justify-center disabled:opacity-35 cursor-pointer"
              title="重做 (Shift+Cmd/Ctrl+Z)"
              aria-label="重做"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <span className="hidden xl:inline-flex items-center gap-1 text-xs text-[#535353] whitespace-nowrap">
            <span className="text-[#FF7600]">✦</span> {lastSavedAt}
          </span>
        </div>

        <div className="ws-seg" role="tablist" aria-label="编辑模式切换">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'form'}
            onClick={() => setMode('form')}
            className={`ws-seg__btn ${mode === 'form' ? 'is-active' : ''}`}
          >
            极简表单
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'canvas'}
            onClick={() => setMode('canvas')}
            className={`ws-seg__btn ${mode === 'canvas' ? 'is-active' : ''}`}
          >
            自由画布
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex bg-[#F0F0F0] rounded-full p-0.5 border border-[#E9E9E7] text-xs font-bold">
            <button
              type="button"
              onClick={() => updateActiveProject((p) => ({ ...p, side: 'front' }), false)}
              className={`px-3 py-1.5 rounded-full cursor-pointer ${
                activeProject.side === 'front' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
              }`}
            >
              正面
            </button>
            <button
              type="button"
              onClick={() => updateActiveProject((p) => ({ ...p, side: 'back' }), false)}
              className={`px-3 py-1.5 rounded-full cursor-pointer ${
                activeProject.side === 'back' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
              }`}
            >
              反面
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenBackup}
            className="hidden lg:inline-flex ws-nav-btn !px-3"
            title="备份与导入工程"
          >
            <FolderSync className="w-3.5 h-3.5" />
            备份
          </button>

          <button
            type="button"
            onClick={() => {
              setNewTplName(`${tpl.name} · 改版`);
              setNewTplDesc('');
              setShowSaveTplModal(true);
            }}
            className="hidden md:inline-flex ws-nav-btn !px-3"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            存为新模板
          </button>

          {tpl.isCustom && (
            <button
              type="button"
              onClick={() => {
                if (updateCurrentCustomTemplate()) {
                  showToast(`已覆写更新自定义模板「${tpl.name}」✦`, 'success');
                }
              }}
              className="hidden xl:inline-flex ws-nav-btn !border-[#008969] !text-[#008969]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              更新模板
            </button>
          )}

          <Link to="/works" className="hidden sm:inline-flex ws-nav-btn">我的作品</Link>
          <Link to="/phygital" className="hidden lg:inline-flex ws-nav-btn">Phygital 双栖</Link>
          <Link to="/export" className="ws-export-btn">导出 →</Link>
        </div>
      </header>

      {/* PRD §7.4 三栏主体 */}
      <div className="editor-main min-h-0 flex-1 overflow-hidden">
        {/* 左栏 360px */}
        <aside className="bg-white border-r border-[#E9E9E7] min-h-0 flex flex-col overflow-hidden">
          {mode === 'form' ? (
            <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
              {/* 卡底与装饰区域材质卡片 */}
              <div className="p-3 rounded-[0_14px_0_14px] border border-[#FF7600]/25 bg-[#FFF7EC] space-y-2">
                <div className="text-xs font-bold text-[#D95F00]">卡底与装饰区域材质</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex flex-col gap-1 font-semibold text-[#535353]">
                    <span>正面卡底</span>
                    <select
                      value={activeProject.frontPaper || activeProject.paper}
                      onChange={(e) => setSideStock('front', e.target.value as PaperStockId)}
                      className="h-7 px-1.5 rounded border border-[#E9E9E7] bg-white text-[#333333]"
                    >
                      {(Object.keys(PAPER_STOCKS) as PaperStockId[]).map((pid) => (
                        <option key={pid} value={pid}>{PAPER_STOCKS[pid].name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#535353]">
                    <span>背面卡底</span>
                    <select
                      value={activeProject.backPaper || activeProject.paper}
                      onChange={(e) => setSideStock('back', e.target.value as PaperStockId)}
                      className="h-7 px-1.5 rounded border border-[#E9E9E7] bg-white text-[#333333]"
                    >
                      {(Object.keys(PAPER_STOCKS) as PaperStockId[]).map((pid) => (
                        <option key={pid} value={pid}>{PAPER_STOCKS[pid].name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#535353]">
                    <span>立绘与装饰线</span>
                    <select
                      value={activeProject.regionCrafts.decor || 'none'}
                      onChange={(e) => setRegionCraft('decor', e.target.value as SurfaceCraftId)}
                      className="h-7 px-1.5 rounded border border-[#E9E9E7] bg-white text-[#333333]"
                    >
                      {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                        <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-[#535353]">
                    <span>背面副标</span>
                    <select
                      value={activeProject.regionCrafts.backTitle || 'none'}
                      onChange={(e) => setRegionCraft('backTitle', e.target.value as SurfaceCraftId)}
                      className="h-7 px-1.5 rounded border border-[#E9E9E7] bg-white text-[#333333]"
                    >
                      {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                        <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* P名 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-[#535353]">
                  <label htmlFor="efName">P 名（姓名 / 昵称）*</label>
                  <select
                    aria-label="P名材质"
                    value={activeProject.regionCrafts.name || 'none'}
                    onChange={(e) => setRegionCraft('name', e.target.value as SurfaceCraftId)}
                    className="h-6 px-1.5 rounded border border-[#E9E9E7] bg-[#F0F0F0] text-[11px]"
                  >
                    {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                      <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                    ))}
                  </select>
                </div>
                <input
                  id="efName"
                  type="text"
                  placeholder="制作人Producer"
                  value={activeProject.fields.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className={`prd-input !min-h-[38px] text-sm ${selectedRegion === 'name' ? 'border-[#FF7600]' : ''}`}
                />
              </div>

              {/* 英文名 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-[#535353]">
                  <label htmlFor="efEnName">英文名</label>
                  <select
                    aria-label="英文名材质"
                    value={activeProject.regionCrafts.enName || 'none'}
                    onChange={(e) => setRegionCraft('enName', e.target.value as SurfaceCraftId)}
                    className="h-6 px-1.5 rounded border border-[#E9E9E7] bg-[#F0F0F0] text-[11px]"
                  >
                    {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                      <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                    ))}
                  </select>
                </div>
                <input
                  id="efEnName"
                  type="text"
                  placeholder="PRODUCER（留空自动隐藏）"
                  value={activeProject.fields.enName}
                  onChange={(e) => setField('enName', e.target.value)}
                  className="prd-input !min-h-[38px] text-sm"
                />
              </div>

              {/* 担当偶像组合框 */}
              <div className="space-y-1 relative">
                <div className="flex items-center justify-between text-xs font-bold text-[#535353]">
                  <label htmlFor="efTitle">担当 / 职位定位</label>
                  <select
                    aria-label="担当职位材质"
                    value={activeProject.regionCrafts.title || 'none'}
                    onChange={(e) => setRegionCraft('title', e.target.value as SurfaceCraftId)}
                    className="h-6 px-1.5 rounded border border-[#E9E9E7] bg-[#F0F0F0] text-[11px]"
                  >
                    {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                      <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                    ))}
                  </select>
                </div>
                <input
                  id="efTitle"
                  type="text"
                  placeholder="花海咲季担当 / 独立设计师"
                  value={activeProject.fields.title}
                  onFocus={() => setIdolDropdownOpen(true)}
                  onBlur={() => window.setTimeout(() => setIdolDropdownOpen(false), 180)}
                  onChange={(e) => setField('title', e.target.value)}
                  className="prd-input !min-h-[38px] text-sm"
                />
                {idolDropdownOpen && (
                  <div className="combobox-menu is-open">
                    {IDOL_PRESETS.map((idol) => (
                      <button
                        key={idol.id}
                        type="button"
                        onMouseDown={() => {
                          updateActiveProject((p) => ({
                            ...p,
                            color: idol.color,
                            fields: { ...p.fields, title: `${idol.name}担当` },
                          }));
                          setIdolDropdownOpen(false);
                        }}
                        className="combobox-option cursor-pointer"
                      >
                        <span className="combobox-option__avatar" style={{ backgroundColor: idol.color }}>
                          {idol.short}
                        </span>
                        <span>{idol.name}担当</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 所属事务所 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-[#535353]">
                  <label htmlFor="efCompany">所属事务所 / 工作室</label>
                  <select
                    aria-label="事务所材质"
                    value={activeProject.regionCrafts.company || 'none'}
                    onChange={(e) => setRegionCraft('company', e.target.value as SurfaceCraftId)}
                    className="h-6 px-1.5 rounded border border-[#E9E9E7] bg-[#F0F0F0] text-[11px]"
                  >
                    {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                      <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                    ))}
                  </select>
                </div>
                <input
                  id="efCompany"
                  type="text"
                  placeholder="初星学園"
                  value={activeProject.fields.company}
                  onChange={(e) => setField('company', e.target.value)}
                  className="prd-input !min-h-[38px] text-sm"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COMPANY_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setField('company', c)}
                      className="px-2.5 py-0.5 rounded-full border border-[#E9E9E7] bg-[#F0F0F0] text-[11px] hover:border-[#F39800] cursor-pointer"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 社交账号与独立材质 */}
              {(
                [
                  ['x', 'X (Twitter)', '@hatsuboshi_p'],
                  ['weibo', '微博', '@制作人Producer'],
                  ['bilibili', 'B站 UID', 'UID 12345678'],
                  ['xhs', '小红书', '小红书号'],
                  ['website', '个人网址', 'ichiban.star'],
                  ['motto', '喜欢的曲 / Slogan', 'Fighting My Way'],
                ] as const
              ).map(([fid, label, ph]) => (
                <div key={fid} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-[#535353]">
                    <span>{label}</span>
                    <select
                      aria-label={`${label}材质`}
                      value={activeProject.regionCrafts[fid] || 'none'}
                      onChange={(e) => setRegionCraft(fid, e.target.value as SurfaceCraftId)}
                      className="h-6 px-1.5 rounded border border-[#E9E9E7] bg-[#F0F0F0] text-[11px]"
                    >
                      {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                        <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder={ph}
                    value={activeProject.fields[fid]}
                    onChange={(e) => setField(fid, e.target.value)}
                    className="prd-input !min-h-[36px] text-xs"
                  />
                </div>
              ))}

              {/* 立绘 / 插画上传 */}
              <div className="p-3 rounded-[0_14px_0_14px] border border-dashed border-[#F39800] bg-[#FFF7EC]/70 space-y-2 text-xs">
                <input
                  ref={artInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleUploadArtwork(e.target.files?.[0])}
                />
                <div className="flex items-center justify-between font-bold text-[#333333]">
                  <span>插画立绘 / 个人头像叠加</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => artInputRef.current?.click()}
                      className="text-[#D95F00] hover:underline cursor-pointer"
                    >
                      上传图片
                    </button>
                    {activeProject.standee.dataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveProject((p) => ({ ...p, standee: { ...p.standee, enabled: false, dataUrl: '' } }))
                        }
                        className="text-[#E30F25] cursor-pointer"
                      >
                        移除
                      </button>
                    )}
                  </div>
                </div>
                {activeProject.standee.dataUrl && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="block">
                      <span className="text-[10px] text-[#535353]">缩放 {activeProject.standee.scale}%</span>
                      <input
                        type="range"
                        min={60}
                        max={180}
                        value={activeProject.standee.scale}
                        onChange={(e) =>
                          updateActiveProject((p) => ({ ...p, standee: { ...p.standee, scale: Number(e.target.value) } }))
                        }
                        className="w-full accent-[#FF7600]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-[#535353]">透明度 {activeProject.standee.opacity}%</span>
                      <input
                        type="range"
                        min={15}
                        max={100}
                        value={activeProject.standee.opacity}
                        onChange={(e) =>
                          updateActiveProject((p) => ({ ...p, standee: { ...p.standee, opacity: Number(e.target.value) } }))
                        }
                        className="w-full accent-[#FF7600]"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 背面动态二维码开关 */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E9E9E7]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#333333]">
                  <span>背面动态二维码</span>
                  <select
                    aria-label="二维码材质"
                    value={activeProject.regionCrafts.qr || 'none'}
                    onChange={(e) => setRegionCraft('qr', e.target.value as SurfaceCraftId)}
                    className="h-6 px-1.5 rounded border border-[#E9E9E7] bg-[#F0F0F0] text-[11px]"
                  >
                    {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                      <option key={cid} value={cid}>{SURFACE_CRAFTS[cid].name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={activeProject.showQr}
                  onClick={() => updateActiveProject((p) => ({ ...p, showQr: !p.showQr }))}
                  className="toggle-switch !w-11 !h-6"
                  aria-label="背面展示二维码"
                />
              </div>
            </div>
          ) : (
            /* 自由画布左侧双栏：64px 图标轨 + 296px 抽屉 */
            <div className="grid grid-cols-[64px_1fr] flex-1 min-h-0">
              <div className="bg-[#F0F0F0] border-r border-[#E9E9E7] p-2 flex flex-col gap-2">
                {(
                  [
                    ['templates', '模板', Layers],
                    ['text', '文字', Type],
                    ['icons', '装饰', Sparkles],
                    ['images', '图片', ImagePlus],
                    ['shapes', '图形', Shapes],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCanvasTab(id)}
                    className={`min-h-[52px] rounded-[0_12px_0_12px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold cursor-pointer ${
                      canvasTab === id
                        ? 'bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white'
                        : 'text-[#535353] hover:bg-white hover:text-[#D95F00]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 overflow-y-auto space-y-3 text-xs">
                {canvasTab === 'templates' && (
                  <div className="space-y-2">
                    <div className="font-bold text-[#333333]">切换通用风格模板（60+）</div>
                    <div className="grid grid-cols-2 gap-2">
                      {getAllTemplates().slice(0, 20).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTemplate(t.id)}
                          className={`p-2 rounded-[0_10px_0_10px] border text-left cursor-pointer ${
                            tpl.id === t.id ? 'border-[#FF7600] bg-[#FFF7EC]' : 'border-[#E9E9E7] bg-white'
                          }`}
                        >
                          <div className="font-bold text-[#333333] truncate">{t.name}</div>
                          <div className="text-[10px] text-[#535353]">{t.id}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {canvasTab === 'text' && (
                  <div className="space-y-2">
                    <div className="font-bold text-[#333333] mb-1">点击插入自由文字图层</div>
                    {[
                      ['添加大标题文本', 'PRODUCER ★', '自由大标题'],
                      ['添加副标题 / Tag', 'CREATIVE STUDIO', '副标题'],
                      ['添加四角星标 ✦', '✦ ICHIBANBOSHI ✦', '星标铭文'],
                    ].map(([btn, txt, lbl]) => (
                      <button
                        key={btn}
                        type="button"
                        onClick={() => addCanvasElement('text', txt, lbl)}
                        className="w-full p-3 rounded-[0_14px_0_14px] border border-[#E9E9E7] hover:border-[#FF7600] hover:bg-[#FFF7EC] text-left font-bold text-[#333333] cursor-pointer"
                      >
                        + {btn}
                      </button>
                    ))}
                  </div>
                )}

                {canvasTab === 'icons' && (
                  <div className="space-y-2">
                    <div className="font-bold text-[#333333]">点击插入装饰符 / 副二维码</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['✦', '★', '◆', '❖', '✿', '♪'].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => addCanvasElement('text', sym, `星标 ${sym}`)}
                          className="p-3 rounded-[0_12px_0_12px] border border-[#E9E9E7] hover:border-[#FF7600] text-center text-base font-bold cursor-pointer"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addCanvasElement('qr', '', '附加二维码')}
                      className="w-full p-2.5 rounded-[0_12px_0_12px] border border-[#E9E9E7] hover:border-[#FF7600] flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                    >
                      <QrCode className="w-4 h-4 text-[#FF7600]" />
                      + 插入自由二维码
                    </button>
                  </div>
                )}

                {canvasTab === 'images' && (
                  <div className="space-y-3">
                    <input
                      ref={canvasImgInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleUploadCanvasImage(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => canvasImgInputRef.current?.click()}
                      className="w-full p-5 rounded-[0_16px_0_16px] border-2 border-dashed border-[#F39800] bg-[#FFF7EC] text-[#D95F00] font-bold cursor-pointer"
                    >
                      + 上传图片到画布图层
                    </button>
                    <input
                      ref={cardImportRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => void handleImportCard(e.target.files?.[0])}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cardImportRef.current?.click()}
                        className="flex-1 py-2 rounded-lg border border-[#E9E9E7] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        导入单卡
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerJsonDownload(`${activeProject.fields.name || 'card'}.ichiban-card.json`, buildSingleCardFile(activeProject));
                          showToast('已导出单卡工程 JSON', 'success');
                        }}
                        className="flex-1 py-2 rounded-lg border border-[#E9E9E7] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        导出单卡
                      </button>
                    </div>
                  </div>
                )}

                {canvasTab === 'shapes' && (
                  <div className="space-y-2">
                    <div className="font-bold text-[#333333]">插入几何色块装饰</div>
                    <button
                      type="button"
                      onClick={() => addCanvasElement('rect')}
                      className="w-full p-2.5 rounded-[0_12px_0_12px] border border-[#E9E9E7] hover:border-[#FF7600] flex items-center gap-2 font-bold cursor-pointer"
                    >
                      <Square className="w-4 h-4 text-[#FF7600]" />
                      + 矩形色块
                    </button>
                    <button
                      type="button"
                      onClick={() => addCanvasElement('circle')}
                      className="w-full p-2.5 rounded-[0_12px_0_12px] border border-[#E9E9E7] hover:border-[#FF7600] font-bold text-left cursor-pointer"
                    >
                      + 圆形光斑色块
                    </button>
                    <button
                      type="button"
                      onClick={() => addCanvasElement('pill')}
                      className="w-full p-2.5 rounded-[0_12px_0_12px] border border-[#E9E9E7] hover:border-[#FF7600] font-bold text-left cursor-pointer"
                    >
                      + 胶囊角装饰条
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* 中栏：画布工作台 + 底部 56px 特种纸与工艺横条 */}
        <section className="min-w-0 min-h-0 grid grid-rows-[1fr_56px] overflow-hidden">
          <div className="relative canvas-dots-bg flex items-center justify-center p-10 overflow-auto">
            {/* 画布顶部悬浮工具条 */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur border border-[#E9E9E7] rounded-[0_18px_0_18px] shadow-sm px-3.5 py-1.5 flex items-center gap-2.5 text-xs whitespace-nowrap">
              <select
                aria-label="名片物理规格"
                value={activeProject.spec}
                onChange={(e) => {
                  const sp = e.target.value as SpecId;
                  updateActiveProject((p) => ({
                    ...p,
                    spec: sp,
                    orient: sp === 'sq54' || sp === 'sq65' ? 's' : p.orient === 's' ? 'h' : p.orient,
                  }));
                }}
                className="h-7 px-2 rounded border border-[#E9E9E7] font-semibold"
              >
                {Object.values(CARD_SPECS).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <div className="inline-flex rounded-full border border-[#E9E9E7] overflow-hidden">
                {([0, 3, 5] as const).map((cm) => (
                  <button
                    key={cm}
                    type="button"
                    onClick={() => updateActiveProject((p) => ({ ...p, cornerMm: cm, rounded: cm > 0 }))}
                    className={`px-2 py-1 font-semibold cursor-pointer ${
                      activeProject.cornerMm === cm ? 'bg-[#FFF7EC] text-[#D95F00]' : 'text-[#535353]'
                    }`}
                  >
                    {cm === 0 ? '直角' : `${cm}mm`}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowBleed((v) => !v)}
                className={`px-2.5 py-1 rounded-full border font-semibold cursor-pointer ${
                  showBleed ? 'border-[#E30F25] bg-[#E30F25]/10 text-[#E30F25]' : 'border-[#E9E9E7] text-[#535353]'
                }`}
              >
                出血线
              </button>
              <button
                type="button"
                onClick={() => setShowTrim((v) => !v)}
                className={`px-2.5 py-1 rounded-full border font-semibold cursor-pointer ${
                  showTrim ? 'border-[#333333] bg-[#F0F0F0] text-[#333333]' : 'border-[#E9E9E7] text-[#535353]'
                }`}
              >
                裁切线
              </button>
              <button
                type="button"
                onClick={() => setShowSafe((v) => !v)}
                className={`px-2.5 py-1 rounded-full border font-semibold cursor-pointer ${
                  showSafe ? 'border-[#4E93F2] bg-[#4E93F2]/10 text-[#4E93F2]' : 'border-[#E9E9E7] text-[#535353]'
                }`}
              >
                安全区
              </button>

              <input
                type="color"
                aria-label="主题色"
                value={activeProject.color}
                onChange={(e) => updateActiveProject((p) => ({ ...p, color: e.target.value }))}
                className="w-6 h-6 rounded border border-[#E9E9E7] cursor-pointer"
              />
            </div>

            {/* 中心名片实时预览（点击任意区域选中赋材质） */}
            <div
              className={`transition-transform duration-200 ${
                activeProject.orient === 'v' ? 'w-64' : activeProject.orient === 's' ? 'w-72' : 'w-[440px]'
              }`}
              style={{ transform: `scale(${zoom})` }}
            >
              <CardFaceView
                project={activeProject}
                template={tpl}
                showBleedGuide={showBleed}
                showTrimGuide={showTrim}
                showSafeGuide={showSafe}
                focusedRegion={selectedRegion}
                onRegionClick={(reg) => {
                  setSelectedRegion(reg);
                  showToast(`已选中区域：${EDITABLE_REGIONS.find((r) => r.id === reg)?.label}`, 'info');
                }}
              />
            </div>

            {/* 画布左下/右下状态浮层 */}
            <div className="absolute left-4 bottom-3.5 px-3 py-1 rounded-full bg-white/95 border border-[#E9E9E7] text-[11px] font-semibold text-[#535353]">
              {dims.w}×{dims.h}mm · {PAPER_STOCKS[currentSideStock].name} · 点击卡片元素可独立赋材质
            </div>

            <div className="absolute right-4 bottom-3.5 px-3 py-1 rounded-full bg-white/95 border border-[#E9E9E7] flex items-center gap-2 text-xs font-semibold">
              {([0.85, 1, 1.15] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`px-1.5 rounded cursor-pointer ${zoom === z ? 'text-[#D95F00] font-bold' : 'text-[#535353]'}`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* 底部 56px 材质与工艺横条（1440px 下全显不溢出） */}
          <div className="min-h-[56px] bg-white border-t border-[#E9E9E7] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-bold text-[#535353] mr-0.5">纸基:</span>
              {(Object.keys(PAPER_STOCKS) as PaperStockId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  title={PAPER_STOCKS[pid].name}
                  onClick={() => setSideStock(activeProject.side, pid)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                    currentSideStock === pid ? 'ring-2 ring-[#FF7600] ring-offset-1' : ''
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-[#BFBFBF]"
                    style={{ backgroundColor: STOCK_SWATCH_COLORS[pid] }}
                  />
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setRegionCraft(selectedRegion, cid)}
                  className={`px-2 h-7 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                    (activeProject.regionCrafts[selectedRegion] || 'none') === cid
                      ? 'bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white border-transparent'
                      : 'border-[#E9E9E7] text-[#535353] hover:border-[#F39800]'
                  }`}
                >
                  {SURFACE_CRAFTS[cid].name}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 右栏 300px：内嵌 WebGL 3D 实时缩略窗 + 全可编辑区域自由材质工作台 */}
        <aside className="bg-white border-l border-[#E9E9E7] min-h-0 flex flex-col overflow-y-auto">
          <div className="p-3.5 border-b border-[#E9E9E7] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#333333]">真实 3D 材质</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#FFF7EC] border border-[#FF7600]/30 text-[10px] font-bold text-[#D95F00]">
                  WEBGL PBR
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShow3DModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E9E9E7] hover:border-[#F39800] text-[11px] font-bold text-[#D95F00] cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                展开 3D
              </button>
            </div>
            <CardPreview3D
              project={activeProject}
              template={tpl}
              heightClass="h-[190px]"
              compact
              paused={show3DModal}
            />
          </div>

          <div className="p-4 border-b border-[#E9E9E7] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#333333]">
                区域自由材质 · {EDITABLE_REGIONS.find((r) => r.id === selectedRegion)?.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {EDITABLE_REGIONS.map((reg) => {
                const mat = activeProject.regionCrafts[reg.id] || 'none';
                const active = selectedRegion === reg.id;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => setSelectedRegion(reg.id)}
                    className={`px-2 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                      active
                        ? 'bg-[#FFF7EC] border-[#FF7600] text-[#D95F00]'
                        : 'bg-[#F0F0F0] border-[#E9E9E7] text-[#535353]'
                    }`}
                  >
                    {reg.label.split(' ')[0]}
                    {mat !== 'none' && <span className="ml-1 text-[#FF7600]">•</span>}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => {
                const active = (activeProject.regionCrafts[selectedRegion] || 'none') === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setRegionCraft(selectedRegion, cid)}
                    className={`py-2 px-1 rounded-[0_10px_0_10px] border text-[11px] font-semibold text-center cursor-pointer ${
                      active
                        ? 'border-[#FF7600] bg-[#FFF7EC] text-[#D95F00]'
                        : 'border-[#E9E9E7] bg-white text-[#333333] hover:border-[#F39800]'
                    }`}
                  >
                    {SURFACE_CRAFTS[cid].name}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#535353]">快捷配色</span>
              <div className="flex gap-1">
                {THEME_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updateActiveProject((p) => ({ ...p, color: c.hex, accent: c.accent }))}
                    className="w-4 h-4 rounded-full border border-white shadow-sm cursor-pointer"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 自由画布元素属性与图层管理 */}
          {mode === 'canvas' && (
            <div className="p-4 space-y-3 text-xs">
              <div className="font-bold text-[#333333]">自由图层 ({currentSideEls.length})</div>

              {activeCanvasEl && (
                <div className="p-3 rounded-xl bg-[#F0F0F0] space-y-2">
                  {activeCanvasEl.type === 'text' && (
                    <input
                      type="text"
                      value={activeCanvasEl.text || ''}
                      onChange={(e) => updateCanvasEl(activeCanvasEl.id, { text: e.target.value })}
                      className="w-full px-2 py-1 rounded border border-[#E9E9E7] bg-white"
                    />
                  )}
                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'w', 'h'] as const).map((k) => (
                      <label key={k} className="block">
                        <span className="text-[10px] uppercase text-[#535353]">{k}%</span>
                        <input
                          type="number"
                          value={activeCanvasEl[k]}
                          onChange={(e) => updateCanvasEl(activeCanvasEl.id, { [k]: Number(e.target.value) })}
                          className="w-full px-1 py-0.5 rounded border border-[#E9E9E7] bg-white"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {(
                      [
                        ['left', AlignStartHorizontal],
                        ['cx', AlignCenterHorizontal],
                        ['right', AlignEndHorizontal],
                        ['top', AlignStartVertical],
                        ['cy', AlignCenterVertical],
                        ['bottom', AlignEndVertical],
                      ] as const
                    ).map(([m, Icon]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => alignCanvasEl(m)}
                        className="p-1 rounded border border-[#E9E9E7] bg-white flex justify-center cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {currentSideEls.map((el) => (
                  <div
                    key={el.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border ${
                      activeCanvasEl?.id === el.id ? 'border-[#4E93F2] bg-[#4E93F2]/10' : 'border-[#E9E9E7]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedElId(el.id)}
                      className="font-semibold text-left flex-1 truncate cursor-pointer"
                    >
                      {el.label || el.type}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateCanvasEl(el.id, { hidden: !el.hidden })}
                        className="p-1 text-[#535353] cursor-pointer"
                        aria-label="切换显示"
                      >
                        {el.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCanvasEl(el.id, { locked: !el.locked })}
                        className="p-1 text-[#535353] cursor-pointer"
                        aria-label="锁定图层"
                      >
                        {el.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveProject((p) => ({
                            ...p,
                            customElements: p.customElements.filter((x) => x.id !== el.id),
                          }))
                        }
                        className="p-1 text-[#E30F25] cursor-pointer"
                        aria-label="删除图层"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 另存副本快捷栏 */}
          <div className="mt-auto p-3 border-t border-[#E9E9E7] flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                saveActiveWorkCopy();
                showToast('已另存为新名刺方案副本 ✦', 'success');
              }}
              className="flex-1 py-2 rounded-lg border border-[#E9E9E7] hover:border-[#F39800] font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <CopyPlus className="w-3.5 h-3.5 text-[#FF7600]" />
              另存副本
            </button>
            <button
              type="button"
              onClick={() => navigate('/export')}
              className="flex-1 py-2 rounded-lg bg-[#FFF7EC] text-[#D95F00] font-bold cursor-pointer"
            >
              印前检查 →
            </button>
          </div>
        </aside>
      </div>

      {/* 3D 展开模态框 */}
      {show3DModal && (
        <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-label="WebGL 真实材质 3D 审样">
          <div className="auth-modal__dialog !w-[min(880px,100%)]">
            <div className="auth-modal__head">
              <div>
                <div className="auth-modal__eyebrow">✦ WEBGL PBR REAL MATERIAL</div>
                <h2 className="auth-modal__title">真实物理材质与厚度 360° 审样</h2>
              </div>
              <button type="button" onClick={() => setShow3DModal(false)} className="auth-modal__close cursor-pointer">×</button>
            </div>
            <CardPreview3D project={activeProject} template={tpl} heightClass="h-[460px]" />
          </div>
        </div>
      )}

      {/* 保存自定义模板模态框 */}
      {showSaveTplModal && (
        <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-label="存为自定义模板">
          <div className="auth-modal__dialog !w-[min(460px,100%)]">
            <div className="auth-modal__head">
              <div>
                <div className="auth-modal__eyebrow">✦ SAVE CUSTOM TEMPLATE</div>
                <h2 className="auth-modal__title">保存为可复用本地模板</h2>
              </div>
              <button type="button" onClick={() => setShowSaveTplModal(false)} className="auth-modal__close cursor-pointer">×</button>
            </div>
            <div className="auth-modal__form">
              <div className="auth-field">
                <label htmlFor="newTplName">模板名称 *</label>
                <input
                  id="newTplName"
                  type="text"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="newTplDesc">模板备注说明</label>
                <input
                  id="newTplDesc"
                  type="text"
                  placeholder="例如：黑卡哑金展位交换专用版本"
                  value={newTplDesc}
                  onChange={(e) => setNewTplDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSaveTplModal(false)} className="prd-chip">取消</button>
                <button
                  type="button"
                  onClick={() => {
                    const saved = saveCurrentAsNewTemplate(newTplName, newTplDesc);
                    setShowSaveTplModal(false);
                    showToast(`已保存本地模板「${saved.name}」✦`, 'success');
                  }}
                  className="btn-cta btn-cta--sm"
                >
                  确认保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

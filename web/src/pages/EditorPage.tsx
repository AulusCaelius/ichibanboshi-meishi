import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BookmarkPlus,
  Box,
  CopyPlus,
  Download,
  FlipHorizontal2,
  ImagePlus,
  Layers,
  Palette,
  Printer,
  QrCode,
  RefreshCw,
  Ruler,
  Sparkles,
  Square,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { CardPreview3D } from '../components/CardPreview3D';
import {
  CARD_SPECS,
  EDITABLE_REGIONS,
  PAPER_STOCKS,
  ROLE_PRESETS,
  SURFACE_CRAFTS,
  THEME_COLORS,
} from '../data/templates';
import { buildSingleCardFile, parseImportedJson, triggerJsonDownload } from '../storage/backup';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';
import type {
  CanvasElement,
  EditableRegionId,
  PaperStockId,
  SpecId,
  SurfaceCraftId,
  TemplateOrient,
} from '../types/card';

type EditorTab = 'content' | 'style' | 'artwork' | 'craft' | 'canvas';

export function EditorPage() {
  const navigate = useNavigate();
  const {
    activeProject,
    getTemplate,
    updateActiveProject,
    saveActiveWorkCopy,
    saveCurrentAsNewTemplate,
    updateCurrentCustomTemplate,
    importPayload,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const tpl = getTemplate(activeProject.tplId);
  const [tab, setTab] = useState<EditorTab>('content');
  const [showGuides, setShowGuides] = useState(true);
  const [zoom, setZoom] = useState<0.85 | 1 | 1.15>(1);
  const [show3DModal, setShow3DModal] = useState(false);
  const [showSaveTplModal, setShowSaveTplModal] = useState(false);
  const [newTplName, setNewTplName] = useState(`${tpl.name} · 改版`);
  const [newTplDesc, setNewTplDesc] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<EditableRegionId>('name');
  const [selectedElId, setSelectedElId] = useState<string>('');

  const artInputRef = useRef<HTMLInputElement | null>(null);
  const cardImportRef = useRef<HTMLInputElement | null>(null);

  const setField = (key: keyof typeof activeProject.fields, val: string) => {
    updateActiveProject((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: val },
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
      const dataUrl = String(reader.result || '');
      updateActiveProject((prev) => ({
        ...prev,
        standee: { ...prev.standee, enabled: true, dataUrl },
      }));
      showToast('已载入自定义插画图片并自动保存至本地 IndexedDB', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleImportCardFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportedJson(text);
      const { summary } = importPayload(parsed, 'merge');
      showToast(summary, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入工程失败', 'error');
    }
  };

  const addCanvasElement = (type: CanvasElement['type']) => {
    const id = `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const nextEl: CanvasElement =
      type === 'text'
        ? {
            id,
            side: activeProject.side,
            type: 'text',
            label: '自由文本',
            text: 'STUDIO TEXT',
            x: 12,
            y: 14,
            w: 36,
            h: 10,
            fontSize: 3.4,
            fontWeight: 700,
            color: activeProject.bgDark ? '#F8FAFC' : '#0F172A',
            craft: 'none',
          }
        : type === 'qr'
          ? {
              id,
              side: activeProject.side,
              type: 'qr',
              label: '附加二维码',
              x: 68,
              y: 54,
              w: 22,
              h: 35,
              color: '#0F172A',
              craft: 'none',
            }
          : {
              id,
              side: activeProject.side,
              type,
              label: type === 'circle' ? '圆形色块' : type === 'pill' ? '胶囊装饰' : '矩形色块',
              x: 64,
              y: 14,
              w: 22,
              h: type === 'circle' ? 35 : 16,
              bg: activeProject.color,
              opacity: 0.25,
              radius: 8,
              craft: 'none',
            };
    updateActiveProject((prev) => ({
      ...prev,
      customElements: [...prev.customElements, nextEl],
    }));
    setSelectedElId(id);
    showToast('已在当前面添加自由画布图层', 'success');
  };

  const currentSideEls = activeProject.customElements.filter((e) => e.side === activeProject.side);
  const activeCanvasEl = currentSideEls.find((e) => e.id === selectedElId) || currentSideEls[0] || null;

  const updateCanvasEl = (id: string, patch: Partial<CanvasElement>) => {
    updateActiveProject((prev) => ({
      ...prev,
      customElements: prev.customElements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  };

  const alignCanvasEl = (mode: 'left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom') => {
    if (!activeCanvasEl) return;
    const patch: Partial<CanvasElement> = {};
    if (mode === 'left') patch.x = 5;
    if (mode === 'cx') patch.x = Number(((100 - activeCanvasEl.w) / 2).toFixed(1));
    if (mode === 'right') patch.x = Number((95 - activeCanvasEl.w).toFixed(1));
    if (mode === 'top') patch.y = 6;
    if (mode === 'cy') patch.y = Number(((100 - activeCanvasEl.h) / 2).toFixed(1));
    if (mode === 'bottom') patch.y = Number((94 - activeCanvasEl.h).toFixed(1));
    updateCanvasEl(activeCanvasEl.id, patch);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Studio Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={activeProject.title}
            onChange={(e) => updateActiveProject((p) => ({ ...p, title: e.target.value }))}
            aria-label="名片工程名称"
            className="font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#FF7600] w-48 sm:w-60"
          />
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {tpl.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={cardImportRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImportCardFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => cardImportRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#FF7600] text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#FF7600]" />
            导入单卡/模板
          </button>

          <button
            type="button"
            onClick={() => {
              const safe = (activeProject.fields.name || 'card').replace(/[\\/:*?"<>|]/g, '_');
              triggerJsonDownload(`${safe}.ichiban-card.json`, buildSingleCardFile(activeProject));
              showToast('已导出当前单卡 .ichiban-card.json 工程文件', 'success');
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            导出单卡工程
          </button>

          <button
            type="button"
            onClick={() => {
              saveActiveWorkCopy();
              showToast('已在本地作品库另存为新名片副本', 'success');
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            另存副本
          </button>

          {tpl.isCustom && (
            <button
              type="button"
              onClick={() => {
                if (updateCurrentCustomTemplate()) {
                  showToast(`已将最新修改覆写保存至自定义模板「${tpl.name}」`, 'success');
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              更新当前模板
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setNewTplName(`${tpl.name} · 改版`);
              setNewTplDesc('');
              setShowSaveTplModal(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50 text-[#FF7600] hover:bg-orange-100 text-xs font-bold cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            存为新模板
          </button>

          <button
            type="button"
            onClick={() => setShow3DModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold cursor-pointer"
          >
            <Box className="w-3.5 h-3.5 text-[#FF7600]" />
            3D 物理材质预览
          </button>

          <button
            type="button"
            onClick={() => navigate('/export')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg btn-brand text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            印前导出
          </button>
        </div>
      </div>

      {/* Main Split */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Controls Sidebar */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-[11px] font-bold">
            {(
              [
                ['content', '文字内容', Type],
                ['style', '版式纸张', Palette],
                ['artwork', '插画上传', ImagePlus],
                ['craft', '区域材质', Sparkles],
                ['canvas', '自由图层', Layers],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`py-3 px-1 flex flex-col items-center gap-1 border-b-2 transition cursor-pointer ${
                  tab === id
                    ? 'border-[#FF7600] bg-white text-[#FF7600]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4 max-h-[680px] overflow-y-auto text-sm">
            {tab === 'content' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">主姓名 / 昵称 *</span>
                    <input
                      type="text"
                      value={activeProject.fields.name}
                      onChange={(e) => setField('name', e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">英文名 / 副题</span>
                    <input
                      type="text"
                      value={activeProject.fields.enName}
                      onChange={(e) => setField('enName', e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">创作定位 / 职业头衔</span>
                  <input
                    type="text"
                    value={activeProject.fields.title}
                    onChange={(e) => setField('title', e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ROLE_PRESETS.slice(0, 4).map((rp) => (
                      <button
                        key={rp}
                        type="button"
                        onClick={() => setField('title', rp)}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-orange-50 hover:text-[#FF7600] text-[11px] text-slate-600 cursor-pointer"
                      >
                        {rp}
                      </button>
                    ))}
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">工作室 / 归属</span>
                    <input
                      type="text"
                      value={activeProject.fields.company}
                      onChange={(e) => setField('company', e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">编号 / 索引标签</span>
                    <input
                      type="text"
                      value={activeProject.fields.codeTag}
                      onChange={(e) => setField('codeTag', e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">副签 / 场次活动标识</span>
                  <input
                    type="text"
                    value={activeProject.fields.eventTag}
                    onChange={(e) => setField('eventTag', e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                  />
                </label>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">X / Twitter</span>
                    <input
                      type="text"
                      value={activeProject.fields.x}
                      onChange={(e) => setField('x', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">B站主页</span>
                    <input
                      type="text"
                      value={activeProject.fields.bilibili}
                      onChange={(e) => setField('bilibili', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">微博</span>
                    <input
                      type="text"
                      value={activeProject.fields.weibo}
                      onChange={(e) => setField('weibo', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">小红书 / 作品集</span>
                    <input
                      type="text"
                      value={activeProject.fields.xhs}
                      onChange={(e) => setField('xhs', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">个人网站</span>
                  <input
                    type="text"
                    value={activeProject.fields.website}
                    onChange={(e) => setField('website', e.target.value)}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">个性签名 / Slogan</span>
                  <input
                    type="text"
                    value={activeProject.fields.motto}
                    onChange={(e) => setField('motto', e.target.value)}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                  />
                </label>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">背面主标题</span>
                    <input
                      type="text"
                      value={activeProject.fields.backTitle}
                      onChange={(e) => setField('backTitle', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">自定义扫码跳转网址</span>
                    <input
                      type="url"
                      placeholder="留空则默认打开数字名片"
                      value={activeProject.fields.qrUrl}
                      onChange={(e) => setField('qrUrl', e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
                    />
                  </label>
                </div>
              </div>
            )}

            {tab === 'style' && (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-slate-600 block mb-1.5">版面朝向</span>
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                    {(
                      [
                        ['h', '横版标准'],
                        ['v', '竖版立轴'],
                        ['s', '正方形卡'],
                      ] as [TemplateOrient, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          updateActiveProject((p) => ({
                            ...p,
                            orient: id,
                            spec: id === 's' ? 'sq54' : p.spec === 'sq54' || p.spec === 'sq65' ? 'cn' : p.spec,
                          }))
                        }
                        className={`py-2 rounded-lg border cursor-pointer ${
                          activeProject.orient === id
                            ? 'border-[#FF7600] bg-orange-50 text-[#FF7600]'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-600 block mb-1.5">物理裁切规格</span>
                  <select
                    value={activeProject.spec}
                    onChange={(e) => updateActiveProject((p) => ({ ...p, spec: e.target.value as SpecId }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold"
                  >
                    {Object.values(CARD_SPECS).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.note}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between py-2 border-y border-slate-100 text-xs font-bold">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeProject.rounded}
                      onChange={(e) => updateActiveProject((p) => ({ ...p, rounded: e.target.checked }))}
                    />
                    3mm 圆角模切
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeProject.bgDark}
                      onChange={(e) => updateActiveProject((p) => ({ ...p, bgDark: e.target.checked }))}
                    />
                    深色暗夜背景
                  </label>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-600 block mb-2">主题视觉色</span>
                  <div className="grid grid-cols-6 gap-2">
                    {THEME_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => updateActiveProject((p) => ({ ...p, color: c.hex, accent: c.accent }))}
                        title={c.name}
                        className={`h-8 rounded-lg border-2 cursor-pointer ${
                          activeProject.color.toLowerCase() === c.hex.toLowerCase()
                            ? 'border-slate-900 scale-105'
                            : 'border-white shadow-sm'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">自定义吸色：</span>
                    <input
                      type="color"
                      value={activeProject.color}
                      onChange={(e) => updateActiveProject((p) => ({ ...p, color: e.target.value }))}
                      className="h-7 w-12 rounded border border-slate-200 cursor-pointer"
                    />
                    <span className="font-mono text-slate-600">{activeProject.color}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-600 block mb-2">名刺纸张基底 (Stock)</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PAPER_STOCKS) as PaperStockId[]).map((pid) => {
                      const st = PAPER_STOCKS[pid];
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => updateActiveProject((p) => ({ ...p, paper: pid }))}
                          className={`text-left p-2.5 rounded-xl border text-xs cursor-pointer ${
                            activeProject.paper === pid
                              ? 'border-[#FF7600] bg-orange-50'
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className="font-bold text-slate-900 flex items-center justify-between">
                            <span>{st.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">{st.gsm}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'artwork' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
                  <input
                    ref={artInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleUploadArtwork(e.target.files?.[0])}
                  />
                  <p className="text-xs font-bold text-slate-800">上传个人头像、角色立绘或印章图案</p>
                  <p className="text-[11px] text-slate-500">支持透明底 PNG / JPG / WebP，纯本地持久化在浏览器缓存内</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => artInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg btn-brand text-xs font-bold cursor-pointer"
                    >
                      选择本地图片
                    </button>
                    {activeProject.standee.dataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveProject((p) => ({
                            ...p,
                            standee: { ...p.standee, enabled: false, dataUrl: '' },
                          }))
                        }
                        className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold cursor-pointer"
                      >
                        移除插画
                      </button>
                    )}
                  </div>
                </div>

                {activeProject.standee.dataUrl && (
                  <div className="space-y-3 text-xs">
                    <label className="flex items-center justify-between font-bold">
                      <span>在名片正面显示插画</span>
                      <input
                        type="checkbox"
                        checked={activeProject.standee.enabled}
                        onChange={(e) =>
                          updateActiveProject((p) => ({
                            ...p,
                            standee: { ...p.standee, enabled: e.target.checked },
                          }))
                        }
                      />
                    </label>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">适配模式</span>
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                        {(['contain', 'cover'] as const).map((fit) => (
                          <button
                            key={fit}
                            type="button"
                            onClick={() =>
                              updateActiveProject((p) => ({ ...p, standee: { ...p.standee, fit } }))
                            }
                            className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                              activeProject.standee.fit === fit ? 'bg-[#FF7600] text-white' : 'text-slate-600'
                            }`}
                          >
                            {fit === 'contain' ? '完整展示' : '铺满裁切'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <div className="flex justify-between font-bold text-slate-600">
                        <span>缩放比例</span>
                        <span>{activeProject.standee.scale}%</span>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={180}
                        value={activeProject.standee.scale}
                        onChange={(e) =>
                          updateActiveProject((p) => ({
                            ...p,
                            standee: { ...p.standee, scale: Number(e.target.value) },
                          }))
                        }
                        className="w-full accent-[#FF7600]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>水平偏移</span>
                          <span>{activeProject.standee.offsetX}%</span>
                        </div>
                        <input
                          type="range"
                          min={-60}
                          max={60}
                          value={activeProject.standee.offsetX}
                          onChange={(e) =>
                            updateActiveProject((p) => ({
                              ...p,
                              standee: { ...p.standee, offsetX: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-[#FF7600]"
                        />
                      </label>
                      <label className="block">
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>垂直偏移</span>
                          <span>{activeProject.standee.offsetY}%</span>
                        </div>
                        <input
                          type="range"
                          min={-60}
                          max={60}
                          value={activeProject.standee.offsetY}
                          onChange={(e) =>
                            updateActiveProject((p) => ({
                              ...p,
                              standee: { ...p.standee, offsetY: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-[#FF7600]"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>透明度</span>
                          <span>{activeProject.standee.opacity}%</span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={100}
                          value={activeProject.standee.opacity}
                          onChange={(e) =>
                            updateActiveProject((p) => ({
                              ...p,
                              standee: { ...p.standee, opacity: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-[#FF7600]"
                        />
                      </label>
                      <label className="block">
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>边框圆角</span>
                          <span>{activeProject.standee.radius}px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={32}
                          value={activeProject.standee.radius}
                          onChange={(e) =>
                            updateActiveProject((p) => ({
                              ...p,
                              standee: { ...p.standee, radius: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-[#FF7600]"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'craft' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  自由指定任意可编辑区域的实体表面工艺（3D WebGL 预览与 K100 专色制版均实时同步生效）
                </p>

                <div>
                  <span className="text-xs font-bold text-slate-600 block mb-1.5">1. 选择可编辑区域</span>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {EDITABLE_REGIONS.map((reg) => {
                      const assigned = activeProject.regionCrafts[reg.id] || 'none';
                      return (
                        <button
                          key={reg.id}
                          type="button"
                          onClick={() => setSelectedRegion(reg.id)}
                          className={`text-left px-2.5 py-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-1 ${
                            selectedRegion === reg.id
                              ? 'border-[#FF7600] bg-orange-50 text-slate-900 font-bold'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{reg.label}</span>
                          {assigned !== 'none' && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-mono shrink-0">
                              {SURFACE_CRAFTS[assigned].badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      2. 为「{EDITABLE_REGIONS.find((r) => r.id === selectedRegion)?.label}」选择材质
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = activeProject.regionCrafts[selectedRegion] || 'none';
                        const nextMap = { ...activeProject.regionCrafts };
                        EDITABLE_REGIONS.forEach((r) => {
                          if (r.id !== 'frontBg' && r.id !== 'backBg') nextMap[r.id] = cur;
                        });
                        updateActiveProject((p) => ({ ...p, regionCrafts: nextMap, craft: cur }));
                        showToast(`已将全部文字与装饰区域同步为「${SURFACE_CRAFTS[cur].name}」`, 'success');
                      }}
                      className="text-[11px] font-bold text-[#FF7600] hover:underline cursor-pointer"
                    >
                      应用到全部前景元素
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => {
                      const cm = SURFACE_CRAFTS[cid];
                      const active = (activeProject.regionCrafts[selectedRegion] || 'none') === cid;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() =>
                            updateActiveProject((p) => ({
                              ...p,
                              craft: selectedRegion === 'name' ? cid : p.craft,
                              regionCrafts: { ...p.regionCrafts, [selectedRegion]: cid },
                            }))
                          }
                          className={`p-2 rounded-xl border text-left cursor-pointer ${
                            active ? 'border-[#FF7600] bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900">{cm.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{cm.badge}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'canvas' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => addCanvasElement('text')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7600] text-xs font-bold cursor-pointer"
                  >
                    <Type className="w-3.5 h-3.5 text-[#FF7600]" />
                    + 文本
                  </button>
                  <button
                    type="button"
                    onClick={() => addCanvasElement('rect')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7600] text-xs font-bold cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 text-[#FF7600]" />
                    + 矩形块
                  </button>
                  <button
                    type="button"
                    onClick={() => addCanvasElement('circle')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7600] text-xs font-bold cursor-pointer"
                  >
                    + 圆形
                  </button>
                  <button
                    type="button"
                    onClick={() => addCanvasElement('pill')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7600] text-xs font-bold cursor-pointer"
                  >
                    + 胶囊条
                  </button>
                  <button
                    type="button"
                    onClick={() => addCanvasElement('qr')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7600] text-xs font-bold cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#FF7600]" />
                    + 副二维码
                  </button>
                </div>

                {currentSideEls.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-xl">
                    当前面暂无自定义图层，点击上方按钮自由添加叠加元素。
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      {currentSideEls.map((el) => (
                        <div
                          key={el.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                            activeCanvasEl?.id === el.id
                              ? 'border-[#FF7600] bg-orange-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedElId(el.id)}
                            className="font-bold text-slate-800 text-left flex-1 cursor-pointer truncate"
                          >
                            {el.label || el.type} {el.text ? `· ${el.text}` : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveProject((p) => ({
                                ...p,
                                customElements: p.customElements.filter((x) => x.id !== el.id),
                              }))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            aria-label="删除图层"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {activeCanvasEl && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                        {activeCanvasEl.type === 'text' && (
                          <label className="block">
                            <span className="font-bold text-slate-600">文本内容</span>
                            <input
                              type="text"
                              value={activeCanvasEl.text || ''}
                              onChange={(e) => updateCanvasEl(activeCanvasEl.id, { text: e.target.value })}
                              className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                            />
                          </label>
                        )}

                        <div className="grid grid-cols-4 gap-2">
                          <label className="block">
                            <span className="text-[11px] font-bold text-slate-500">X%</span>
                            <input
                              type="number"
                              value={activeCanvasEl.x}
                              onChange={(e) => updateCanvasEl(activeCanvasEl.id, { x: Number(e.target.value) })}
                              className="mt-0.5 w-full px-2 py-1 rounded border border-slate-200 bg-white"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold text-slate-500">Y%</span>
                            <input
                              type="number"
                              value={activeCanvasEl.y}
                              onChange={(e) => updateCanvasEl(activeCanvasEl.id, { y: Number(e.target.value) })}
                              className="mt-0.5 w-full px-2 py-1 rounded border border-slate-200 bg-white"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold text-slate-500">W%</span>
                            <input
                              type="number"
                              value={activeCanvasEl.w}
                              onChange={(e) => updateCanvasEl(activeCanvasEl.id, { w: Number(e.target.value) })}
                              className="mt-0.5 w-full px-2 py-1 rounded border border-slate-200 bg-white"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold text-slate-500">H%</span>
                            <input
                              type="number"
                              value={activeCanvasEl.h}
                              onChange={(e) => updateCanvasEl(activeCanvasEl.id, { h: Number(e.target.value) })}
                              className="mt-0.5 w-full px-2 py-1 rounded border border-slate-200 bg-white"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-[11px] font-bold text-slate-500">
                              旋转 ({activeCanvasEl.rotate || 0}°)
                            </span>
                            <input
                              type="range"
                              min={-45}
                              max={45}
                              value={activeCanvasEl.rotate || 0}
                              onChange={(e) =>
                                updateCanvasEl(activeCanvasEl.id, { rotate: Number(e.target.value) })
                              }
                              className="w-full accent-[#FF7600]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-bold text-slate-500">材质工艺</span>
                            <select
                              value={activeCanvasEl.craft || 'none'}
                              onChange={(e) =>
                                updateCanvasEl(activeCanvasEl.id, {
                                  craft: e.target.value as SurfaceCraftId,
                                })
                              }
                              className="mt-1 w-full px-2 py-1 rounded border border-slate-200 bg-white"
                            >
                              {(Object.keys(SURFACE_CRAFTS) as SurfaceCraftId[]).map((cid) => (
                                <option key={cid} value={cid}>
                                  {SURFACE_CRAFTS[cid].name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">6 向快捷对齐</span>
                          <div className="grid grid-cols-6 gap-1">
                            {[
                              ['left', AlignStartHorizontal],
                              ['cx', AlignCenterHorizontal],
                              ['right', AlignEndHorizontal],
                              ['top', AlignStartVertical],
                              ['cy', AlignCenterVertical],
                              ['bottom', AlignEndVertical],
                            ].map(([mode, Icon]) => {
                              const AlignIcon = Icon as typeof AlignStartHorizontal;
                              return (
                                <button
                                  key={String(mode)}
                                  type="button"
                                  onClick={() =>
                                    alignCanvasEl(mode as 'left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom')
                                  }
                                  className="p-1.5 rounded border border-slate-200 bg-white hover:border-[#FF7600] flex items-center justify-center cursor-pointer"
                                >
                                  <AlignIcon className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Live Interactive Preview Stage */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateActiveProject((p) => ({ ...p, side: p.side === 'front' ? 'back' : 'front' }))
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                <FlipHorizontal2 className="w-4 h-4 text-[#FF7600]" />
                {activeProject.side === 'front' ? '查看背面二维码' : '切换回正面'}
              </button>

              <button
                type="button"
                onClick={() => setShowGuides(!showGuides)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                  showGuides
                    ? 'border-[#FF7600] bg-orange-50 text-[#FF7600]'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                3mm 安全参考线
              </button>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
              {([0.85, 1, 1.15] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    zoom === z ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[380px] sm:min-h-[440px] rounded-2xl bg-slate-100/80 border border-slate-200 flex items-center justify-center p-6 sm:p-10 overflow-hidden">
            <div
              className={`transition-transform duration-200 ${
                activeProject.orient === 'v'
                  ? 'w-full max-w-[300px]'
                  : activeProject.orient === 's'
                    ? 'w-full max-w-[340px]'
                    : 'w-full max-w-[490px]'
              }`}
              style={{ transform: `scale(${zoom})` }}
            >
              <CardFaceView project={activeProject} template={tpl} showGuides={showGuides} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              当前规格：{CARD_SPECS[activeProject.spec]?.name} · {PAPER_STOCKS[activeProject.paper].name} (
              {PAPER_STOCKS[activeProject.paper].gsm})
            </span>
            <span className="text-emerald-700 font-semibold">所有编辑变更已自动持久化至本地浏览器</span>
          </div>
        </section>
      </div>

      {/* 3D Modal */}
      {show3DModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl leaf-card border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">WebGL 物理材质 3D 实时审样</h2>
                <p className="text-xs text-slate-500">
                  支持拖拽 360° 翻转观察真实卡纸厚度、表面工艺与纸基纹理（已去除人工扫光反光）
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShow3DModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                aria-label="关闭 3D 预览"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <CardPreview3D project={activeProject} template={tpl} heightClass="h-[460px]" />
            </div>
          </div>
        </div>
      )}

      {/* Save New Template Modal */}
      {showSaveTplModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md leaf-card border border-slate-200 p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">保存为可复用自定义模板</h2>
            <p className="text-xs text-slate-500">
              将当前版式、配色、纸张、各区域材质与文字排版存为新模板，保存在本地模板库中并可导出 `.ichiban-template.json` 分享。
            </p>
            <label className="block text-sm">
              <span className="text-xs font-bold text-slate-600">模板名称 *</span>
              <input
                type="text"
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-bold text-slate-600">模板说明（选填）</span>
              <input
                type="text"
                value={newTplDesc}
                onChange={(e) => setNewTplDesc(e.target.value)}
                placeholder="例如：黑卡哑金展位专用版本"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveTplModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const saved = saveCurrentAsNewTemplate(newTplName, newTplDesc);
                  setShowSaveTplModal(false);
                  showToast(`已保存新自定义模板「${saved.name}」`, 'success');
                }}
                className="px-4 py-2 rounded-lg btn-brand text-xs font-bold cursor-pointer"
              >
                确认保存到本地
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

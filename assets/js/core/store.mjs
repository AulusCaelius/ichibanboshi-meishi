/**
 * 一番星 · 制作人名片设计平台 (v1.0) 状态与持久层
 * 整合 IndexedDB（大容积本地存储）+ Node/SQLite 云端同步 + 50 步撤销栈 + 工程文件导入导出
 */

import { IDOLS, TEMPLATES } from './catalog.mjs';
import {
  idbGetAllWorks,
  idbPutWork,
  idbDeleteWork,
  idbGetCustomTemplates,
  idbPutCustomTemplate,
  idbGetMeta,
  idbSetMeta
} from './idb.mjs';
import {
  detectServerMode,
  isServerConnected,
  apiMe,
  apiListWorks,
  apiSaveWork,
  apiSyncWorks,
  apiDeleteWork,
  apiGetCustomTemplates,
  apiSaveCustomTemplate,
  apiGetFavorites,
  apiToggleFavorite,
  apiRecordCardEvent
} from './api-client.mjs';

const STORAGE_KEY = 'ichiban:v1:project';
const PREFILL_KEY = 'ichiban:v1:prefill';
const WORKS_KEY = 'ichiban:v1:works';
const USER_KEY = 'ichiban:v1:user';
const FAVS_KEY = 'ichiban:v1:favorites';
const CUSTOM_TPLS_KEY = 'ichiban:v1:custom_templates';

export const SPECS = {
  cn: { label: '国内 90×54', w: 90, h: 54 },
  jp: { label: '日本 91×55', w: 91, h: 55 },
  eu: { label: '欧洲 85×55', w: 85, h: 55 },
  us: { label: '美国 89×51', w: 89, h: 51 },
  sq54: { label: '方形 54×54', w: 54, h: 54 },
  sq65: { label: '方形 65×65', w: 65, h: 65 }
};

export const MATERIALS = {
  matte: { id: 'matte', label: '哑光铜版纸', edge: '#F4F1EA' },
  cotton: { id: 'cotton', label: '手工质感棉纸', edge: '#F3EEE3' },
  pearl: { id: 'pearl', label: '云母珠光纸', edge: '#EDE7F6' },
  black: { id: 'black', label: '深邃黑卡', edge: '#16171C' },
  washi: { id: 'washi', label: '越前和纸', edge: '#EFE6D5' },
  pvc: { id: 'pvc', label: '磨砂半透 PVC', edge: 'rgba(223, 246, 255, 0.72)' }
};

export const SURFACE_MATERIALS = {
  none: { id: 'none', label: '原纸直印', swatch: '#FFFFFF' },
  gold: { id: 'gold', label: '缎面烫金', swatch: '#C59B2E' },
  silver: { id: 'silver', label: '哑光烫银', swatch: '#9AA3B0' },
  copper: { id: 'copper', label: '赤铜烫印', swatch: '#B5673F' },
  emboss: { id: 'emboss', label: '击凸浮雕', swatch: '#EBE8E0' },
  deboss: { id: 'deboss', label: '活字压凹', swatch: '#D6D2C8' },
  uv: { id: 'uv', label: '立体厚墨', swatch: '#3B3D44' },
  velvet: { id: 'velvet', label: '丝绒触感', swatch: '#5B4E5C' },
  brushed: { id: 'brushed', label: '拉丝金属', swatch: '#8E959F' }
};

export const CRAFTS = {
  gold: { id: 'gold', label: '缎面烫金' },
  silver: { id: 'silver', label: '哑光烫银' },
  copper: { id: 'copper', label: '赤铜烫印' },
  emboss: { id: 'emboss', label: '击凸浮雕' },
  deboss: { id: 'deboss', label: '活字压凹' },
  uv: { id: 'uv', label: '立体厚墨' },
  velvet: { id: 'velvet', label: '丝绒触感' },
  brushed: { id: 'brushed', label: '拉丝金属' }
};

export const EDITABLE_REGIONS = [
  { id: 'frontBg', side: 'front', kind: 'stock', label: '正面卡底' },
  { id: 'decor', side: 'front', kind: 'surface', label: '立绘与装饰' },
  { id: 'name', side: 'front', kind: 'surface', label: 'P 名（姓名）' },
  { id: 'enName', side: 'front', kind: 'surface', label: '英文名' },
  { id: 'title', side: 'front', kind: 'surface', label: '担当职位' },
  { id: 'company', side: 'front', kind: 'surface', label: '所属事务所' },
  { id: 'pid', side: 'front', kind: 'surface', label: '游戏 P-ID' },
  { id: 'eventTag', side: 'front', kind: 'surface', label: '参战活动印记' },
  { id: 'x', side: 'front', kind: 'surface', label: 'X (Twitter)' },
  { id: 'weibo', side: 'front', kind: 'surface', label: '微博' },
  { id: 'bilibili', side: 'front', kind: 'surface', label: 'B站 UID' },
  { id: 'xhs', side: 'front', kind: 'surface', label: '小红书' },
  { id: 'favSong', side: 'front', kind: 'surface', label: '喜欢的曲' },
  { id: 'backBg', side: 'back', kind: 'stock', label: '背面卡底' },
  { id: 'backJp', side: 'back', kind: 'surface', label: '背面主标语' },
  { id: 'qr', side: 'back', kind: 'surface', label: '动态二维码' }
];

export const PATTERN_TEXTURES = [
  { id: 'none', label: '无纹理' },
  { id: 'dots', label: '波点星尘' },
  { id: 'stripes', label: '学园斜纹' },
  { id: 'stars', label: '一番星芒' },
  { id: 'grain', label: '质感噪点' }
];

const memoryCache = {
  hydrated: false,
  works: null,
  customTemplates: [],
  favorites: new Set(),
  user: null,
  serverOnline: false
};

export function defaultRegionMaterials() {
  return {
    decor: 'none',
    name: 'none',
    enName: 'none',
    title: 'none',
    company: 'none',
    pid: 'none',
    eventTag: 'none',
    x: 'none',
    weibo: 'none',
    bilibili: 'none',
    xhs: 'none',
    favSong: 'none',
    backJp: 'none',
    qr: 'none'
  };
}

export function uid() {
  return 'el_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

export function workUid() {
  return 'wk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export function formatTime(ts) {
  const d = new Date(ts || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getCustomTemplates() {
  if (memoryCache.customTemplates && memoryCache.customTemplates.length) {
    return memoryCache.customTemplates;
  }
  try {
    const raw = localStorage.getItem(CUSTOM_TPLS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        memoryCache.customTemplates = list;
        return list;
      }
    }
  } catch {}
  return [];
}

export function getAllTemplates() {
  const custom = getCustomTemplates();
  return [...custom, ...TEMPLATES];
}

export function getTemplate(id) {
  const cleanId = String(id || 'T12');
  const all = getAllTemplates();
  return (
    all.find((t) => t.id === cleanId) ||
    all.find((t) => t.id === cleanId.split('-')[0]) ||
    TEMPLATES.find((t) => t.id === 'T12') ||
    TEMPLATES[0]
  );
}

export function matchIdol(titleStr) {
  const val = String(titleStr || '');
  const found = IDOLS.find((i) => val.includes(i.name));
  return found ? found.name : '';
}

export function getDims(project) {
  const spec = SPECS[project && project.spec] || SPECS.cn;
  if (project && (project.spec === 'sq54' || project.spec === 'sq65')) {
    return { w: spec.w, h: spec.h };
  }
  const t = getTemplate(project && project.templateId);
  if (t && t.orient === 'v') {
    return { w: spec.h, h: spec.w };
  }
  return { w: spec.w, h: spec.h };
}

export function ptFromCqw(cqw, dims) {
  const w = (dims && dims.w) || 90;
  return Number((((cqw / 100) * w) / 0.3528).toFixed(1));
}

export function cqwFromPt(pt, dims) {
  const w = (dims && dims.w) || 90;
  return Number((((pt * 0.3528) / w) * 100).toFixed(2));
}

export function getEffectiveSides(project) {
  if (project && (project.sides === 1 || project.sides === 2)) return project.sides;
  const t = getTemplate(project && project.templateId);
  return t && t.sides === 1 ? 1 : 2;
}

export function createFromTemplate(t, prefill, opts) {
  const tpl = t || getTemplate('T12');
  const p = prefill || {};
  const fields = {
    name: (p.name && p.name.trim()) || '制作人Producer',
    enName: '',
    title: (p.title && p.title.trim()) || '〇〇担当',
    company: (p.company && p.company.trim()) || '初星学園',
    pid: '',
    eventTag: '',
    x: '@hatsuboshi_p',
    weibo: '',
    bilibili: '',
    xhs: '',
    favSong: '',
    backTitle: tpl.jp || '',
    backSub: `${tpl.craft || '标准工艺'} · ${tpl.layoutLabel || '双面名刺'}`,
    qrMode: 'h5',
    qrCustomUrl: '',
    qr: true
  };
  const accent = (p.accent && p.accent.trim()) || tpl.color;
  const tantouIdol = matchIdol(fields.title);
  const spec = tpl.orient === 's' ? 'sq54' : 'cn';
  const defaultStats = (opts && opts.stats) || {
    pv: 0,
    saves: 0,
    trend: [0, 0, 0, 0, 0, 0, 0]
  };

  return {
    id: (opts && opts.id) || workUid(),
    version: 2,
    fileName: (opts && opts.fileName) || `${fields.name}_名刺方案`,
    templateId: tpl.id,
    sides: tpl.sides === 1 ? 1 : 2,
    mode: tpl.canvasSeed ? 'canvas' : 'form',
    side: 'front',
    fields,
    accent,
    tantouIdol,
    spec,
    corner: 0,
    pattern: 'none',
    strokeMinPt: 0.25,
    guides: { bleed: true, trim: true, safe: true },
    material: 'matte',
    sideMaterials: { front: 'inherit', back: 'inherit' },
    regionMaterials: { ...defaultRegionMaterials(), ...(tpl.regionMaterials || {}) },
    standee: tpl.standee ? JSON.parse(JSON.stringify(tpl.standee)) : { dataUrl: '', scale: 1, offsetX: 0, offsetY: 0 },
    crafts: { gold: false, silver: false, copper: false, emboss: false, deboss: false, uv: false, velvet: false, brushed: false },
    canvas: tpl.canvasSeed ? JSON.parse(JSON.stringify(tpl.canvasSeed)) : { front: null, back: null },
    savedCanvas: null,
    images: tpl.images ? JSON.parse(JSON.stringify(tpl.images)) : [],
    h5: {
      layout: 'card',
      bio: '',
      show: { x: true, weibo: true, bilibili: true, xhs: true },
      slug: (opts && opts.slug) || 'hatsuboshi-p'
    },
    export: {
      format: 'pdf',
      color: 'cmyk',
      dpi: 300,
      bleed: 3,
      cropMarks: true,
      text: 'outline',
      spot: false,
      autoK100Text: false,
      ignoreRisk: false
    },
    stats: defaultStats,
    updatedAt: Date.now()
  };
}

export function syncCraftsSummary(project) {
  if (!project) return;
  const active = {};
  Object.keys(CRAFTS).forEach((k) => {
    active[k] = false;
  });
  if (project.regionMaterials) {
    Object.values(project.regionMaterials).forEach((m) => {
      if (m && m !== 'none' && m in active) active[m] = true;
    });
  }
  if (project.canvas) {
    ['front', 'back'].forEach((side) => {
      if (Array.isArray(project.canvas[side])) {
        project.canvas[side].forEach((el) => {
          if (el && el.visible !== false && el.craft && el.craft !== 'none' && el.craft in active) {
            active[el.craft] = true;
          }
        });
      }
    });
  }
  project.crafts = active;
}

export function ensureProjectMeta(project) {
  if (!project || typeof project !== 'object') return project;
  if (!project.id) project.id = workUid();
  if (!project.version) project.version = 2;
  const tpl = getTemplate(project.templateId);
  if (project.sides !== 1 && project.sides !== 2) {
    project.sides = tpl && tpl.sides === 1 ? 1 : 2;
  }
  if (!project.sideMaterials || typeof project.sideMaterials !== 'object') {
    project.sideMaterials = { front: 'inherit', back: 'inherit' };
  }
  const baseRegions = defaultRegionMaterials();
  project.regionMaterials = { ...baseRegions, ...(project.regionMaterials || {}) };
  if (!project.fields || typeof project.fields !== 'object') project.fields = {};
  if (project.fields.backTitle === undefined) project.fields.backTitle = (tpl && tpl.jp) || '';
  if (project.fields.backSub === undefined) project.fields.backSub = tpl ? `${tpl.craft} · ${tpl.layoutLabel}` : '';
  if (!project.fields.qrMode) project.fields.qrMode = 'h5';
  if (!project.standee || typeof project.standee !== 'object') {
    project.standee = { dataUrl: '', scale: 1, offsetX: 0, offsetY: 0 };
  }
  if (!project.h5) {
    project.h5 = { layout: 'card', bio: '', show: { x: true, weibo: true, bilibili: true, xhs: true }, slug: 'hatsuboshi-p' };
  }
  if (!project.h5.slug) project.h5.slug = 'hatsuboshi-p';
  if (!project.export) {
    project.export = {
      format: 'pdf',
      color: 'cmyk',
      dpi: 300,
      bleed: 3,
      cropMarks: true,
      text: 'outline',
      spot: false,
      autoK100Text: false,
      ignoreRisk: false
    };
  }
  if (!project.stats || typeof project.stats !== 'object') {
    project.stats = { pv: 0, saves: 0, trend: [0, 0, 0, 0, 0, 0, 0] };
  }
  if (!Array.isArray(project.stats.trend) || project.stats.trend.length !== 7) {
    project.stats.trend = [0, 0, 0, 0, 0, 0, 0];
  }
  if (!project.updatedAt) project.updatedAt = Date.now();
  return project;
}

function writeLocalSafe(key, val) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Fallback strips large inline base64 images for localStorage cache if IndexedDB handles full blobs
  }
}

function readLocalSafe(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function load() {
  const parsed = readLocalSafe(STORAGE_KEY);
  if (parsed && parsed.templateId) {
    return ensureProjectMeta(parsed);
  }
  return null;
}

function writeWorksCache(works) {
  memoryCache.works = works;
  writeLocalSafe(WORKS_KEY, works);
}

function makeUniqueSlug(baseSlug, works) {
  const cleanBase = String(baseSlug || 'hatsuboshi-p').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'hatsuboshi-p';
  const existing = new Set((works || []).map((w) => w.h5 && w.h5.slug));
  if (!existing.has(cleanBase)) return cleanBase;
  let idx = 2;
  while (existing.has(`${cleanBase}-${idx}`)) idx += 1;
  return `${cleanBase}-${idx}`;
}

export function listWorks() {
  if (Array.isArray(memoryCache.works) && memoryCache.works.length) {
    return [...memoryCache.works].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  let works = readLocalSafe(WORKS_KEY);
  if (!Array.isArray(works) || works.length === 0) {
    const cur = load();
    const initial = cur || createFromTemplate(getTemplate('T12'), readPrefill());
    works = [ensureProjectMeta(initial)];
    writeWorksCache(works);
  } else {
    works = works.map(ensureProjectMeta);
    memoryCache.works = works;
  }
  return [...works].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function hydrateFromStorage() {
  const serverOk = await detectServerMode();
  memoryCache.serverOnline = serverOk;

  // Hydrate favorites & custom templates
  const localFavs = readLocalSafe(FAVS_KEY);
  if (Array.isArray(localFavs)) {
    memoryCache.favorites = new Set(localFavs);
  }

  const idbTpls = await idbGetCustomTemplates();
  if (Array.isArray(idbTpls) && idbTpls.length) {
    memoryCache.customTemplates = idbTpls;
    writeLocalSafe(CUSTOM_TPLS_KEY, idbTpls);
  }

  // Hydrate works from IndexedDB first
  const idbWorks = await idbGetAllWorks();
  if (Array.isArray(idbWorks) && idbWorks.length > 0) {
    memoryCache.works = idbWorks.map(ensureProjectMeta);
    const activeId = await idbGetMeta('activeWorkId');
    if (activeId) {
      const active = memoryCache.works.find((w) => w.id === activeId);
      if (active) writeLocalSafe(STORAGE_KEY, active);
    }
  } else {
    const seeded = listWorks();
    for (const w of seeded) {
      await idbPutWork(w);
    }
  }

  // If server connected, merge auth & cloud state
  if (serverOk) {
    const user = await apiMe();
    if (user) {
      memoryCache.user = user;
      writeLocalSafe(USER_KEY, user);
    }
    const cloudWorks = await apiListWorks();
    if (Array.isArray(cloudWorks) && cloudWorks.length > 0) {
      const mergedMap = new Map();
      (memoryCache.works || []).forEach((w) => mergedMap.set(w.id, ensureProjectMeta(w)));
      cloudWorks.forEach((cw) => {
        const clean = ensureProjectMeta(cw);
        const local = mergedMap.get(clean.id);
        if (!local || (clean.updatedAt || 0) >= (local.updatedAt || 0)) {
          mergedMap.set(clean.id, clean);
        }
      });
      const merged = Array.from(mergedMap.values());
      writeWorksCache(merged);
      for (const w of merged) await idbPutWork(w);
    }
    const cloudTpls = await apiGetCustomTemplates();
    if (Array.isArray(cloudTpls) && cloudTpls.length > 0) {
      const map = new Map(memoryCache.customTemplates.map((t) => [t.id, t]));
      cloudTpls.forEach((t) => map.set(t.id, t));
      memoryCache.customTemplates = Array.from(map.values());
      writeLocalSafe(CUSTOM_TPLS_KEY, memoryCache.customTemplates);
    }
    const cloudFavs = await apiGetFavorites();
    if (Array.isArray(cloudFavs)) {
      cloudFavs.forEach((id) => memoryCache.favorites.add(id));
      writeLocalSafe(FAVS_KEY, Array.from(memoryCache.favorites));
    }
  }

  memoryCache.hydrated = true;
  return { serverOnline: serverOk, user: memoryCache.user };
}

export function save(project) {
  if (!project) return formatTime(Date.now());
  ensureProjectMeta(project);
  syncCraftsSummary(project);
  project.updatedAt = Date.now();

  writeLocalSafe(STORAGE_KEY, project);
  const works = listWorks();
  const idx = works.findIndex((w) => w.id === project.id);
  const copy = JSON.parse(JSON.stringify(project));
  if (idx >= 0) works[idx] = copy;
  else works.unshift(copy);
  writeWorksCache(works);

  // Async mirror to IndexedDB + SQLite server
  idbPutWork(copy);
  idbSetMeta('activeWorkId', copy.id);
  if (isServerConnected()) {
    apiSaveWork(copy).then((saved) => {
      if (saved && saved.h5 && saved.h5.slug) {
        copy.h5.slug = saved.h5.slug;
      }
    });
  }

  return formatTime(project.updatedAt);
}

export function getActiveId() {
  const cur = load();
  if (cur) return cur.id;
  const works = listWorks();
  return works[0] ? works[0].id : null;
}

export function setActiveWork(id) {
  const works = listWorks();
  const found = works.find((w) => w.id === id);
  if (!found) return null;
  const copy = JSON.parse(JSON.stringify(found));
  writeLocalSafe(STORAGE_KEY, copy);
  idbSetMeta('activeWorkId', copy.id);
  return copy;
}

export function createNewWork(tplId, prefill) {
  const works = listWorks();
  const tpl = getTemplate(tplId || 'T12');
  const p = prefill || readPrefill() || {};
  const slug = makeUniqueSlug('hatsuboshi-p', works);
  const proj = createFromTemplate(tpl, p, { slug });
  save(proj);
  return proj;
}

export function duplicateWork(id) {
  const works = listWorks();
  const src = works.find((w) => w.id === id);
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = workUid();
  copy.fileName = `${src.fileName || '未命名名刺'} (副本)`;
  copy.h5 = copy.h5 || {};
  copy.h5.slug = makeUniqueSlug(copy.h5.slug || 'hatsuboshi-p', works);
  copy.stats = { pv: 0, saves: 0, trend: [0, 0, 0, 0, 0, 0, 0] };
  copy.updatedAt = Date.now();
  works.unshift(copy);
  writeWorksCache(works);
  idbPutWork(copy);
  if (isServerConnected()) apiSaveWork(copy);
  return copy;
}

export function renameWork(id, newName) {
  const clean = String(newName || '').trim();
  if (!clean) return false;
  const works = listWorks();
  const target = works.find((w) => w.id === id);
  if (!target) return false;
  target.fileName = clean;
  target.updatedAt = Date.now();
  writeWorksCache(works);
  idbPutWork(target);
  const active = load();
  if (active && active.id === id) {
    active.fileName = clean;
    active.updatedAt = target.updatedAt;
    writeLocalSafe(STORAGE_KEY, active);
  }
  if (isServerConnected()) apiSaveWork(target);
  return true;
}

export function deleteWork(id) {
  const works = listWorks();
  const next = works.filter((w) => w.id !== id);
  writeWorksCache(next);
  idbDeleteWork(id);
  const active = load();
  if (active && active.id === id) {
    if (next.length > 0) writeLocalSafe(STORAGE_KEY, next[0]);
    else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }
  if (isServerConnected()) apiDeleteWork(id);
  return next;
}

export function importWorkJson(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object' || !parsed.templateId) {
    throw new Error('无效的 .ichiban.json 名片工程文件');
  }
  const works = listWorks();
  const imported = ensureProjectMeta(parsed);
  imported.id = workUid();
  imported.fileName = `${imported.fileName || '导入名刺'} (导入)`;
  imported.h5 = imported.h5 || {};
  imported.h5.slug = makeUniqueSlug(imported.h5.slug || 'hatsuboshi-p', works);
  imported.updatedAt = Date.now();
  works.unshift(imported);
  writeWorksCache(works);
  idbPutWork(imported);
  if (isServerConnected()) apiSaveWork(imported);
  return imported;
}

export async function saveProjectAsTemplate(project, templateName) {
  const baseTpl = getTemplate(project.templateId);
  const id = 'CT_' + Date.now().toString(36).slice(-5).toUpperCase();
  const customTpl = {
    id,
    name: String(templateName || `${project.fileName || baseTpl.name} · 我的模板`).slice(0, 36),
    jp: (project.fields && project.fields.backTitle) || baseTpl.jp,
    idol: project.tantouIdol || baseTpl.idol,
    initial: (project.fields && project.fields.name ? project.fields.name.slice(0, 1) : baseTpl.initial),
    color: project.accent || baseTpl.color,
    persona: '制作人自定义模板',
    inspiration: `保存自作品「${project.fileName || '未命名方案'}」`,
    style: baseTpl.style,
    styleLabel: baseTpl.styleLabel,
    orient: project.spec && project.spec.startsWith('sq') ? 's' : baseTpl.orient,
    sides: getEffectiveSides(project),
    layoutLabel: getEffectiveSides(project) === 1 ? '单面自定义' : '双面自定义',
    craft: (CRAFTS[project.regionMaterials && project.regionMaterials.name] || { label: baseTpl.craft }).label,
    badges: ['自定义'],
    isCustom: true,
    regionMaterials: JSON.parse(JSON.stringify(project.regionMaterials || {})),
    standee: project.standee ? JSON.parse(JSON.stringify(project.standee)) : undefined,
    canvasSeed: project.mode === 'canvas' && project.canvas ? JSON.parse(JSON.stringify(project.canvas)) : null,
    images: project.images ? JSON.parse(JSON.stringify(project.images)) : []
  };

  const list = getCustomTemplates();
  const next = [customTpl, ...list];
  memoryCache.customTemplates = next;
  writeLocalSafe(CUSTOM_TPLS_KEY, next);
  await idbPutCustomTemplate(customTpl);
  if (isServerConnected()) {
    await apiSaveCustomTemplate(customTpl);
  }
  return customTpl;
}

export function getFavorites() {
  if (memoryCache.favorites.size > 0) return Array.from(memoryCache.favorites);
  const saved = readLocalSafe(FAVS_KEY);
  if (Array.isArray(saved)) {
    memoryCache.favorites = new Set(saved);
    return saved;
  }
  return [];
}

export function isFavorite(tplId) {
  getFavorites();
  return memoryCache.favorites.has(tplId);
}

export function toggleFavorite(tplId) {
  getFavorites();
  const next = !memoryCache.favorites.has(tplId);
  if (next) memoryCache.favorites.add(tplId);
  else memoryCache.favorites.delete(tplId);
  writeLocalSafe(FAVS_KEY, Array.from(memoryCache.favorites));
  if (isServerConnected()) apiToggleFavorite(tplId);
  return next;
}

export function findWorkBySlug(slugOrId) {
  const q = String(slugOrId || '').trim();
  const works = listWorks();
  if (q) {
    const byId = works.find((w) => w.id === q);
    if (byId) return JSON.parse(JSON.stringify(byId));
    const bySlug = works.find((w) => w.h5 && w.h5.slug === q);
    if (bySlug) return JSON.parse(JSON.stringify(bySlug));
  }
  const active = load();
  if (active) return active;
  return works[0] ? JSON.parse(JSON.stringify(works[0])) : createFromTemplate(getTemplate('T12'), readPrefill());
}

export async function recordAnalytics(idOrSlug, type) {
  if (isServerConnected()) {
    const serverStats = await apiRecordCardEvent(idOrSlug, type);
    if (serverStats) {
      const works = listWorks();
      const target = works.find((w) => w.id === idOrSlug || (w.h5 && w.h5.slug === idOrSlug));
      if (target) {
        target.stats = serverStats;
        writeWorksCache(works);
        idbPutWork(target);
      }
      return serverStats;
    }
  }

  const works = listWorks();
  const target = works.find((w) => w.id === idOrSlug || (w.h5 && w.h5.slug === idOrSlug));
  if (!target) return null;
  ensureProjectMeta(target);
  if (type === 'pv') {
    target.stats.pv += 1;
    target.stats.trend[6] = (target.stats.trend[6] || 0) + 1;
  } else if (type === 'save') {
    target.stats.saves += 1;
  }
  writeWorksCache(works);
  idbPutWork(target);
  const active = load();
  if (active && active.id === target.id) {
    active.stats = JSON.parse(JSON.stringify(target.stats));
    writeLocalSafe(STORAGE_KEY, active);
  }
  return target.stats;
}

export function getUser() {
  if (memoryCache.user && memoryCache.user.name) return memoryCache.user;
  const u = readLocalSafe(USER_KEY);
  return u && u.name ? u : null;
}

export function setLocalUser(user) {
  if (!user || !user.name) return null;
  const payload = {
    id: user.id || undefined,
    username: user.username || undefined,
    name: String(user.name).trim(),
    idol: String(user.idol || '').trim(),
    color: String(user.color || '#FF7600').trim(),
    company: String(user.company || '初星学園').trim(),
    loggedInAt: Date.now()
  };
  memoryCache.user = payload;
  writeLocalSafe(USER_KEY, payload);
  writeLocalSafe(PREFILL_KEY, {
    name: payload.name,
    title: payload.idol ? `${payload.idol}担当` : '',
    company: payload.company,
    accent: payload.color
  });
  return payload;
}

export async function syncLocalWorksToCloud() {
  if (!isServerConnected()) return;
  const local = listWorks();
  const synced = await apiSyncWorks(local);
  if (Array.isArray(synced)) {
    const clean = synced.map(ensureProjectMeta);
    writeWorksCache(clean);
    for (const w of clean) await idbPutWork(w);
  }
}

export function logoutUserLocal() {
  memoryCache.user = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
  }
}

export function readPrefill() {
  return readLocalSafe(PREFILL_KEY);
}

export function writePrefill(data) {
  if (!data) {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(PREFILL_KEY);
      } catch {}
    }
    return;
  }
  writeLocalSafe(PREFILL_KEY, data);
}

export function initProject() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const workParam = params.get('work');
  const tplParam = params.get('template') || params.get('tpl');
  const isNew = params.get('new') === '1';
  const prefill = readPrefill();

  if (workParam) {
    const switched = setActiveWork(workParam);
    if (switched) {
      params.delete('work');
      const qs = params.toString();
      const nextUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      try {
        window.history.replaceState(null, '', nextUrl);
      } catch {}
      return switched;
    }
  }

  if (tplParam && isNew) {
    const proj = createNewWork(tplParam, prefill);
    params.delete('new');
    const qs = params.toString();
    const nextUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    try {
      window.history.replaceState(null, '', nextUrl);
    } catch {}
    return proj;
  }

  const existing = load();
  if (existing) {
    if (tplParam && existing.templateId !== tplParam) {
      return createNewWork(tplParam, prefill);
    }
    return existing;
  }

  const works = listWorks();
  if (works.length > 0 && !tplParam) {
    const first = JSON.parse(JSON.stringify(works[0]));
    writeLocalSafe(STORAGE_KEY, first);
    return first;
  }

  return createNewWork(tplParam || 'T12', prefill);
}

const MAX_HISTORY = 50;
let stack = [];
let pointer = -1;
let activeHistWorkId = null;

function persistHistory() {
  if (!activeHistWorkId || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`ichiban:v1:hist:${activeHistWorkId}`, JSON.stringify({ stack, pointer }));
  } catch {
    try {
      const tailStart = Math.max(0, stack.length - 8);
      const trimmedStack = stack.slice(tailStart);
      const trimmedPointer = Math.max(0, pointer - tailStart);
      sessionStorage.setItem(
        `ichiban:v1:hist:${activeHistWorkId}`,
        JSON.stringify({ stack: trimmedStack, pointer: trimmedPointer })
      );
    } catch {}
  }
}

export const history = {
  reset(project) {
    activeHistWorkId = (project && project.id) || 'default';
    stack = [JSON.stringify(project)];
    pointer = 0;
    persistHistory();
  },
  restoreOrInit(project) {
    activeHistWorkId = (project && project.id) || 'default';
    if (typeof sessionStorage !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(`ichiban:v1:hist:${activeHistWorkId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.stack) && parsed.stack.length > 0 && typeof parsed.pointer === 'number') {
            stack = parsed.stack;
            pointer = Math.max(0, Math.min(stack.length - 1, parsed.pointer));
            return;
          }
        }
      } catch {}
    }
    this.reset(project);
  },
  push(project) {
    if (project && project.id) activeHistWorkId = project.id;
    const snap = JSON.stringify(project);
    if (pointer >= 0 && stack[pointer] === snap) return;
    stack = stack.slice(0, pointer + 1);
    stack.push(snap);
    if (stack.length > MAX_HISTORY) stack.shift();
    pointer = stack.length - 1;
    persistHistory();
  },
  undo() {
    if (pointer <= 0) return null;
    pointer -= 1;
    persistHistory();
    return JSON.parse(stack[pointer]);
  },
  redo() {
    if (pointer >= stack.length - 1) return null;
    pointer += 1;
    persistHistory();
    return JSON.parse(stack[pointer]);
  },
  get canUndo() {
    return pointer > 0;
  },
  get canRedo() {
    return pointer >= 0 && pointer < stack.length - 1;
  }
};

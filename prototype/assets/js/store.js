/* ==========================================================
   项目状态管理、多作品库、用户身份与历史记录 (window.IchibanStore)
   ========================================================== */

window.IchibanStore = (function () {
  const STORAGE_KEY = 'ichiban:project';
  const PREFILL_KEY = 'ichiban:prefill';
  const WORKS_KEY = 'ichiban:works';
  const WORKS_SEEDED_KEY = 'ichiban:works_seeded';
  const USER_KEY = 'ichiban:user';

  const SPECS = {
    cn: { label: '国内 90×54', w: 90, h: 54 },
    jp: { label: '日本 91×55', w: 91, h: 55 },
    eu: { label: '欧洲 85×55', w: 85, h: 55 },
    us: { label: '美国 89×51', w: 89, h: 51 },
    sq54: { label: '方形 54×54', w: 54, h: 54 },
    sq65: { label: '方形 65×65', w: 65, h: 65 }
  };

  const MATERIALS = {
    matte: { id: 'matte', label: '哑光铜版纸', edge: '#F4F1EA' },
    cotton: { id: 'cotton', label: '手工质感棉纸', edge: '#F3EEE3' },
    pearl: { id: 'pearl', label: '云母珠光纸', edge: '#EDE7F6' },
    black: { id: 'black', label: '深邃黑卡', edge: '#16171C' },
    washi: { id: 'washi', label: '越前和纸', edge: '#EFE6D5' },
    pvc: { id: 'pvc', label: '磨砂半透 PVC', edge: 'rgba(223, 246, 255, 0.72)' }
  };

  const SURFACE_MATERIALS = {
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

  const CRAFTS = {
    gold: { id: 'gold', label: '缎面烫金' },
    silver: { id: 'silver', label: '哑光烫银' },
    copper: { id: 'copper', label: '赤铜烫印' },
    emboss: { id: 'emboss', label: '击凸浮雕' },
    deboss: { id: 'deboss', label: '活字压凹' },
    uv: { id: 'uv', label: '立体厚墨' },
    velvet: { id: 'velvet', label: '丝绒触感' },
    brushed: { id: 'brushed', label: '拉丝金属' }
  };

  const EDITABLE_REGIONS = [
    { id: 'frontBg', side: 'front', kind: 'stock', label: '正面卡底' },
    { id: 'decor', side: 'front', kind: 'surface', label: '立绘与装饰' },
    { id: 'name', side: 'front', kind: 'surface', label: 'P 名（姓名）' },
    { id: 'enName', side: 'front', kind: 'surface', label: '英文名' },
    { id: 'title', side: 'front', kind: 'surface', label: '担当职位' },
    { id: 'company', side: 'front', kind: 'surface', label: '所属事务所' },
    { id: 'x', side: 'front', kind: 'surface', label: 'X (Twitter)' },
    { id: 'weibo', side: 'front', kind: 'surface', label: '微博' },
    { id: 'bilibili', side: 'front', kind: 'surface', label: 'B站 UID' },
    { id: 'xhs', side: 'front', kind: 'surface', label: '小红书' },
    { id: 'favSong', side: 'front', kind: 'surface', label: '喜欢的曲' },
    { id: 'backBg', side: 'back', kind: 'stock', label: '背面卡底' },
    { id: 'backJp', side: 'back', kind: 'surface', label: '背面副标' },
    { id: 'qr', side: 'back', kind: 'surface', label: '动态二维码' }
  ];

  function defaultRegionMaterials() {
    return {
      decor: 'none',
      name: 'none',
      enName: 'none',
      title: 'none',
      company: 'none',
      x: 'none',
      weibo: 'none',
      bilibili: 'none',
      xhs: 'none',
      favSong: 'none',
      backJp: 'none',
      qr: 'none'
    };
  }

  function getDataRef() {
    return window.IchibanData || { IDOLS: [], TEMPLATES: [] };
  }

  function getTemplate(id) {
    const { TEMPLATES } = getDataRef();
    const cleanId = String(id || 'T12').split('-')[0];
    return TEMPLATES.find((t) => t.id === cleanId) || TEMPLATES.find((t) => t.id === 'T12') || TEMPLATES[0];
  }

  function matchIdol(titleStr) {
    const { IDOLS } = getDataRef();
    const val = String(titleStr || '');
    const found = IDOLS.find((i) => val.includes(i.name));
    return found ? found.name : '';
  }

  function uid() {
    return 'el_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function workUid() {
    return 'wk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function formatTime(ts) {
    const d = new Date(ts || Date.now());
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function getDims(project) {
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

  function ptFromCqw(cqw, dims) {
    const w = (dims && dims.w) || 90;
    return Number((((cqw / 100) * w) / 0.3528).toFixed(1));
  }

  function cqwFromPt(pt, dims) {
    const w = (dims && dims.w) || 90;
    return Number((((pt * 0.3528) / w) * 100).toFixed(2));
  }

  function createFromTemplate(t, prefill, opts) {
    const tpl = t || getTemplate('T12');
    const p = prefill || {};
    const fields = {
      name: (p.name && p.name.trim()) || '制作人Producer',
      enName: '',
      title: (p.title && p.title.trim()) || '〇〇担当',
      company: (p.company && p.company.trim()) || '初星学園',
      x: '@hatsuboshi_p',
      weibo: '',
      bilibili: '',
      xhs: '',
      favSong: '',
      qr: true
    };
    const accent = (p.accent && p.accent.trim()) || tpl.color;
    const tantouIdol = matchIdol(fields.title);
    const spec = tpl.orient === 's' ? 'sq54' : 'cn';
    const defaultStats = (opts && opts.stats) || {
      pv: 128,
      saves: 24,
      trend: [12, 18, 15, 26, 22, 31, 19]
    };

    return {
      id: (opts && opts.id) || workUid(),
      version: 1,
      fileName: (opts && opts.fileName) || `${fields.name}_名刺方案`,
      templateId: tpl.id,
      mode: 'form',
      side: 'front',
      fields,
      accent,
      tantouIdol,
      spec,
      corner: 0,
      pattern: 'none',
      guides: { bleed: true, trim: true, safe: true },
      material: 'matte',
      sideMaterials: { front: 'inherit', back: 'inherit' },
      regionMaterials: defaultRegionMaterials(),
      crafts: { gold: false, silver: false, copper: false, emboss: false, deboss: false, uv: false, velvet: false, brushed: false },
      canvas: { front: null, back: null },
      images: [],
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
        ignoreRisk: false
      },
      stats: defaultStats,
      updatedAt: Date.now()
    };
  }

  function syncCraftsSummary(project) {
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

  function ensureProjectMeta(project) {
    if (!project || typeof project !== 'object') return project;
    if (!project.id) project.id = workUid();
    if (!project.sideMaterials || typeof project.sideMaterials !== 'object') {
      project.sideMaterials = { front: 'inherit', back: 'inherit' };
    }
    const baseRegions = defaultRegionMaterials();
    if (!project.regionMaterials || typeof project.regionMaterials !== 'object') {
      project.regionMaterials = { ...baseRegions };
      // 兼容旧版 crafts 字段迁移至区域材质
      if (project.crafts) {
        if (project.crafts.gold) project.regionMaterials.name = 'gold';
        else if (project.crafts.silver) project.regionMaterials.name = 'silver';
        if (project.crafts.uv) project.regionMaterials.title = 'uv';
        if (project.crafts.emboss) project.regionMaterials.company = 'emboss';
      }
    } else {
      project.regionMaterials = { ...baseRegions, ...project.regionMaterials };
    }
    if (!project.h5) {
      project.h5 = {
        layout: 'card',
        bio: '',
        show: { x: true, weibo: true, bilibili: true, xhs: true },
        slug: 'hatsuboshi-p'
      };
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
        ignoreRisk: false
      };
    }
    if (!project.stats || typeof project.stats !== 'object') {
      project.stats = { pv: 128, saves: 24, trend: [12, 18, 15, 26, 22, 31, 19] };
    }
    if (!Array.isArray(project.stats.trend) || project.stats.trend.length !== 7) {
      project.stats.trend = [12, 18, 15, 26, 22, 31, 19];
    }
    if (!project.updatedAt) project.updatedAt = Date.now();
    return project;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.templateId) return null;
      return ensureProjectMeta(parsed);
    } catch (e) {
      return null;
    }
  }

  function readRawWorks() {
    try {
      const raw = localStorage.getItem(WORKS_KEY);
      if (!raw) return null;
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.map(ensureProjectMeta) : null;
    } catch (e) {
      return null;
    }
  }

  function writeRawWorks(list) {
    try {
      const trimmed = (list || []).slice(0, 24);
      localStorage.setItem(WORKS_KEY, JSON.stringify(trimmed));
      localStorage.setItem(WORKS_SEEDED_KEY, '1');
    } catch (e) {
      // ignore storage quota errors cleanly
    }
  }

  function makeUniqueSlug(baseSlug, works) {
    const cleanBase = String(baseSlug || 'hatsuboshi-p').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'hatsuboshi-p';
    const existing = new Set((works || []).map((w) => w.h5 && w.h5.slug));
    if (!existing.has(cleanBase)) return cleanBase;
    let idx = 2;
    while (existing.has(`${cleanBase}-${idx}`)) {
      idx += 1;
    }
    return `${cleanBase}-${idx}`;
  }

  function listWorks() {
    let works = readRawWorks();
    const wasSeeded = localStorage.getItem(WORKS_SEEDED_KEY) === '1';

    if (!works || (works.length === 0 && !wasSeeded)) {
      const seedList = [];
      const current = load();
      if (current) {
        seedList.push(current);
      } else {
        seedList.push(createFromTemplate(getTemplate('T12'), readPrefill()));
      }

      if (!wasSeeded) {
        const primary = seedList[0];
        const sampleTplId = primary.templateId === 'T01' ? 'T02' : 'T01';
        const sampleTpl = getTemplate(sampleTplId);
        const sample = createFromTemplate(
          sampleTpl,
          {
            name: '制作人Producer',
            title: `${sampleTpl.idol}担当`,
            company: '初星学園',
            accent: sampleTpl.color
          },
          {
            fileName: `${sampleTpl.idol}担当_巡演名刺`,
            slug: makeUniqueSlug(sampleTplId === 'T01' ? 'saki-producer' : 'temari-producer', seedList),
            stats: { pv: 342, saves: 68, trend: [32, 41, 38, 52, 60, 58, 61] }
          }
        );
        sample.crafts.gold = sampleTplId === 'T01';
        sample.crafts.silver = sampleTplId !== 'T01';
        sample.crafts.uv = true;
        sample.fields.favSong = sampleTplId === 'T01' ? 'Fighting My Way' : 'Luna say maybe';
        sample.h5.bio = `主推${sampleTpl.idol}，欢迎现场交换制作人名刺 ✦`;
        sample.updatedAt = Date.now() - 3600 * 1000;
        seedList.push(sample);
      }

      works = seedList;
      writeRawWorks(works);
    }

    return [...works].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function syncWorkEntry(project) {
    ensureProjectMeta(project);
    const works = listWorks();
    const idx = works.findIndex((w) => w.id === project.id);
    const copy = JSON.parse(JSON.stringify(project));
    if (idx >= 0) {
      works[idx] = copy;
    } else {
      works.unshift(copy);
    }
    writeRawWorks(works);
  }

  function save(project) {
    if (!project) return formatTime(Date.now());
    ensureProjectMeta(project);
    syncCraftsSummary(project);
    project.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      // ignore storage quota errors cleanly
    }
    syncWorkEntry(project);
    return formatTime(project.updatedAt);
  }

  function getActiveId() {
    const cur = load();
    return cur ? cur.id : null;
  }

  function setActiveWork(id) {
    const works = listWorks();
    const found = works.find((w) => w.id === id);
    if (!found) return null;
    const copy = JSON.parse(JSON.stringify(found));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
    } catch (e) {}
    return copy;
  }

  function createNewWork(tplId, prefill) {
    const works = listWorks();
    const tpl = getTemplate(tplId || 'T12');
    const p = prefill || readPrefill() || {};
    const slug = makeUniqueSlug('hatsuboshi-p', works);
    const proj = createFromTemplate(tpl, p, {
      slug,
      stats: { pv: 1, saves: 0, trend: [0, 0, 0, 0, 0, 0, 1] }
    });
    save(proj);
    return proj;
  }

  function duplicateWork(id) {
    const works = listWorks();
    const src = works.find((w) => w.id === id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = workUid();
    copy.fileName = `${src.fileName || '未命名名刺'} (副本)`;
    copy.h5 = copy.h5 || {};
    copy.h5.slug = makeUniqueSlug(copy.h5.slug || 'hatsuboshi-p', works);
    copy.stats = { pv: 1, saves: 0, trend: [0, 0, 0, 0, 0, 0, 1] };
    copy.updatedAt = Date.now();
    works.unshift(copy);
    writeRawWorks(works);
    return copy;
  }

  function renameWork(id, newName) {
    const clean = String(newName || '').trim();
    if (!clean) return false;
    const works = listWorks();
    const target = works.find((w) => w.id === id);
    if (!target) return false;
    target.fileName = clean;
    target.updatedAt = Date.now();
    writeRawWorks(works);
    const active = load();
    if (active && active.id === id) {
      active.fileName = clean;
      active.updatedAt = target.updatedAt;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
      } catch (e) {}
    }
    return true;
  }

  function deleteWork(id) {
    const works = listWorks();
    const next = works.filter((w) => w.id !== id);
    writeRawWorks(next);
    const active = load();
    if (active && active.id === id) {
      if (next.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next[0]));
        } catch (e) {}
      } else {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
      }
    }
    return next;
  }

  function findWorkBySlug(slugOrId) {
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

  function recordAnalytics(idOrSlug, type) {
    const works = listWorks();
    const target = works.find(
      (w) => w.id === idOrSlug || (w.h5 && w.h5.slug === idOrSlug)
    );
    if (!target) return null;
    ensureProjectMeta(target);
    if (type === 'pv') {
      target.stats.pv += 1;
      target.stats.trend[6] = (target.stats.trend[6] || 0) + 1;
    } else if (type === 'save') {
      target.stats.saves += 1;
    }
    writeRawWorks(works);
    const active = load();
    if (active && active.id === target.id) {
      active.stats = JSON.parse(JSON.stringify(target.stats));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
      } catch (e) {}
    }
    return target.stats;
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u && u.name ? u : null;
    } catch (e) {
      return null;
    }
  }

  function saveUser(user) {
    if (!user || !user.name) return null;
    const payload = {
      name: String(user.name).trim(),
      idol: String(user.idol || '').trim(),
      color: String(user.color || '#FF7600').trim(),
      company: String(user.company || '初星学園').trim(),
      loggedInAt: Date.now()
    };
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(payload));
      localStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({
          name: payload.name,
          title: payload.idol ? `${payload.idol}担当` : '',
          company: payload.company,
          accent: payload.color
        })
      );
    } catch (e) {}
    return payload;
  }

  function logoutUser() {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  function readPrefill() {
    try {
      const raw = localStorage.getItem(PREFILL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function initProject() {
    const params = new URLSearchParams(window.location.search);
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
        } catch (e) {}
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
      } catch (e) {}
      return proj;
    }

    const existing = load();
    if (existing) {
      if (tplParam && existing.templateId !== tplParam.split('-')[0]) {
        return createNewWork(tplParam, prefill);
      }
      syncWorkEntry(existing);
      return existing;
    }

    const works = listWorks();
    if (works.length > 0 && !tplParam) {
      const first = JSON.parse(JSON.stringify(works[0]));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
      } catch (e) {}
      return first;
    }

    return createNewWork(tplParam || 'T12', prefill);
  }

  const MAX_HISTORY = 25;
  let stack = [];
  let pointer = -1;
  let activeHistWorkId = null;

  function persistHistory() {
    if (!activeHistWorkId || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(
        `ichiban:hist:${activeHistWorkId}`,
        JSON.stringify({ stack, pointer })
      );
    } catch (e) {
      // 若包含大图超出 sessionStorage 配额，退化为仅保留最近 5 步
      try {
        const tailStart = Math.max(0, stack.length - 5);
        const trimmedStack = stack.slice(tailStart);
        const trimmedPointer = Math.max(0, pointer - tailStart);
        sessionStorage.setItem(
          `ichiban:hist:${activeHistWorkId}`,
          JSON.stringify({ stack: trimmedStack, pointer: trimmedPointer })
        );
      } catch (e2) {}
    }
  }

  const history = {
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
          const raw = sessionStorage.getItem(`ichiban:hist:${activeHistWorkId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.stack) && parsed.stack.length > 0 && typeof parsed.pointer === 'number') {
              stack = parsed.stack;
              pointer = Math.max(0, Math.min(stack.length - 1, parsed.pointer));
              return;
            }
          }
        } catch (e) {}
      }
      this.reset(project);
    },
    push(project) {
      if (project && project.id) activeHistWorkId = project.id;
      const snap = JSON.stringify(project);
      if (pointer >= 0 && stack[pointer] === snap) return;
      stack = stack.slice(0, pointer + 1);
      stack.push(snap);
      if (stack.length > MAX_HISTORY) {
        stack.shift();
      }
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

  return {
    SPECS,
    MATERIALS,
    SURFACE_MATERIALS,
    CRAFTS,
    EDITABLE_REGIONS,
    defaultRegionMaterials,
    syncCraftsSummary,
    getTemplate,
    getDims,
    matchIdol,
    ptFromCqw,
    cqwFromPt,
    uid,
    formatTime,
    createFromTemplate,
    load,
    save,
    listWorks,
    getActiveId,
    setActiveWork,
    createNewWork,
    duplicateWork,
    renameWork,
    deleteWork,
    findWorkBySlug,
    recordAnalytics,
    getUser,
    saveUser,
    logoutUser,
    initProject,
    history
  };
})();

import { create } from 'zustand';
import {
  DEFAULT_CREATOR_PROFILE,
  SYSTEM_TEMPLATES,
  createProjectFromTemplate,
} from '../data/templates';
import { idbClearAll, idbGet, idbSet } from '../storage/idb';
import type { ParsedImportPayload } from '../storage/backup';
import { sanitizeCardProject, sanitizeCustomTemplate } from '../storage/backup';
import type {
  CardProject,
  CardTemplate,
  CreatorProfile,
  SpecId,
} from '../types/card';

const KEYS = {
  WORKS: 'works_v2',
  CUSTOM_TEMPLATES: 'custom_templates_v2',
  FAVORITES: 'favorites_v2',
  PROFILE: 'profile_v2',
  ACTIVE_ID: 'active_id_v2',
};

export function getCardDims(project: Pick<CardProject, 'spec' | 'orient'>): { w: number; h: number } {
  const base: Record<SpecId, { w: number; h: number }> = {
    cn: { w: 90, h: 54 },
    jp: { w: 91, h: 55 },
    eu: { w: 85, h: 55 },
    us: { w: 89, h: 51 },
    sq54: { w: 54, h: 54 },
    sq65: { w: 65, h: 65 },
  };
  const d = base[project.spec] || base.cn;
  if (project.spec === 'sq54' || project.spec === 'sq65') return d;
  if (project.orient === 'v') return { w: d.h, h: d.w };
  return d;
}

interface StudioState {
  initialized: boolean;
  works: CardProject[];
  customTemplates: CardTemplate[];
  favorites: string[];
  profile: CreatorProfile;
  activeProject: CardProject;
  init: () => Promise<void>;
  getAllTemplates: () => CardTemplate[];
  getTemplate: (id: string) => CardTemplate;
  selectTemplate: (tplId: string) => CardProject;
  openWork: (workId: string) => CardProject | null;
  saveActiveWorkCopy: (customTitle?: string) => CardProject;
  updateActiveProject: (updater: (prev: CardProject) => CardProject) => void;
  deleteWork: (workId: string) => void;
  duplicateWork: (workId: string) => CardProject | null;
  saveCurrentAsNewTemplate: (name: string, desc?: string) => CardTemplate;
  updateCurrentCustomTemplate: () => boolean;
  deleteCustomTemplate: (tplId: string) => void;
  toggleFavorite: (tplId: string) => void;
  saveProfile: (next: CreatorProfile) => void;
  applyProfileToActive: () => void;
  importPayload: (payload: ParsedImportPayload, mode?: 'merge' | 'replace') => { summary: string };
  clearLocalWorkspace: () => Promise<void>;
}

const initialDefaultProject = createProjectFromTemplate(SYSTEM_TEMPLATES[0]);

let persistTimer: number | null = null;
function schedulePersist(state: StudioState) {
  if (typeof window === 'undefined') return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void idbSet(KEYS.WORKS, state.works);
    void idbSet(KEYS.CUSTOM_TEMPLATES, state.customTemplates);
    void idbSet(KEYS.FAVORITES, state.favorites);
    void idbSet(KEYS.PROFILE, state.profile);
    void idbSet(KEYS.ACTIVE_ID, state.activeProject.id);
  }, 120);
}

export const useStudioStore = create<StudioState>((set, get) => ({
  initialized: false,
  works: [initialDefaultProject],
  customTemplates: [],
  favorites: ['G01', 'G11', 'G31'],
  profile: DEFAULT_CREATOR_PROFILE,
  activeProject: initialDefaultProject,

  init: async () => {
    if (get().initialized) return;
    const [rawWorks, rawTpls, rawFavs, rawProfile, rawActiveId] = await Promise.all([
      idbGet<unknown[]>(KEYS.WORKS, []),
      idbGet<unknown[]>(KEYS.CUSTOM_TEMPLATES, []),
      idbGet<string[]>(KEYS.FAVORITES, ['G01', 'G11', 'G31']),
      idbGet<CreatorProfile>(KEYS.PROFILE, DEFAULT_CREATOR_PROFILE),
      idbGet<string>(KEYS.ACTIVE_ID, ''),
    ]);

    const works = (Array.isArray(rawWorks) ? rawWorks : [])
      .map(sanitizeCardProject)
      .filter((x): x is CardProject => x !== null);
    const customTemplates = (Array.isArray(rawTpls) ? rawTpls : [])
      .map(sanitizeCustomTemplate)
      .filter((x): x is CardTemplate => x !== null);
    const profile: CreatorProfile = { ...DEFAULT_CREATOR_PROFILE, ...(rawProfile || {}) };

    let nextWorks = works;
    if (nextWorks.length === 0) {
      const seed1 = createProjectFromTemplate(SYSTEM_TEMPLATES[0], {
        name: profile.nickname,
        title: profile.roleTitle,
        company: profile.studioName,
        x: profile.x,
        bilibili: profile.bilibili,
        website: profile.website,
        motto: profile.motto,
      });
      seed1.title = '个人默认名刺 · 极简白';
      nextWorks = [seed1];
    }

    const active =
      nextWorks.find((w) => w.id === rawActiveId) || nextWorks[0] || initialDefaultProject;

    set({
      initialized: true,
      works: nextWorks,
      customTemplates,
      favorites: Array.isArray(rawFavs) ? rawFavs : ['G01', 'G11', 'G31'],
      profile,
      activeProject: active,
    });
    schedulePersist(get());
  },

  getAllTemplates: () => [...get().customTemplates, ...SYSTEM_TEMPLATES],

  getTemplate: (id: string) => {
    const all = get().getAllTemplates();
    return all.find((t) => t.id === id) || SYSTEM_TEMPLATES[0];
  },

  selectTemplate: (tplId: string) => {
    const tpl = get().getTemplate(tplId);
    const prof = get().profile;
    const created = createProjectFromTemplate(
      tpl,
      tpl.isCustom
        ? undefined
        : {
            name: prof.nickname,
            company: prof.studioName,
            x: prof.x,
            bilibili: prof.bilibili,
            website: prof.website,
          },
    );
    set((s) => {
      const nextWorks = [created, ...s.works];
      return { activeProject: created, works: nextWorks };
    });
    schedulePersist(get());
    return created;
  },

  openWork: (workId: string) => {
    const found = get().works.find((w) => w.id === workId);
    if (!found) return null;
    set({ activeProject: found });
    schedulePersist(get());
    return found;
  },

  saveActiveWorkCopy: (customTitle?: string) => {
    const cur = get().activeProject;
    const now = new Date().toISOString();
    const copy: CardProject = {
      ...JSON.parse(JSON.stringify(cur)),
      id: `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: customTitle?.trim() || `${cur.title} (副本)`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      activeProject: copy,
      works: [copy, ...s.works],
    }));
    schedulePersist(get());
    return copy;
  },

  updateActiveProject: (updater) => {
    set((s) => {
      const updatedRaw = updater(s.activeProject);
      const updated: CardProject = {
        ...updatedRaw,
        updatedAt: new Date().toISOString(),
      };
      const exists = s.works.some((w) => w.id === updated.id);
      const nextWorks = exists
        ? s.works.map((w) => (w.id === updated.id ? updated : w))
        : [updated, ...s.works];
      return { activeProject: updated, works: nextWorks };
    });
    schedulePersist(get());
  },

  deleteWork: (workId: string) => {
    set((s) => {
      const remaining = s.works.filter((w) => w.id !== workId);
      if (remaining.length === 0) {
        const fresh = createProjectFromTemplate(SYSTEM_TEMPLATES[0]);
        return { works: [fresh], activeProject: fresh };
      }
      const nextActive =
        s.activeProject.id === workId ? remaining[0] : s.activeProject;
      return { works: remaining, activeProject: nextActive };
    });
    schedulePersist(get());
  },

  duplicateWork: (workId: string) => {
    const src = get().works.find((w) => w.id === workId);
    if (!src) return null;
    const now = new Date().toISOString();
    const dup: CardProject = {
      ...JSON.parse(JSON.stringify(src)),
      id: `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: `${src.title} · 副本`,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ works: [dup, ...s.works], activeProject: dup }));
    schedulePersist(get());
    return dup;
  },

  saveCurrentAsNewTemplate: (name: string, desc?: string) => {
    const cur = get().activeProject;
    const baseTpl = get().getTemplate(cur.tplId);
    const now = new Date().toISOString();
    const newTpl: CardTemplate = {
      ...baseTpl,
      id: `CT_${Date.now().toString(36)}`,
      name: name.trim() || `${cur.fields.name || '自定义'} 模板`,
      subtitle: 'Local Saved Template',
      orient: cur.orient,
      color: cur.color,
      accent: cur.accent,
      bgDark: cur.bgDark,
      paper: cur.paper,
      craft: cur.craft,
      tags: Array.from(new Set(['自定义', ...baseTpl.tags.slice(0, 2)])),
      desc: desc?.trim() || `基于「${baseTpl.name}」修改保存的本地可复用模板`,
      defaultTitle: cur.fields.title,
      defaultMotto: cur.fields.motto,
      isCustom: true,
      baseTemplateId: baseTpl.baseTemplateId || baseTpl.id,
      createdAt: now,
      updatedAt: now,
      fieldsPreset: { ...cur.fields },
      regionCraftsPreset: { ...cur.regionCrafts },
      standeePreset: cur.standee.enabled ? { ...cur.standee } : undefined,
    };
    set((s) => {
      const updatedActive: CardProject = { ...s.activeProject, tplId: newTpl.id, updatedAt: now };
      return {
        customTemplates: [newTpl, ...s.customTemplates],
        activeProject: updatedActive,
        works: s.works.map((w) => (w.id === updatedActive.id ? updatedActive : w)),
      };
    });
    schedulePersist(get());
    return newTpl;
  },

  updateCurrentCustomTemplate: () => {
    const cur = get().activeProject;
    const target = get().customTemplates.find((t) => t.id === cur.tplId);
    if (!target) return false;
    const now = new Date().toISOString();
    const updatedTpl: CardTemplate = {
      ...target,
      orient: cur.orient,
      color: cur.color,
      accent: cur.accent,
      bgDark: cur.bgDark,
      paper: cur.paper,
      craft: cur.craft,
      defaultTitle: cur.fields.title,
      defaultMotto: cur.fields.motto,
      updatedAt: now,
      fieldsPreset: { ...cur.fields },
      regionCraftsPreset: { ...cur.regionCrafts },
      standeePreset: cur.standee.enabled ? { ...cur.standee } : undefined,
    };
    set((s) => ({
      customTemplates: s.customTemplates.map((t) => (t.id === updatedTpl.id ? updatedTpl : t)),
    }));
    schedulePersist(get());
    return true;
  },

  deleteCustomTemplate: (tplId: string) => {
    set((s) => ({
      customTemplates: s.customTemplates.filter((t) => t.id !== tplId),
      favorites: s.favorites.filter((f) => f !== tplId),
    }));
    schedulePersist(get());
  },

  toggleFavorite: (tplId: string) => {
    set((s) => {
      const has = s.favorites.includes(tplId);
      return {
        favorites: has ? s.favorites.filter((f) => f !== tplId) : [...s.favorites, tplId],
      };
    });
    schedulePersist(get());
  },

  saveProfile: (next: CreatorProfile) => {
    set({ profile: { ...next, updatedAt: new Date().toISOString() } });
    schedulePersist(get());
  },

  applyProfileToActive: () => {
    const prof = get().profile;
    get().updateActiveProject((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        name: prof.nickname,
        title: prof.roleTitle,
        company: prof.studioName,
        x: prof.x,
        bilibili: prof.bilibili,
        website: prof.website,
        motto: prof.motto,
      },
    }));
  },

  importPayload: (payload: ParsedImportPayload, mode: 'merge' | 'replace' = 'merge') => {
    if (payload.kind === 'card') {
      const incoming = payload.card;
      set((s) => {
        const exists = s.works.some((w) => w.id === incoming.id);
        const importedCard = exists
          ? { ...incoming, id: `card_imp_${Date.now().toString(36)}` }
          : incoming;
        return {
          works: [importedCard, ...s.works],
          activeProject: importedCard,
        };
      });
      schedulePersist(get());
      return { summary: `已导入单张名片「${payload.card.title}」并切换为当前编辑工程` };
    }

    if (payload.kind === 'template') {
      const incoming = { ...payload.template, isCustom: true };
      set((s) => {
        const exists = s.customTemplates.some((t) => t.id === incoming.id);
        const nextTpls = exists
          ? s.customTemplates.map((t) => (t.id === incoming.id ? incoming : t))
          : [incoming, ...s.customTemplates];
        const opened = createProjectFromTemplate(incoming);
        return {
          customTemplates: nextTpls,
          works: [opened, ...s.works],
          activeProject: opened,
        };
      });
      schedulePersist(get());
      return { summary: `已导入自定义模板「${payload.template.name}」并生成可编辑名片` };
    }

    // Workspace backup
    const { backup } = payload;
    if (mode === 'replace') {
      const nextWorks = backup.works.length
        ? backup.works
        : [createProjectFromTemplate(SYSTEM_TEMPLATES[0])];
      const nextActive =
        nextWorks.find((w) => w.id === backup.activeProjectId) || nextWorks[0];
      set({
        profile: backup.profile,
        favorites: backup.favorites,
        works: nextWorks,
        customTemplates: backup.customTemplates,
        activeProject: nextActive,
      });
      schedulePersist(get());
      return {
        summary: `已完整覆盖恢复：${backup.works.length} 份名片、${backup.customTemplates.length} 套自定义模板`,
      };
    }

    // Merge mode
    set((s) => {
      const workMap = new Map(s.works.map((w) => [w.id, w]));
      for (const w of backup.works) workMap.set(w.id, w);
      const tplMap = new Map(s.customTemplates.map((t) => [t.id, t]));
      for (const t of backup.customTemplates) tplMap.set(t.id, t);
      const mergedWorks = Array.from(workMap.values());
      const mergedTpls = Array.from(tplMap.values());
      const nextActive =
        mergedWorks.find((w) => w.id === backup.activeProjectId) ||
        mergedWorks[0] ||
        s.activeProject;
      return {
        works: mergedWorks,
        customTemplates: mergedTpls,
        favorites: Array.from(new Set([...s.favorites, ...backup.favorites])),
        profile: backup.profile,
        activeProject: nextActive,
      };
    });
    schedulePersist(get());
    return {
      summary: `已合并导入：${backup.works.length} 份名片与 ${backup.customTemplates.length} 套自定义模板`,
    };
  },

  clearLocalWorkspace: async () => {
    await idbClearAll();
    const fresh = createProjectFromTemplate(SYSTEM_TEMPLATES[0]);
    set({
      works: [fresh],
      customTemplates: [],
      favorites: ['G01', 'G11', 'G31'],
      profile: DEFAULT_CREATOR_PROFILE,
      activeProject: fresh,
    });
    schedulePersist(get());
  },
}));

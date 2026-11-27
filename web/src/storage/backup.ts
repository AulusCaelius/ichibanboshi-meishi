import {
  DEFAULT_CARD_FIELDS,
  DEFAULT_CREATOR_PROFILE,
  DEFAULT_STANDEE_CONFIG,
  createDefaultRegionCrafts,
} from '../data/templates';
import type {
  CardProject,
  CardTemplate,
  CreatorProfile,
  SingleCardFile,
  SingleTemplateFile,
  WorkspaceBackup,
} from '../types/card';

export function buildWorkspaceBackup(params: {
  profile: CreatorProfile;
  favorites: string[];
  works: CardProject[];
  customTemplates: CardTemplate[];
  activeProjectId?: string;
}): WorkspaceBackup {
  return {
    format: 'ichiban-workspace-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: params.profile,
    favorites: Array.from(new Set(params.favorites)),
    works: params.works,
    customTemplates: params.customTemplates,
    activeProjectId: params.activeProjectId,
  };
}

export function buildSingleCardFile(card: CardProject): SingleCardFile {
  return {
    format: 'ichiban-card',
    version: 2,
    exportedAt: new Date().toISOString(),
    card,
  };
}

export function buildSingleTemplateFile(template: CardTemplate): SingleTemplateFile {
  return {
    format: 'ichiban-template',
    version: 2,
    exportedAt: new Date().toISOString(),
    template,
  };
}

export function sanitizeCardProject(raw: unknown): CardProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CardProject>;
  if (!r.id || !r.tplId) return null;
  const now = new Date().toISOString();
  const basePaper = r.paper || 'matte';
  const cornerMm = r.cornerMm === 5 || r.cornerMm === 3 || r.cornerMm === 0 ? r.cornerMm : r.rounded ? 3 : 0;
  return {
    id: String(r.id),
    title: String(r.title || '制作人Producer_名刺方案'),
    tplId: String(r.tplId),
    orient: r.orient === 'v' || r.orient === 's' ? r.orient : 'h',
    sides: r.sides === 1 ? 1 : 2,
    spec: r.spec || 'cn',
    color: r.color || '#FF7600',
    accent: r.accent || '#FFF7EC',
    bgDark: Boolean(r.bgDark),
    paper: basePaper,
    frontPaper: r.frontPaper || basePaper,
    backPaper: r.backPaper || basePaper,
    craft: r.craft || 'none',
    rounded: cornerMm > 0,
    cornerMm,
    showQr: r.showQr !== false,
    side: r.side === 'back' ? 'back' : 'front',
    fields: { ...DEFAULT_CARD_FIELDS, ...(r.fields || {}) },
    standee: { ...DEFAULT_STANDEE_CONFIG, ...(r.standee || {}) },
    regionCrafts: {
      ...createDefaultRegionCrafts(r.craft || 'none'),
      ...(r.regionCrafts || {}),
    },
    customElements: Array.isArray(r.customElements) ? r.customElements : [],
    h5: {
      bio: r.h5?.bio ?? '欢迎在同好聚会 / Live 现场交换制作人名刺！',
      layout: r.h5?.layout === 'poster' || r.h5?.layout === 'list' ? r.h5.layout : 'card',
      slug: r.h5?.slug || 'hatsuboshi-p',
      showSns: {
        x: r.h5?.showSns?.x ?? true,
        weibo: r.h5?.showSns?.weibo ?? true,
        bilibili: r.h5?.showSns?.bilibili ?? true,
        xhs: r.h5?.showSns?.xhs ?? true,
        website: r.h5?.showSns?.website ?? true,
      },
    },
    stats: {
      pv: typeof r.stats?.pv === 'number' ? r.stats.pv : 128,
      saves: typeof r.stats?.saves === 'number' ? r.stats.saves : 24,
      trend: Array.isArray(r.stats?.trend) && r.stats.trend.length === 7
        ? r.stats.trend
        : [8, 12, 19, 15, 22, 24, 28],
    },
    createdAt: r.createdAt || now,
    updatedAt: r.updatedAt || now,
  };
}

export function sanitizeCustomTemplate(raw: unknown): CardTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CardTemplate>;
  if (!r.id || !r.name) return null;
  const now = new Date().toISOString();
  return {
    id: String(r.id),
    name: String(r.name),
    subtitle: String(r.subtitle || 'Custom Template'),
    style: r.style || 'modern',
    orient: r.orient === 'v' || r.orient === 's' ? r.orient : 'h',
    layout: String(r.layout || 'clean'),
    sides: r.sides === 1 ? 1 : 2,
    badge: r.badge,
    color: r.color || '#FF7600',
    accent: r.accent || '#FFF7EC',
    bgDark: Boolean(r.bgDark),
    paper: r.paper || 'matte',
    craft: r.craft || 'none',
    tags: Array.isArray(r.tags) ? r.tags.map(String) : ['自定义'],
    desc: String(r.desc || '由本地工作台保存或修改的自定义模板'),
    defaultMotto: String(r.defaultMotto || DEFAULT_CARD_FIELDS.motto),
    defaultTitle: String(r.defaultTitle || DEFAULT_CARD_FIELDS.title),
    isCustom: true,
    baseTemplateId: r.baseTemplateId,
    createdAt: r.createdAt || now,
    updatedAt: r.updatedAt || now,
    fieldsPreset: r.fieldsPreset,
    regionCraftsPreset: r.regionCraftsPreset,
    standeePreset: r.standeePreset,
  };
}

export type ParsedImportPayload =
  | { kind: 'workspace'; backup: WorkspaceBackup }
  | { kind: 'card'; card: CardProject }
  | { kind: 'template'; template: CardTemplate };

export function parseImportedJson(rawText: string): ParsedImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('JSON 格式解析失败，请确认导入的是未损坏的 .json 工程/备份文件');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('导入文件内容为空或格式无效');
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.format === 'ichiban-workspace-backup' || Array.isArray(obj.works) || Array.isArray(obj.customTemplates)) {
    const works = Array.isArray(obj.works)
      ? obj.works.map(sanitizeCardProject).filter((x): x is CardProject => x !== null)
      : [];
    const customTemplates = Array.isArray(obj.customTemplates)
      ? obj.customTemplates.map(sanitizeCustomTemplate).filter((x): x is CardTemplate => x !== null)
      : [];
    const favorites = Array.isArray(obj.favorites) ? obj.favorites.map(String) : [];
    const profileRaw = (obj.profile && typeof obj.profile === 'object' ? obj.profile : {}) as Partial<CreatorProfile>;
    const profile: CreatorProfile = { ...DEFAULT_CREATOR_PROFILE, ...profileRaw };
    return {
      kind: 'workspace',
      backup: {
        format: 'ichiban-workspace-backup',
        version: 2,
        exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
        profile,
        favorites,
        works,
        customTemplates,
        activeProjectId: typeof obj.activeProjectId === 'string' ? obj.activeProjectId : undefined,
      },
    };
  }

  if (obj.format === 'ichiban-card' && obj.card) {
    const card = sanitizeCardProject(obj.card);
    if (!card) throw new Error('名片工程文件缺少必要字段');
    return { kind: 'card', card };
  }

  if (obj.format === 'ichiban-template' && obj.template) {
    const template = sanitizeCustomTemplate(obj.template);
    if (!template) throw new Error('模板文件缺少必要字段');
    return { kind: 'template', template };
  }

  const asCard = sanitizeCardProject(obj);
  if (asCard && obj.fields) return { kind: 'card', card: asCard };

  const asTpl = sanitizeCustomTemplate(obj);
  if (asTpl && obj.style) return { kind: 'template', template: asTpl };

  throw new Error('未能识别的文件结构，请选择一番星导出的备份/名片/模板 JSON 文件');
}

export function triggerJsonDownload(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

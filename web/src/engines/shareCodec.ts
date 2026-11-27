import { DEFAULT_CARD_FIELDS, SYSTEM_TEMPLATES, createProjectFromTemplate } from '../data/templates';
import type { CardProject } from '../types/card';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const norm = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm + '==='.slice((norm.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeSharePayload(project: CardProject): string {
  const f = project.fields;
  const h = project.h5;
  const compact = {
    v: 2,
    t: project.tplId,
    o: project.orient,
    sd: project.sides,
    sp: project.spec,
    cm: project.cornerMm,
    c: project.color,
    ac: project.accent,
    dk: project.bgDark ? 1 : 0,
    p: project.paper,
    fp: project.frontPaper,
    bp: project.backPaper,
    cr: project.craft,
    rc: project.regionCrafts,
    f: {
      n: f.name,
      en: f.enName,
      ti: f.title,
      cp: f.company,
      cd: f.codeTag,
      ev: f.eventTag,
      x: f.x,
      wb: f.weibo,
      bl: f.bilibili,
      xh: f.xhs,
      ws: f.website,
      mt: f.motto,
      bt: f.backTitle,
    },
    h: {
      b: h.bio,
      l: h.layout,
      sl: h.slug,
      sh: h.showSns,
    },
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(compact)));
}

export function decodeSharePayload(encoded: string): CardProject | null {
  try {
    if (!encoded) return null;
    const json = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (!json || typeof json !== 'object') return null;
    const tpl = SYSTEM_TEMPLATES.find((x) => x.id === json.t) || SYSTEM_TEMPLATES[0];
    const base = createProjectFromTemplate(tpl);
    const f = json.f || {};
    const h = json.h || {};
    return {
      ...base,
      id: `shared_${h.sl || 'card'}`,
      orient: json.o || base.orient,
      sides: json.sd === 1 ? 1 : 2,
      spec: json.sp || base.spec,
      cornerMm: json.cm === 5 || json.cm === 3 ? json.cm : 0,
      rounded: Boolean(json.cm),
      color: json.c || base.color,
      accent: json.ac || base.accent,
      bgDark: Boolean(json.dk),
      paper: json.p || base.paper,
      frontPaper: json.fp || json.p || base.paper,
      backPaper: json.bp || json.p || base.paper,
      craft: json.cr || base.craft,
      regionCrafts: json.rc ? { ...base.regionCrafts, ...json.rc } : base.regionCrafts,
      fields: {
        ...DEFAULT_CARD_FIELDS,
        name: f.n || DEFAULT_CARD_FIELDS.name,
        enName: f.en || '',
        title: f.ti || '',
        company: f.cp || '',
        codeTag: f.cd || '',
        eventTag: f.ev || '',
        x: f.x || '',
        weibo: f.wb || '',
        bilibili: f.bl || '',
        xhs: f.xh || '',
        website: f.ws || '',
        motto: f.mt || '',
        backTitle: f.bt || 'PRODUCER CARD',
        qrUrl: '',
      },
      h5: {
        bio: h.b || base.h5.bio,
        layout: h.l === 'poster' || h.l === 'list' ? h.l : 'card',
        slug: h.sl || 'hatsuboshi-p',
        showSns: h.sh ? { ...base.h5.showSns, ...h.sh } : base.h5.showSns,
      },
    };
  } catch {
    return null;
  }
}

export function buildCardShareUrl(project: CardProject, originHint?: string): string {
  if (project.fields.qrUrl && /^https?:\/\//i.test(project.fields.qrUrl.trim())) {
    return project.fields.qrUrl.trim();
  }
  const origin =
    originHint ||
    (typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin
      : 'https://auluscaelius.github.io');
  const pathname =
    typeof window !== 'undefined' && window.location ? window.location.pathname : '/ichibanboshi-meishi/';
  const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const payload = encodeSharePayload(project);
  return `${origin}${cleanPath}#/card?slug=${encodeURIComponent(project.h5?.slug || 'hatsuboshi-p')}&d=${payload}`;
}

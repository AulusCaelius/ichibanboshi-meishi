/**
 * Compact URL-safe Base64url UTF-8 encoder/decoder for cross-device H5 card sharing (?d=...).
 * Allows a scanned physical card QR code to open the customized H5 card on any mobile device
 * even in pure static / GitHub Pages deployment without a backend database.
 */

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const norm = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm + '==='.slice((norm.length + 3) % 4);
  if (typeof atob === 'function') {
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(pad, 'base64'));
}

export function encodeSharePayload(project) {
  if (!project || typeof project !== 'object') return '';
  const f = project.fields || {};
  const h5 = project.h5 || {};
  const compact = {
    v: 1,
    t: project.templateId || 'T12',
    a: project.accent || '#FF7600',
    s: project.sides || 2,
    sp: project.spec || 'cn',
    co: project.corner || 0,
    m: project.material || 'matte',
    sm: project.sideMaterials || undefined,
    rm: project.regionMaterials || undefined,
    f: {
      n: f.name || '',
      en: f.enName || '',
      ti: f.title || '',
      c: f.company || '',
      pid: f.pid || '',
      ev: f.eventTag || '',
      x: f.x || '',
      wb: f.weibo || '',
      bl: f.bilibili || '',
      xh: f.xhs || '',
      fs: f.favSong || '',
      bt: f.backTitle || '',
      bs: f.backSub || ''
    },
    h: {
      l: h5.layout || 'card',
      b: h5.bio || '',
      sh: h5.show || {},
      sl: h5.slug || 'hatsuboshi-p'
    }
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  return toBase64Url(bytes);
}

export function decodeSharePayload(encoded) {
  try {
    if (!encoded) return null;
    const bytes = fromBase64Url(encoded);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    if (!json || typeof json !== 'object') return null;
    const f = json.f || {};
    const h = json.h || {};
    return {
      id: `shared_${h.sl || 'card'}`,
      templateId: json.t || 'T12',
      accent: json.a || '#FF7600',
      sides: json.s || 2,
      spec: json.sp || 'cn',
      corner: json.co || 0,
      material: json.m || 'matte',
      sideMaterials: json.sm || { front: 'inherit', back: 'inherit' },
      regionMaterials: json.rm || {},
      mode: 'form',
      fields: {
        name: f.n || '制作人Producer',
        enName: f.en || '',
        title: f.ti || '〇〇担当',
        company: f.c || '初星学園',
        pid: f.pid || '',
        eventTag: f.ev || '',
        x: f.x || '',
        weibo: f.wb || '',
        bilibili: f.bl || '',
        xhs: f.xh || '',
        favSong: f.fs || '',
        backTitle: f.bt || '',
        backSub: f.bs || '',
        qr: true
      },
      h5: {
        layout: h.l || 'card',
        bio: h.b || '',
        show: h.sh || { x: true, weibo: true, bilibili: true, xhs: true },
        slug: h.sl || 'hatsuboshi-p'
      },
      stats: { pv: 1, saves: 0, trend: [0, 0, 0, 0, 0, 0, 1] }
    };
  } catch {
    return null;
  }
}

export function buildCardShareUrl(project, originHint) {
  const slug = (project && project.h5 && project.h5.slug) || 'hatsuboshi-p';
  const f = (project && project.fields) || {};
  if (f.qrMode === 'custom' && f.qrCustomUrl) {
    return String(f.qrCustomUrl).trim();
  }
  if (f.qrMode === 'x' && f.x) {
    return `https://x.com/${String(f.x).replace(/^@/, '')}`;
  }
  const origin =
    originHint ||
    (typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin
      : 'https://auluscaelius.github.io');
  const basePath =
    typeof window !== 'undefined' && window.location && window.location.pathname.includes('/ichibanboshi-meishi/')
      ? '/ichibanboshi-meishi'
      : '';
  const payload = encodeSharePayload(project);
  return `${origin}${basePath}/card.html?slug=${encodeURIComponent(slug)}&d=${payload}`;
}

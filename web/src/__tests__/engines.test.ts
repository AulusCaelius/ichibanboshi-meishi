import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREATOR_PROFILE,
  SYSTEM_TEMPLATES,
  createProjectFromTemplate,
} from '../data/templates';
import {
  DEFAULT_EXPORT_OPTIONS,
  applyPreflightFix,
  runPreflightChecks,
} from '../engines/preflight';
import {
  buildPdfDocument,
  buildZipArchive,
  rgbaToCmykBytes,
} from '../engines/printExport';
import { encodeQrMatrix, renderQrSvg } from '../engines/qrcode';
import {
  buildCardShareUrl,
  decodeSharePayload,
  encodeSharePayload,
} from '../engines/shareCodec';
import {
  buildSingleCardFile,
  buildSingleTemplateFile,
  buildWorkspaceBackup,
  parseImportedJson,
} from '../storage/backup';

describe('General Multi-Style Templates', () => {
  it('contains 60 non-idol general templates across 6 aesthetic styles', () => {
    expect(SYSTEM_TEMPLATES.length).toBe(60);
    const forbidden = ['花海咲季', '月村手毬', '藤田ことね', '十王星南', '初星学園', '765', '担当', '学マス'];
    const dump = JSON.stringify(SYSTEM_TEMPLATES);
    for (const term of forbidden) {
      expect(dump).not.toContain(term);
    }
    const styles = new Set(SYSTEM_TEMPLATES.map((t) => t.style));
    expect(Array.from(styles).sort()).toEqual([
      'editorial',
      'minimal',
      'modern',
      'obsidian',
      'pastel',
      'swiss',
    ]);
  });
});

describe('QR Encoder & Share Codec', () => {
  it('encodes UTF-8 URLs into QR matrix and crisp SVG', () => {
    const url = 'https://auluscaelius.github.io/ichibanboshi-meishi/#/card?d=abc';
    const mat = encodeQrMatrix(url);
    expect(mat.size).toBeGreaterThanOrEqual(21);
    const svg = renderQrSvg(url);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path d="');
  });

  it('round-trips compact Base64url share payload', () => {
    const proj = createProjectFromTemplate(SYSTEM_TEMPLATES[10], {
      name: '林栖 / Lin Qi',
      title: '品牌视觉设计师',
      motto: 'Keep light in every frame.',
    });
    const encoded = encodeSharePayload(proj);
    const decoded = decodeSharePayload(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.fields.name).toBe('林栖 / Lin Qi');
    expect(decoded?.fields.title).toBe('品牌视觉设计师');
    expect(buildCardShareUrl(proj, 'https://example.org')).toContain('#/card?d=');
  });
});

describe('Local Persistence Backup & File Import/Export', () => {
  it('round-trips full workspace backup, single card, and custom template', () => {
    const tpl = SYSTEM_TEMPLATES[30];
    const card = createProjectFromTemplate(tpl, { name: '测试创作者', x: '@creator_test' });
    card.standee = { ...card.standee, enabled: true, dataUrl: 'data:image/png;base64,iVBORw0=' };

    const backup = buildWorkspaceBackup({
      profile: DEFAULT_CREATOR_PROFILE,
      favorites: ['G01', 'G31'],
      works: [card],
      customTemplates: [{ ...tpl, id: 'CT_1', name: '我的黑金改版', isCustom: true }],
      activeProjectId: card.id,
    });
    const parsedWs = parseImportedJson(JSON.stringify(backup));
    expect(parsedWs.kind).toBe('workspace');
    if (parsedWs.kind === 'workspace') {
      expect(parsedWs.backup.works[0].fields.name).toBe('测试创作者');
      expect(parsedWs.backup.customTemplates[0].name).toBe('我的黑金改版');
    }

    const parsedCard = parseImportedJson(JSON.stringify(buildSingleCardFile(card)));
    expect(parsedCard.kind).toBe('card');

    const parsedTpl = parseImportedJson(
      JSON.stringify(buildSingleTemplateFile({ ...tpl, id: 'CT_2', name: '独立模板', isCustom: true })),
    );
    expect(parsedTpl.kind).toBe('template');
  });
});

describe('Preflight & Print Engine', () => {
  it('detects and auto-fixes safezone, fontsize, stroke, and richblack', () => {
    const tpl = SYSTEM_TEMPLATES[0];
    const card = createProjectFromTemplate(tpl);
    card.customElements = [
      { id: 'e1', side: 'front', type: 'text', text: 'tiny', x: 0.2, y: 0.2, w: 20, h: 8, fontSize: 1.2 },
    ];
    let exp = { ...DEFAULT_EXPORT_OPTIONS, strokeMinPt: 0.2, autoK100Text: false };
    let checks = runPreflightChecks(card, tpl, exp);
    expect(checks.some((c) => c.status !== 'pass' && c.canAutoFix)).toBe(true);

    let cur = card;
    for (const c of checks) {
      if (c.status !== 'pass' && c.canAutoFix) {
        const res = applyPreflightFix(cur, exp, c.id);
        cur = res.project;
        exp = res.exp;
      }
    }
    checks = runPreflightChecks(cur, tpl, exp);
    expect(checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('produces valid DeviceCMYK PDF 1.4, K100 pure black mapping, and PK ZIP archive', () => {
    const cmyk = rgbaToCmykBytes(new Uint8Array([12, 12, 12, 255]), 1, 1, true);
    expect(cmyk[0]).toBe(0);
    expect(cmyk[1]).toBe(0);
    expect(cmyk[2]).toBe(0);
    expect(cmyk[3]).toBeGreaterThan(230);

    const pdf = buildPdfDocument([
      {
        streamBytes: new Uint8Array([0, 0, 0, 255]),
        filter: '',
        colorSpace: 'DeviceCMYK',
        widthPx: 1,
        heightPx: 1,
        widthPt: 255,
        heightPt: 153,
      },
    ]);
    const pdfStr = new TextDecoder().decode(pdf.slice(0, 8));
    expect(pdfStr).toBe('%PDF-1.4');

    const zip = buildZipArchive([{ name: 'front.png', bytes: new Uint8Array([1, 2, 3]) }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
});

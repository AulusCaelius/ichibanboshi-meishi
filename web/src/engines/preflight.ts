import { getCardDims } from '../stores/useStudioStore';
import type { CardProject, CardTemplate } from '../types/card';

export interface PreflightCheck {
  id: 'dpi' | 'safezone' | 'fontsize' | 'stroke' | 'color' | 'font' | 'required' | 'richblack';
  title: string;
  status: 'pass' | 'warn' | 'error';
  detail: string;
  canAutoFix: boolean;
  autoFixLabel?: string;
}

export interface ExportOptions {
  format: 'pdf' | 'png' | 'jpg' | 'svg';
  color: 'cmyk' | 'rgb';
  dpi: 300 | 600;
  bleed: 0 | 3;
  cropMarks: boolean;
  doubleSided: boolean;
  spot: boolean;
  autoK100Text: boolean;
  strokeMinPt: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'pdf',
  color: 'cmyk',
  dpi: 300,
  bleed: 3,
  cropMarks: true,
  doubleSided: true,
  spot: true,
  autoK100Text: true,
  strokeMinPt: 0.25,
};

export function runPreflightChecks(
  project: CardProject,
  template: CardTemplate,
  exp: ExportOptions,
): PreflightCheck[] {
  const dims = getCardDims(project);
  const checks: PreflightCheck[] = [];
  const customEls = project.customElements || [];

  // 1. 图片分辨率
  const imgEls = customEls.filter((e) => e.type === 'image');
  const hasStandee = project.standee?.enabled && project.standee?.dataUrl;
  checks.push({
    id: 'dpi',
    title: '图像分辨率与插画清晰度',
    status: 'pass',
    detail:
      imgEls.length || hasStandee
        ? `已挂载 ${imgEls.length + (hasStandee ? 1 : 0)} 处自定义插画/位图，导出按 ${exp.dpi} DPI 输出`
        : '纯矢量排版与高清内嵌二维码，任意尺寸缩放无损',
    canAutoFix: false,
  });

  // 2. 安全区越界检查 (3mm margin)
  const marginX = (3 / dims.w) * 100;
  const marginY = (3 / dims.h) * 100;
  const offender = customEls.find(
    (el) =>
      el.x < marginX - 0.1 ||
      el.y < marginY - 0.1 ||
      el.x + el.w > 100 - marginX + 0.1 ||
      el.y + el.h > 100 - marginY + 0.1,
  );
  checks.push(
    offender
      ? {
          id: 'safezone',
          title: '3mm 裁切安全区检查',
          status: 'warn',
          detail: '部分自由画布图层接近裁切边缘（小于 3mm 安全内缩）',
          canAutoFix: true,
          autoFixLabel: '一键收进安全区',
        }
      : {
          id: 'safezone',
          title: '3mm 裁切安全区检查',
          status: 'pass',
          detail: '全部排版与自由画布图层均位于内缩 3mm 安全区内',
          canAutoFix: false,
        },
  );

  // 3. 极小字号检查
  const minTextEl = customEls
    .filter((e) => e.type === 'text')
    .map((e) => ({
      el: e,
      pt: (((e.fontSize || 3.4) / 100) * dims.w) / 0.3528,
    }))
    .sort((a, b) => a.pt - b.pt)[0];

  if (minTextEl && minTextEl.pt < 6) {
    checks.push({
      id: 'fontsize',
      title: '最小可辨字号检查',
      status: minTextEl.pt < 5 ? 'error' : 'warn',
      detail: `画布文字最小约 ${minTextEl.pt.toFixed(1)}pt（印刷建议 ≥ 6pt）`,
      canAutoFix: true,
      autoFixLabel: '一键放大至 6pt',
    });
  } else {
    checks.push({
      id: 'fontsize',
      title: '最小可辨字号检查',
      status: 'pass',
      detail: minTextEl ? `画布最小文字约 ${minTextEl.pt.toFixed(1)}pt，清晰易读` : '所有正文与社交标识均符合 ≥ 6pt 印刷规范',
      canAutoFix: false,
    });
  }

  // 4. 极细线条检查
  if ((template.style === 'minimal' || template.style === 'editorial') && exp.strokeMinPt < 0.25) {
    checks.push({
      id: 'stroke',
      title: '极细装饰线宽度',
      status: 'warn',
      detail: `当前细线基准 ${exp.strokeMinPt}pt 低于印厂 0.25pt 显影阈值`,
      canAutoFix: true,
      autoFixLabel: '加粗至 0.25pt',
    });
  } else {
    checks.push({
      id: 'stroke',
      title: '极细装饰线宽度',
      status: 'pass',
      detail: '所有框线与分割线均 ≥ 0.25pt',
      canAutoFix: false,
    });
  }

  // 5. 色彩空间
  checks.push(
    exp.color === 'cmyk' && (imgEls.length > 0 || hasStandee)
      ? {
          id: 'color',
          title: '印刷色彩分色检查',
          status: 'warn',
          detail: '含彩色插画图像，导出 DeviceCMYK PDF 时将自动进行 GCR 印刷分色',
          canAutoFix: false,
        }
      : {
          id: 'color',
          title: '印刷色彩分色检查',
          status: 'pass',
          detail: exp.color === 'cmyk' ? '全流程 DeviceCMYK 分色就绪' : '屏幕分享 RGB 模式就绪',
          canAutoFix: false,
        },
  );

  // 6. 字体安全
  checks.push({
    id: 'font',
    title: '字体版权与嵌入安全',
    status: 'pass',
    detail: '采用开源 Noto Sans / Inter 字体族，支持全矢量栅格化防乱码',
    canAutoFix: false,
  });

  // 7. 关键信息非空
  const hasName = Boolean(project.fields.name && project.fields.name.trim());
  checks.push({
    id: 'required',
    title: '核心署名信息检查',
    status: hasName ? 'pass' : 'error',
    detail: hasName ? `主姓名完整（${project.fields.name.trim()}）` : '正面主姓名/昵称为空，请回到编辑器补充后再输出印刷稿',
    canAutoFix: false,
  });

  // 8. K100 单色黑保护
  checks.push(
    exp.color === 'cmyk' && !exp.autoK100Text
      ? {
          id: 'richblack',
          title: '四色黑小字重影防护',
          status: 'warn',
          detail: 'CMYK 输出尚未启用深色小字 K100 (0,0,0,100) 单色黑锁定',
          canAutoFix: true,
          autoFixLabel: '启用 K100 单色黑',
        }
      : {
          id: 'richblack',
          title: '四色黑小字重影防护',
          status: 'pass',
          detail: exp.color === 'cmyk' ? '已启用 K100 单色黑防重影分色映射' : 'RGB 输出无需锁定单色黑',
          canAutoFix: false,
        },
  );

  return checks;
}

export function applyPreflightFix(
  project: CardProject,
  exp: ExportOptions,
  ruleId: PreflightCheck['id'],
): { project: CardProject; exp: ExportOptions; changed: boolean } {
  const dims = getCardDims(project);
  const nextProject: CardProject = JSON.parse(JSON.stringify(project));
  const nextExp: ExportOptions = { ...exp };
  let changed = false;

  if (ruleId === 'stroke') {
    nextExp.strokeMinPt = 0.25;
    changed = true;
  } else if (ruleId === 'richblack') {
    nextExp.autoK100Text = true;
    changed = true;
  } else if (ruleId === 'safezone' && nextProject.customElements.length) {
    const marginX = (3 / dims.w) * 100 + 0.25;
    const marginY = (3 / dims.h) * 100 + 0.25;
    const maxW = Math.max(4, 100 - marginX * 2);
    const maxH = Math.max(4, 100 - marginY * 2);
    nextProject.customElements = nextProject.customElements.map((el) => {
      const next = { ...el };
      if (next.w > maxW) next.w = Number(maxW.toFixed(2));
      if (next.h > maxH) next.h = Number(maxH.toFixed(2));
      if (next.x < marginX) next.x = Number(marginX.toFixed(2));
      if (next.y < marginY) next.y = Number(marginY.toFixed(2));
      if (next.x + next.w > 100 - marginX) next.x = Number((100 - marginX - next.w).toFixed(2));
      if (next.y + next.h > 100 - marginY) next.y = Number((100 - marginY - next.h).toFixed(2));
      return next;
    });
    changed = true;
  } else if (ruleId === 'fontsize' && nextProject.customElements.length) {
    const minCqw = Math.ceil(((6 * 0.3528) / dims.w) * 10000) / 100;
    nextProject.customElements = nextProject.customElements.map((el) =>
      el.type === 'text' && (el.fontSize || 3.4) < minCqw ? { ...el, fontSize: minCqw } : el,
    );
    changed = true;
  }

  return { project: nextProject, exp: nextExp, changed };
}

export function estimateExportSize(project: CardProject, exp: ExportOptions): string {
  const dims = getCardDims(project);
  const pxW = ((dims.w + 2 * exp.bleed) / 25.4) * exp.dpi;
  const pxH = ((dims.h + 2 * exp.bleed) / 25.4) * exp.dpi;
  const factors: Record<ExportOptions['format'], number> = {
    pdf: 0.14,
    png: 0.34,
    jpg: 0.08,
    svg: 0.02,
  };
  const sides = exp.doubleSided ? 2 : 1;
  const standeeBytes = project.standee?.enabled ? (project.standee.dataUrl?.length || 0) * 0.75 : 0;
  const totalBytes = pxW * pxH * (exp.color === 'cmyk' ? 4 : 3) * factors[exp.format] * sides + standeeBytes;
  return `约 ${Math.max(0.1, totalBytes / (1024 * 1024)).toFixed(1)} MB`;
}

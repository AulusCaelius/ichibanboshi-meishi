import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, FolderSync, Layers, Printer, Sparkles } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { SYSTEM_TEMPLATES, TEMPLATE_STYLE_LABELS, createProjectFromTemplate } from '../data/templates';
import { useStudioStore } from '../stores/useStudioStore';
import type { TemplateStyle } from '../types/card';

interface HomePageProps {
  onOpenBackup: () => void;
}

const PICKUP_IDS = ['G02', 'G11', 'G21', 'G31', 'G41', 'G51', 'G14', 'G34'];

export function HomePage({ onOpenBackup }: HomePageProps) {
  const navigate = useNavigate();
  const { selectTemplate, activeProject, getTemplate, customTemplates } = useStudioStore();
  const [pickupStyle, setPickupStyle] = useState<'all' | TemplateStyle>('all');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const trackRef = useRef<HTMLDivElement | null>(null);

  const heroCards = [
    { tplId: 'G01', name: '制作人Producer', title: '花海咲季担当', company: '初星学園', accent: '#E30F25' },
    { tplId: 'G31', name: '制作人Producer', title: '十王星南担当', company: '初星学園', accent: '#F6AE54' },
    { tplId: 'G41', name: '制作人Producer', title: '藤田ことね担当', company: '765プロダクション', accent: '#F8C112' },
  ].map((item) => {
    const tpl = SYSTEM_TEMPLATES.find((t) => t.id === item.tplId) || SYSTEM_TEMPLATES[0];
    return {
      tpl,
      project: createProjectFromTemplate(tpl, {
        name: item.name,
        title: item.title,
        company: item.company,
      }, item.accent),
    };
  });

  const pickupTemplates = PICKUP_IDS.map(
    (id) => SYSTEM_TEMPLATES.find((t) => t.id === id) || SYSTEM_TEMPLATES[0],
  ).filter((t) => pickupStyle === 'all' || t.style === pickupStyle);

  const activeTpl = getTemplate(activeProject.tplId);

  return (
    <div>
      {/* 模块 1：Hero 首屏区 */}
      <section className="hero">
        <div className="hero__lights" aria-hidden="true" />
        <div className="hero__noise" aria-hidden="true" />
        <div className="hero__vertical-copy" aria-hidden="true">为你的制作人之名，点亮一番星</div>
        <div className="bg-text bg-text--white hero__bg-text" aria-hidden="true">PRODUCER CARD</div>

        <div className="prd-container hero__grid">
          <div>
            <div className="hero__eyebrow">✦ PRODUCER MEISHI STUDIO · 100% LOCAL</div>
            <h1 className="hero__title">从挑选「成品」开始的制作人名片设计平台</h1>
            <p className="hero__subtitle">
              填上你的资料，{SYSTEM_TEMPLATES.length + customTemplates.length} 套通用多风格名刺模板即刻变为专属成品。支持自由插画裁剪、全可编辑区域材质、WebGL 实体 3D 预览、CMYK 印刷导出与本地文件导入续作。
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to="/templates" className="btn-cta btn-cta--white">
                免费开始设计
              </Link>
              <Link to="/templates" className="btn-outline btn-outline--white">
                浏览模板库 →
              </Link>
              <button
                type="button"
                onClick={onOpenBackup}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-[0_18px_0_18px] bg-white/15 border border-white/40 text-white text-sm font-semibold hover:bg-white/25 transition cursor-pointer"
              >
                <FolderSync className="w-4 h-4" />
                导入上次保存工程
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-white/90">
              <button
                type="button"
                onClick={() => navigate('/editor')}
                className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 font-semibold cursor-pointer"
              >
                继续编辑：{activeProject.fields.name || '当前名刺'}（{activeTpl.name}）→
              </button>
            </div>
          </div>

          <div
            className="hero__stage"
            aria-label="精选名片 3D 悬浮展示"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
              const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
              setTilt({ x: ny * -5, y: nx * 6 });
            }}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
          >
            <div
              className="hero-card-wrap hero-card-wrap--back-left"
              style={{ transform: `translate(-114px, -74px) rotate(-13deg) scale(0.9) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            >
              <div className="hero-card-float">
                <CardFaceView project={heroCards[0].project} template={heroCards[0].tpl} />
              </div>
            </div>

            <div
              className="hero-card-wrap hero-card-wrap--back-right"
              style={{ transform: `translate(114px, 66px) rotate(12deg) scale(0.92) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            >
              <div className="hero-card-float">
                <CardFaceView project={heroCards[2].project} template={heroCards[2].tpl} />
              </div>
            </div>

            <div
              className="hero-card-wrap hero-card-wrap--center"
              style={{ transform: `translate(0, 0) rotate(-3deg) scale(1.04) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            >
              <div className="hero-card-float">
                <CardFaceView project={heroCards[1].project} template={heroCards[1].tpl} />
              </div>
            </div>
          </div>
        </div>

        <div className="hero__scroll" aria-hidden="true">
          <span className="hero__scroll-line" />
          <span>SCROLL</span>
        </div>
      </section>

      {/* 模块 2：功能亮点 FEATURES */}
      <section id="features" className="features-section">
        <div className="prd-container">
          <div className="section-head">
            <h2 className="section-heading">
              功能亮点 <span className="section-heading__star" aria-hidden="true">✦</span>
            </h2>
            <div className="bg-text bg-text--stroke" aria-hidden="true">Features</div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                en: 'PREFILL',
                icon: Sparkles,
                title: '信息预填实时渲染',
                desc: '输入 P 名/职位/事务所即刻同步 60 套通用风格模板缩略图，告别假字盲选，直接挑成品。',
              },
              {
                num: '02',
                en: 'DUAL MODE',
                icon: Layers,
                title: '双模式编辑器',
                desc: '小白用极简表单零门槛出图，进阶创作者切换自由画布精调图层与 17 个区域材质。',
              },
              {
                num: '03',
                en: '3D PREVIEW',
                icon: Box,
                title: '真实 3D 物理材质预览',
                desc: 'Three.js WebGL 实时还原 6 种特种纸肌理、卡片厚度倒角与金属/浮雕/压凹立体效果，无虚假扫光。',
              },
              {
                num: '04',
                en: 'PRINT READY',
                icon: Printer,
                title: '印刷级专业导出',
                desc: '支持 6 国规格、3mm 出血线、CMYK 色彩与 300 DPI PDF 1.4 / K100 专色黑版本地直出。',
              },
            ].map((item) => (
              <article key={item.num} className="glass-card feature-card">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-semibold text-[28px] text-[#D95F00]" style={{ fontFamily: 'var(--font-display-en)' }}>
                    {item.num}
                  </span>
                  <span className="text-xs font-semibold tracking-[0.2em] text-[#535353]/75" style={{ fontFamily: 'var(--font-display-en)' }}>
                    {item.en}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-[0_14px_0_14px] bg-[#FFF7EC] text-[#D95F00] flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-[#333333] mb-3">{item.title}</h3>
                <p className="text-[15px] text-[#535353] leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 模块 3：核心差异 WHY ICHIBANBOSHI */}
      <section className="why-section">
        <div className="prd-container relative z-10">
          <div className="section-head">
            <h2 className="section-heading section-heading--light">
              核心差异 <span className="section-heading__star" aria-hidden="true">✦</span>
            </h2>
            <div className="bg-text bg-text--white" aria-hidden="true">Why Ichibanboshi</div>
          </div>

          <div className="flex flex-col gap-10">
            {/* Row 1: Auto-Layout */}
            <article className="why-card">
              <div className="why-card__visual grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 border border-[#E9E9E7]">
                  <div className="text-xs font-bold text-[#E30F25] mb-2">● 普通模板（超长文本溢出）</div>
                  <div className="border border-dashed border-[#E30F25] bg-[#E30F25]/5 p-2 text-xs font-bold text-[#333333] whitespace-nowrap overflow-visible">
                    制作人Producer（初星学園 首席担当）
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-[#E9E9E7]">
                  <div className="text-xs font-bold text-[#008969] mb-2">✦ Auto-Layout 自动缩字适配</div>
                  <CardFaceView project={heroCards[0].project} template={heroCards[0].tpl} />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-[0.2em] text-[#D95F00] mb-2" style={{ fontFamily: 'var(--font-display-en)' }}>
                  AUTO-LAYOUT ENGINE
                </div>
                <h3 className="text-[28px] font-bold text-[#333333] mb-4">Auto-Layout 智能自动排版</h3>
                <ul className="space-y-2.5 text-[#535353] text-base mb-7">
                  <li>✦ 字段留空时自动隐藏对应标签，动态收紧留白</li>
                  <li>✦ 超长 P 名、长职称自动缩小字号或规范双行截断</li>
                  <li>✦ 自由增删社交账号始终维持秩序网格，绝不破版</li>
                </ul>
                <Link to="/templates?state=long" className="btn-more">
                  <span className="btn-more__inner">MORE <span className="btn-more__arrow">→</span></span>
                </Link>
              </div>
            </article>

            {/* Row 2: Phygital */}
            <article className="why-card why-card--reverse">
              <div className="md:order-2 why-card__visual flex items-center justify-center gap-4">
                <div className="w-44 shrink-0">
                  <CardFaceView project={heroCards[1].project} template={heroCards[1].tpl} side="back" />
                </div>
                <div className="flex flex-col items-center gap-1 text-xs font-bold text-[#D95F00]">
                  <span className="text-lg">✦</span>
                  <span>同步映射</span>
                </div>
                <div className="w-40 bg-white border-4 border-[#333333] rounded-3xl p-3 text-center shadow-md">
                  <div className="w-9 h-9 rounded-full mx-auto bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white font-bold flex items-center justify-center">P</div>
                  <div className="text-xs font-bold mt-1.5 text-[#333333]">制作人Producer</div>
                  <div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-[#E30F25] text-white text-[10px]">花海咲季担当</div>
                  <div className="mt-2 py-1.5 rounded-[0_10px_0_10px] bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white text-[10px] font-bold">
                    保存通讯录 .vcf
                  </div>
                </div>
              </div>
              <div className="md:order-1">
                <div className="text-xs font-semibold tracking-[0.2em] text-[#D95F00] mb-2" style={{ fontFamily: 'var(--font-display-en)' }}>
                  PHYGITAL IDENTITY
                </div>
                <h3 className="text-[28px] font-bold text-[#333333] mb-4">Phygital 实体 + 数字双栖名片</h3>
                <ul className="space-y-2.5 text-[#535353] text-base mb-7">
                  <li>✦ 自动生成同款视觉 H5 电子名片，支持 3 种布局切换</li>
                  <li>✦ 背面真实 UTF-8 二维码无需服务器，扫码秒开 H5</li>
                  <li>✦ 展后随时保存 `.ichiban-backup.json` 续改不丢失</li>
                </ul>
                <Link to="/phygital" className="btn-more">
                  <span className="btn-more__inner">MORE <span className="btn-more__arrow">→</span></span>
                </Link>
              </div>
            </article>

            {/* Row 3: Preflight */}
            <article className="why-card">
              <div className="why-card__visual space-y-2.5 text-xs font-semibold">
                <div className="bg-white rounded-lg p-3 border border-[#E9E9E7] flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#008969]" />出血位设定 · 每边 3mm 已铺满</span>
                  <span className="text-[#008969]">通过</span>
                </div>
                <div className="bg-white rounded-lg p-3 border border-[#E9E9E7] flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#F8C112]" />自由图层进入 3mm 裁切危险区</span>
                  <span className="text-[#D95F00]">一键修复 →</span>
                </div>
                <div className="bg-white rounded-lg p-3 border border-[#E9E9E7] flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#008969]" />K100 单色黑小字分色重影保护</span>
                  <span className="text-[#008969]">就绪</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-[0.2em] text-[#D95F00] mb-2" style={{ fontFamily: 'var(--font-display-en)' }}>
                  PREFLIGHT &amp; CMYK ENGINE
                </div>
                <h3 className="text-[28px] font-bold text-[#333333] mb-4">Preflight 专业印前质检</h3>
                <ul className="space-y-2.5 text-[#535353] text-base mb-7">
                  <li>✦ 8 项自动规则检测安全区、极小字号、细线与四色黑</li>
                  <li>✦ 一键修复问题并直达编辑器画布定位具体图层</li>
                  <li>✦ 纯前端输出 DeviceCMYK PDF 1.4 与 K100 专色通道板</li>
                </ul>
                <Link to="/export" className="btn-more">
                  <span className="btn-more__inner">MORE <span className="btn-more__arrow">→</span></span>
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 模块 4：60 套通用风格精选 PICK UP */}
      <section className="pickup-section">
        <div className="prd-container">
          <div className="section-head flex-wrap gap-4">
            <h2 className="section-heading">
              精选模板 <span className="section-heading__star" aria-hidden="true">✦</span>
            </h2>

            <div className="flex flex-wrap items-center gap-2 relative z-10">
              <button
                type="button"
                onClick={() => setPickupStyle('all')}
                className={`prd-chip ${pickupStyle === 'all' ? 'is-active' : ''}`}
              >
                全部
              </button>
              {(Object.keys(TEMPLATE_STYLE_LABELS) as TemplateStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setPickupStyle(st)}
                  className={`prd-chip ${pickupStyle === st ? 'is-active' : ''}`}
                >
                  {TEMPLATE_STYLE_LABELS[st]}
                </button>
              ))}
            </div>

            <div className="bg-text bg-text--stroke absolute right-0 -top-6" aria-hidden="true">Pick Up</div>
          </div>

          <div
            ref={trackRef}
            className="flex gap-6 overflow-x-auto pb-4 scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {pickupTemplates.map((tpl) => {
              const previewProj = createProjectFromTemplate(tpl);
              return (
                <article
                  key={tpl.id}
                  onClick={() => {
                    selectTemplate(tpl.id);
                    navigate('/editor');
                  }}
                  className="flex-none w-[300px] bg-white border border-[#E9E9E7] rounded-[0_24px_0_24px] overflow-hidden shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition cursor-pointer"
                >
                  <div className="stage-backdrop h-[216px] p-5">
                    <div className={tpl.orient === 'v' ? 'w-28' : tpl.orient === 's' ? 'w-40' : 'w-full'}>
                      <CardFaceView project={previewProj} template={tpl} />
                    </div>
                  </div>
                  <div className="p-4 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-[#333333]">{tpl.name}</div>
                      <div className="text-xs text-[#535353] mt-0.5">{tpl.subtitle}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#FFF7EC] text-[#D95F00] text-[11px] font-bold">
                      {TEMPLATE_STYLE_LABELS[tpl.style]}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => trackRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                className="w-12 h-11 rounded-[0_16px_0_16px] border border-[#F39800] bg-white text-[#D95F00] font-bold hover:bg-[#FF7600] hover:text-white transition cursor-pointer"
                aria-label="向左滚动精选模板"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => trackRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                className="w-12 h-11 rounded-[0_16px_0_16px] border border-[#F39800] bg-white text-[#D95F00] font-bold hover:bg-[#FF7600] hover:text-white transition cursor-pointer"
                aria-label="向右滚动精选模板"
              >
                →
              </button>
            </div>

            <Link to="/templates" className="btn-more">
              <span className="btn-more__inner">
                查看全部模板 MORE <span className="btn-more__arrow">→</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 模块 5：Art Deco 日芒 CTA 带 */}
      <section className="cta-band">
        <div className="cta-band__sunburst" aria-hidden="true" />
        <div className="prd-container">
          <div className="cta-band__deco">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#333333] mb-7">
              今天，就交出你的第一张制作人名片
            </h2>
            <Link to="/templates" className="btn-cta">
              免费开始设计 ✦
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

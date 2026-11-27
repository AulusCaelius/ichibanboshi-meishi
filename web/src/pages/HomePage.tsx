import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  FolderSync,
  HardDrive,
  Layers,
  Printer,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { SYSTEM_TEMPLATES, TEMPLATE_STYLE_LABELS, createProjectFromTemplate } from '../data/templates';
import { useStudioStore } from '../stores/useStudioStore';
import type { TemplateStyle } from '../types/card';

interface HomePageProps {
  onOpenBackup: () => void;
}

const FEATURED_STYLES: { style: TemplateStyle; blurb: string; tplId: string }[] = [
  { style: 'minimal', blurb: '大幅留白与精简栅格，纯正棉卡触感', tplId: 'G01' },
  { style: 'modern', blurb: '不对称撞色与几何色块，视觉识别强', tplId: 'G11' },
  { style: 'editorial', blurb: '刊物衬线标题配档案栏线，出版画册感', tplId: 'G21' },
  { style: 'obsidian', blurb: '450g 黑芯纸配哑金/冷银/拉丝箔面', tplId: 'G31' },
  { style: 'pastel', blurb: '轻盈低饱和暖调渐变，市集社交互动首选', tplId: 'G41' },
  { style: 'swiss', blurb: '严谨 12 栏导视秩序排版，清晰专业', tplId: 'G51' },
];

export function HomePage({ onOpenBackup }: HomePageProps) {
  const navigate = useNavigate();
  const { activeProject, getTemplate, selectTemplate, works, customTemplates } = useStudioStore();
  const activeTpl = getTemplate(activeProject.tplId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-14">
      {/* Hero */}
      <section className="grid lg:grid-cols-12 gap-8 items-center bg-white border border-slate-200 leaf-hero p-6 sm:p-10 shadow-sm">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF7600] text-xs font-bold">
            <HardDrive className="w-3.5 h-3.5" />
            100% 纯本地运行 · 浏览器自动缓存 + 工程备份导入续作
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-[1.12]">
            多风格 <span className="text-[#FF7600]">个性名刺</span> 在线设计与印刷工坊
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl">
            提供 60 套通用现代风格模板（极简留白、现代几何、杂志社论、暗夜先锋、柔和渐变、秩序商务），支持任意个人插画/头像上传、17 个独立区域物理材质定制、WebGL 三维厚卡模拟与 300 DPI DeviceCMYK 印前导出。所有修改实时存储在本地 IndexedDB，并可导出备份随时导入继续编辑。
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/editor')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl btn-brand text-sm font-bold cursor-pointer"
            >
              继续编辑「{activeProject.fields.name || '当前名片'}」
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              to="/templates"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:border-[#FF7600] text-sm font-bold text-slate-800"
            >
              <Sparkles className="w-4 h-4 text-[#FF7600]" />
              浏览 60+ 通用模板
            </Link>

            <button
              type="button"
              onClick={onOpenBackup}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700 cursor-pointer"
            >
              <FolderSync className="w-4 h-4" />
              导入上次保存工程
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div>
              <div className="font-black text-lg text-slate-900">{SYSTEM_TEMPLATES.length + customTemplates.length}</div>
              <div className="text-slate-500">套可用通用模板（含自定义）</div>
            </div>
            <div>
              <div className="font-black text-lg text-slate-900">{works.length}</div>
              <div className="text-slate-500">份本地已存名片工程</div>
            </div>
            <div>
              <div className="font-black text-lg text-slate-900">6 纸 × 9 工艺</div>
              <div className="text-slate-500">WebGL 实体 PBR 渲染</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>当前工作台实时名片</span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                {activeTpl.name}
              </span>
            </div>
            <CardFaceView project={activeProject} template={activeTpl} />
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>上次更新：{activeProject.updatedAt.slice(0, 16).replace('T', ' ')}</span>
              <Link to="/works" className="font-bold text-[#FF7600] hover:underline">
                管理本地资产 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: FolderSync,
            title: '本地持久 & 文件续作',
            desc: '新建与修改自动写入 IndexedDB；支持全量备份、单卡与模板 JSON 导出，随时导入续做。',
          },
          {
            icon: Box,
            title: 'WebGL 物理材质预览',
            desc: '模拟真实卡纸厚度倒角、棉卡/和纸/黑卡/PVC 纹理及 9 种局部表面工艺，零人工浮夸扫光。',
          },
          {
            icon: Layers,
            title: '表单 + 自由画布双模式',
            desc: '既可一键填写社交账号与上传插画裁剪，也可自由叠加图形文字元素并锁定 3mm 安全区。',
          },
          {
            icon: Printer,
            title: 'DeviceCMYK 印前直出',
            desc: '内置 8 项印前自动检查修复，生成带 K100 单色黑文本保护与裁切线的印刷级 PDF/ZIP。',
          },
        ].map((item) => (
          <div key={item.title} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7600] flex items-center justify-center">
              <item.icon className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-slate-900">{item.title}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* 6 Styles Showcase */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900">六大通用视觉体系 · 点选即刻开改</h2>
            <p className="text-sm text-slate-500 mt-1">
              覆盖简约工作室、个人创作者、杂志出版、暗黑工艺、柔和市集与瑞士秩序等多元审美场景
            </p>
          </div>
          <Link to="/templates" className="text-sm font-bold text-[#FF7600] hover:underline">
            查看全部 {SYSTEM_TEMPLATES.length} 套系统模板 →
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURED_STYLES.map((item) => {
            const tpl = SYSTEM_TEMPLATES.find((t) => t.id === item.tplId)!;
            const previewProject = createProjectFromTemplate(tpl);
            return (
              <div
                key={item.style}
                className="bg-white border border-slate-200 leaf-card p-5 flex flex-col justify-between gap-4 hover:border-[#FF7600] transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">
                      {TEMPLATE_STYLE_LABELS[item.style]}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{tpl.id}</span>
                  </div>
                  <p className="text-xs text-slate-500">{item.blurb}</p>
                </div>

                <CardFaceView project={previewProject} template={tpl} />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/templates?style=${item.style}`)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    看同风格全部 10 套
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      selectTemplate(tpl.id);
                      navigate('/editor');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-[#FF7600] text-white text-xs font-bold transition cursor-pointer"
                  >
                    用这套创建名片
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Phygital Banner */}
      <section className="bg-slate-900 text-white leaf-card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F39800]">
            <QrCode className="w-4 h-4" />
            Phygital 实体卡背二维码联动
          </div>
          <h2 className="text-xl sm:text-2xl font-black">实体名刺印刷 + 免后端离线 URL 数字名片</h2>
          <p className="text-xs sm:text-sm text-slate-300">
            背面自动生成真实 UTF-8 ISO 二维码，将社交句柄、个人简介压缩编码进静态 URL 参数，扫码即刻打开专属移动端数字名片与 vCard 通讯录下载。
          </p>
        </div>
        <Link
          to="/phygital"
          className="px-5 py-3 rounded-xl btn-brand text-sm font-bold shrink-0"
        >
          预览我的数字名片
        </Link>
      </section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Download, ExternalLink } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { renderQrSvg } from '../engines/qrcode';
import { buildCardShareUrl } from '../engines/shareCodec';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';
import type { H5Config } from '../types/card';

export function PhygitalPage() {
  const navigate = useNavigate();
  const { activeProject, getTemplate, updateActiveProject, lastSavedAt, recordCardSave } = useStudioStore();
  const { showToast } = useToastStore();
  const tpl = getTemplate(activeProject.tplId);

  const [cardSide, setCardSide] = useState<'front' | 'back'>('back');
  const shareUrl = useMemo(() => buildCardShareUrl(activeProject), [activeProject]);
  const qrSvg = useMemo(
    () => renderQrSvg(shareUrl, { fg: '#1F2937', bg: '#FFFFFF', border: 2, ariaLabel: '名片二维码' }),
    [shareUrl],
  );

  const updateH5 = (patch: Partial<H5Config>) => {
    updateActiveProject((p) => ({ ...p, h5: { ...p.h5, ...patch } }));
  };

  const trend = activeProject.stats?.trend || [8, 12, 19, 15, 22, 24, 28];
  const maxTrend = Math.max(...trend, 1);
  const polylinePoints = trend
    .map((v, i) => `${4 + i * 17},${32 - Math.round((v / maxTrend) * 24)}`)
    .join(' ');

  const h5SnsList = [
    { key: 'x', label: 'X', val: activeProject.fields.x },
    { key: 'weibo', label: '微博', val: activeProject.fields.weibo },
    { key: 'bilibili', label: 'B站', val: activeProject.fields.bilibili },
    { key: 'xhs', label: '小红书', val: activeProject.fields.xhs },
    { key: 'website', label: '网址', val: activeProject.fields.website },
  ].filter((item) => item.val && activeProject.h5.showSns[item.key as keyof H5Config['showSns']]);

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <div className="flex items-center gap-3">
          <Link
            to="/editor"
            className="w-10 h-10 rounded-[0_12px_0_12px] border border-[#E9E9E7] bg-white flex items-center justify-center text-[#333333] hover:border-[#F39800]"
            aria-label="返回编辑器"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="text-sm font-semibold text-[#333333] flex items-center gap-2">
            <Link to="/editor" className="hover:text-[#D95F00]">编辑器</Link>
            <span className="text-[#BFBFBF]">/</span>
            <span>Phygital 双栖视图</span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-[#535353]">
            <span className="text-[#FF7600]">✦</span> {lastSavedAt}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/works" className="ws-nav-btn">我的作品</Link>
          <Link to="/export" className="ws-export-btn">前往导出 →</Link>
        </div>
      </header>

      <section className="w-[min(1240px,calc(100%-32px))] mx-auto my-5 flex-1 grid lg:grid-cols-[1fr_110px_360px] gap-5 items-stretch">
        {/* 左栏：实体名片画布与 H5 定制 */}
        <section className="bg-white border border-[#E9E9E7] rounded-[0_32px_0_32px] p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-[#333333]">实体名片联动预览</h1>
            <div className="inline-flex bg-[#F0F0F0] rounded-full p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCardSide('front')}
                className={`px-3.5 py-1 rounded-full cursor-pointer ${
                  cardSide === 'front' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                正面
              </button>
              <button
                type="button"
                onClick={() => setCardSide('back')}
                className={`px-3.5 py-1 rounded-full cursor-pointer ${
                  cardSide === 'back' ? 'bg-white text-[#D95F00] shadow-sm' : 'text-[#535353]'
                }`}
              >
                反面
              </button>
            </div>
          </div>

          <div className="stage-backdrop rounded-[0_18px_0_18px] p-6 min-h-[230px]">
            <div className={activeProject.orient === 'v' ? 'w-32' : activeProject.orient === 's' ? 'w-48' : 'w-80'}>
              <CardFaceView project={activeProject} template={tpl} side={cardSide} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#535353]">
              <label htmlFor="phyBioInput">制作人简介（选填，60 字内）</label>
              <span>{activeProject.h5.bio.length} / 60</span>
            </div>
            <textarea
              id="phyBioInput"
              maxLength={60}
              value={activeProject.h5.bio}
              onChange={(e) => updateH5({ bio: e.target.value })}
              placeholder="如：主推初星学园全员，欢迎 Live 现场交换名刺！"
              className="prd-input !min-h-[68px] resize-none text-xs"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-[#535353] mb-1">H5 显示的社交账号</div>
              {(
                [
                  ['x', 'X / Twitter'],
                  ['weibo', '微博'],
                  ['bilibili', 'B站 UID'],
                  ['xhs', '小红书'],
                  ['website', '个人网站'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between py-1 border-b border-[#F0F0F0] cursor-pointer">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={activeProject.h5.showSns[k]}
                    onChange={(e) =>
                      updateH5({
                        showSns: { ...activeProject.h5.showSns, [k]: e.target.checked },
                      })
                    }
                  />
                </label>
              ))}
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-[#535353]">H5 页面布局风格</div>
              {(
                [
                  ['card', '卡片式（居中学园风）'],
                  ['poster', '海报式（左对齐视觉）'],
                  ['list', '极简列表（高效名录）'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateH5({ layout: id })}
                  className={`w-full prd-chip !justify-start !text-xs ${
                    activeProject.h5.layout === id ? 'is-active' : ''
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 中栏：同步指示 */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-0.5 flex-1 max-h-20 bg-gradient-to-b from-transparent to-[#F39800]" />
          <div className="w-11 h-11 rounded-full bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white text-xl flex items-center justify-center shadow">
            ✦
          </div>
          <div className="text-xs font-semibold text-[#D95F00] leading-snug">视觉风格与核心资料已自动映射</div>
          <div className="w-0.5 flex-1 max-h-20 bg-gradient-to-t from-transparent to-[#F39800]" />
        </div>

        {/* 右栏：375px 手机样机预览 */}
        <section className="flex items-center justify-center">
          <div className="phone-frame-outer">
            <div className="w-full h-full bg-white rounded-[36px] overflow-y-auto flex flex-col">
              <div
                className={`text-white p-6 ${
                  activeProject.h5.layout === 'poster'
                    ? 'text-left rounded-br-[36px] pt-10'
                    : activeProject.h5.layout === 'list'
                      ? 'flex items-center gap-3.5 text-left py-5'
                      : 'text-center pt-9'
                }`}
                style={{ background: `linear-gradient(135deg, ${activeProject.color}, #F39800)` }}
              >
                <div className="w-16 h-16 rounded-full border-2 border-white/90 bg-white/20 flex items-center justify-center text-2xl font-bold mx-auto overflow-hidden shrink-0">
                  {activeProject.standee.enabled && activeProject.standee.dataUrl ? (
                    <img src={activeProject.standee.dataUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(activeProject.fields.name || 'P').slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <div className="text-lg font-bold mt-2">{activeProject.fields.name}</div>
                  <div className="text-[11px] opacity-85 uppercase tracking-wider">{activeProject.fields.enName}</div>
                  <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-white/25 text-xs font-bold">
                    {activeProject.fields.title}
                  </span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-3.5 text-xs">
                <div className="text-center font-semibold text-[#535353]">{activeProject.fields.company}</div>
                {activeProject.h5.bio && (
                  <div className="p-3 rounded-[0_14px_0_14px] bg-[#F0F0F0] text-[#333333] leading-relaxed">
                    {activeProject.h5.bio}
                  </div>
                )}
                <div className={`grid gap-2 ${activeProject.h5.layout === 'list' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {h5SnsList.map((s) => (
                    <div key={s.key} className="p-2.5 rounded-[0_12px_0_12px] border border-[#E9E9E7]">
                      <div className="font-bold text-[#333333]">{s.label}</div>
                      <div className="text-[11px] text-[#535353] truncate">{s.val}</div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    recordCardSave(activeProject.id);
                    showToast('已模拟保存联系人，统计已累加 ✦', 'success');
                  }}
                  className="mt-auto btn-cta btn-cta--sm w-full"
                >
                  交换名刺 · 保存联系人
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* 底部动态二维码与访问统计条 */}
      <footer className="bg-white border-t border-[#E9E9E7] px-6 py-3.5">
        <div className="w-[min(1240px,100%)] mx-auto grid lg:grid-cols-[1.5fr_auto_1fr] items-center gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-[#E9E9E7] rounded-[0_12px_0_12px] overflow-hidden bg-[#F0F0F0] flex-1 min-w-[220px]">
                <span className="px-2.5 py-2 text-xs text-[#535353] border-r border-[#E9E9E7] font-mono">
                  slug/
                </span>
                <input
                  type="text"
                  aria-label="短链别名"
                  value={activeProject.h5.slug}
                  onChange={(e) => updateH5({ slug: e.target.value })}
                  className="flex-1 bg-white px-2.5 py-2 text-xs font-mono font-semibold text-[#333333] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    showToast('已复制离线数字名片 URL ✦', 'success');
                  } catch {
                    showToast('已准备链接，可直接打开实机页复制', 'info');
                  }
                }}
                className="prd-chip !min-h-[36px] !text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                复制短链
              </button>

              <button
                type="button"
                onClick={() => {
                  const hashIdx = shareUrl.indexOf('#/card');
                  navigate(hashIdx >= 0 ? shareUrl.slice(hashIdx + 1) : '/card');
                }}
                className="btn-cta btn-cta--sm !min-h-[36px] !text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                打开 H5 实机页 ↗
              </button>
            </div>
            <p className="text-[11px] text-[#D95F00]">
              二维码采用 Base64url 紧凑载荷，免后端即可在任何手机扫码打开当前最新设计
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 h-16 p-1 rounded border border-[#E9E9E7] bg-white" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${activeProject.fields.name || 'card'}_qr.svg`;
                a.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 800);
                showToast('已下载矢量 QR 二维码 SVG', 'success');
              }}
              className="text-xs font-bold text-[#D95F00] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              SVG
            </button>
          </div>

          <div className="flex items-center justify-end gap-5">
            <div>
              <div className="text-xl font-bold text-[#333333]" style={{ fontFamily: 'var(--font-rounded)' }}>
                {activeProject.stats.pv}
              </div>
              <div className="text-[11px] text-[#535353]">累计访问 PV</div>
            </div>
            <div>
              <div className="text-xl font-bold text-[#333333]" style={{ fontFamily: 'var(--font-rounded)' }}>
                {activeProject.stats.saves}
              </div>
              <div className="text-[11px] text-[#535353]">保存通讯录</div>
            </div>
            <div>
              <svg width="110" height="36" viewBox="0 0 110 36" fill="none" aria-label="近7日访问趋势">
                <polyline
                  points={polylinePoints}
                  stroke="#FF7600"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-[11px] text-[#535353]">近 7 日实时趋势</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

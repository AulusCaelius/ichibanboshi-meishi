import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, CreditCard, Sparkles, UserPlus } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { decodeSharePayload } from '../engines/shareCodec';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

export function DigitalCardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    activeProject,
    works,
    getTemplate,
    selectTemplate,
    recordCardVisit,
    recordCardSave,
  } = useStudioStore();
  const { showToast } = useToastStore();

  const decoded = useMemo(() => {
    const d = searchParams.get('d');
    return d ? decodeSharePayload(d) : null;
  }, [searchParams]);

  const slugParam = searchParams.get('slug');
  const matchedWork = slugParam ? works.find((w) => w.h5.slug === slugParam) : undefined;
  const card = decoded || matchedWork || activeProject;
  const tpl = getTemplate(card.tplId);

  const [showPhysicalModal, setShowPhysicalModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    recordCardVisit(slugParam || card.id);
    // Count visit once on mount per URL target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugParam]);

  const handleCopy = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(label);
      showToast(`已复制 ${label}: ${val}`, 'success');
      window.setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      showToast(`请手动复制：${val}`, 'info');
    }
  };

  const handleDownloadVcf = () => {
    const f = card.fields;
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${f.name}`,
      `TITLE:${f.title}`,
      `ORG:${f.company}`,
      f.website ? `URL:https://${f.website.replace(/^https?:\/\//, '')}` : '',
      `NOTE:${f.motto} | X:${f.x} | Bilibili:${f.bilibili}`,
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\n');
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (f.name || 'producer')
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/^_+|_+$/g, '');
    a.download = `${safeName || 'producer'}-meishi.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    recordCardSave(slugParam || card.id);
    showToast('已保存联系人 .vcf 并同步统计 ✦', 'success');
  };

  const handles = [
    { key: 'x', label: 'X / Twitter', val: card.fields.x },
    { key: 'weibo', label: '微博', val: card.fields.weibo },
    { key: 'bilibili', label: 'B站 UID', val: card.fields.bilibili },
    { key: 'xhs', label: '小红书', val: card.fields.xhs },
    { key: 'website', label: '个人网址', val: card.fields.website },
  ].filter(
    (h) =>
      Boolean(h.val) &&
      card.h5.showSns[h.key as keyof typeof card.h5.showSns] !== false,
  );

  return (
    <div className="min-h-screen bg-[#F0F0F0] relative flex flex-col">
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          background:
            'radial-gradient(circle at 25% 18%, #FF7600 0%, transparent 52%), radial-gradient(circle at 80% 78%, #F39800 0%, transparent 48%)',
        }}
      />

      <header className="relative z-10 h-[60px] px-6 bg-white/90 backdrop-blur border-b border-[#E9E9E7] flex items-center justify-between gap-3">
        <Link to="/" className="text-base font-bold text-[#333333] flex items-center gap-2">
          <span>一番星 <i className="not-italic text-[#FF7600]">✦</i></span>
          <span className="text-[11px] font-semibold tracking-[0.16em] text-[#D95F00]">
            H5 MEISHI
          </span>
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPhysicalModal(true)}
            className="h-9 px-3.5 rounded-[0_12px_0_12px] border border-[#E9E9E7] bg-white text-xs font-bold text-[#333333] hover:border-[#F39800] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#FF7600]" />
            查看实体名刺
          </button>

          <button
            type="button"
            onClick={() => {
              selectTemplate(tpl.id);
              navigate('/editor');
            }}
            className="h-9 px-4 rounded-[0_12px_0_12px] bg-gradient-to-r from-[#FF7600] to-[#F39800] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            我也要制作 ✦
          </button>
        </div>
      </header>

      <section className="relative z-10 flex-1 py-8 px-4 flex flex-col items-center justify-center gap-4">
        <div className="w-[min(410px,100%)] rounded-[0_32px_0_32px] overflow-hidden bg-white border border-[#FF7600]/20 shadow-xl flex flex-col">
          <div
            className={`text-white p-7 ${
              card.h5.layout === 'poster'
                ? 'text-left rounded-br-[36px] pt-10'
                : card.h5.layout === 'list'
                  ? 'flex items-center gap-4 text-left py-5'
                  : 'text-center pt-9'
            }`}
            style={{ background: `linear-gradient(135deg, ${card.color}, #F39800)` }}
          >
            <div className="w-20 h-20 rounded-full border-[3px] border-white/90 bg-white/20 flex items-center justify-center text-3xl font-bold mx-auto overflow-hidden shadow-lg shrink-0">
              {card.standee.enabled && card.standee.dataUrl ? (
                <img src={card.standee.dataUrl} alt="artwork" className="w-full h-full object-cover" />
              ) : (
                <span>{(card.fields.name || 'P').slice(0, 1)}</span>
              )}
            </div>
            <div>
              <h1 className="text-[22px] font-bold mt-2.5">{card.fields.name}</h1>
              {card.fields.enName && (
                <div className="text-xs opacity-85 uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-display-en)' }}>
                  {card.fields.enName}
                </div>
              )}
              {card.fields.title && (
                <span className="inline-block mt-2.5 px-3.5 py-1 rounded-full bg-white/25 text-xs font-bold">
                  {card.fields.title}
                </span>
              )}
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col gap-4">
            <div className="text-center text-sm font-semibold text-[#535353]">{card.fields.company}</div>

            {card.h5.bio && (
              <div className="p-3.5 rounded-[0_16px_0_16px] bg-[#F0F0F0] text-xs text-[#333333] leading-relaxed">
                {card.h5.bio}
              </div>
            )}

            {card.fields.motto && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#FFF7EC] text-[#D95F00] text-xs font-semibold">
                ♪ {card.fields.motto}
              </div>
            )}

            <div className={`grid gap-2.5 ${card.h5.layout === 'list' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {handles.map((h) => (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => void handleCopy(h.label, h.val)}
                  className="p-3 rounded-[0_14px_0_14px] border border-[#E9E9E7] hover:border-[#FF7600] hover:bg-[#FFF7EC] text-left cursor-pointer transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#333333]">{h.label}</div>
                    <div className="text-[11px] text-[#535353] truncate">{h.val}</div>
                  </div>
                  {copiedKey === h.label ? (
                    <Check className="w-3.5 h-3.5 text-[#008969] shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#BFBFBF] shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <button type="button" onClick={handleDownloadVcf} className="btn-cta w-full mt-2">
              <UserPlus className="w-4 h-4" />
              交换名刺 · 保存联系人 (.vcf)
            </button>
          </div>
        </div>

        <div className="px-4 py-2 rounded-full bg-white/90 border border-[#FF7600]/25 text-xs font-semibold text-[#D95F00]">
          ✦ 访问 PV：{card.stats.pv} · 通讯录保存：{card.stats.saves}
        </div>
      </section>

      {/* 实体正反面对照浮层 */}
      {showPhysicalModal && (
        <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-label="实体名刺对照预览">
          <div className="auth-modal__dialog !w-[min(760px,100%)]">
            <div className="auth-modal__head">
              <div>
                <div className="auth-modal__eyebrow">✦ PHYSICAL CARD对照</div>
                <h2 className="auth-modal__title">实体名刺正反对照预览</h2>
              </div>
              <button type="button" onClick={() => setShowPhysicalModal(false)} className="auth-modal__close cursor-pointer">×</button>
            </div>
            <div className="stage-backdrop rounded-[0_20px_0_20px] p-6 grid sm:grid-cols-2 gap-6">
              <div>
                <div className="text-center text-xs font-bold text-[#535353] mb-2">正面</div>
                <CardFaceView project={card} template={tpl} side="front" />
              </div>
              <div>
                <div className="text-center text-xs font-bold text-[#535353] mb-2">背面</div>
                <CardFaceView project={card} template={tpl} side="back" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

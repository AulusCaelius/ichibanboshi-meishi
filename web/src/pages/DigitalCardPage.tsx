import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, FlipHorizontal2, Sparkles, UserPlus } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { decodeSharePayload } from '../engines/shareCodec';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

export function DigitalCardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeProject, getTemplate, selectTemplate } = useStudioStore();
  const { showToast } = useToastStore();

  const decoded = useMemo(() => {
    const d = searchParams.get('d');
    return d ? decodeSharePayload(d) : null;
  }, [searchParams]);

  const card = decoded || activeProject;
  const tpl = getTemplate(card.tplId);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [copiedKey, setCopiedKey] = useState('');

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
    a.download = `${f.name || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('已下载 vCard 通讯录文件', 'success');
  };

  const handles = [
    { label: 'X / Twitter', val: card.fields.x },
    { label: 'B站主页', val: card.fields.bilibili },
    { label: '微博', val: card.fields.weibo },
    { label: '小红书 / 作品集', val: card.fields.xhs },
    { label: '个人网址', val: card.fields.website },
  ].filter((h) => Boolean(h.val));

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white border border-slate-200 leaf-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF7600]">
              ICHIBANBOSHI DIGITAL CARD
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-0.5">{card.fields.name}</h1>
            <p className="text-xs text-slate-500">
              {card.fields.title} · {card.fields.company}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSide(side === 'front' ? 'back' : 'front')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
          >
            <FlipHorizontal2 className="w-3.5 h-3.5 text-[#FF7600]" />
            翻面
          </button>
        </div>

        <div className="flex justify-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <div className={card.orient === 'v' ? 'w-56' : card.orient === 's' ? 'w-64' : 'w-full'}>
            <CardFaceView project={card} template={tpl} side={side} />
          </div>
        </div>

        {card.fields.motto && (
          <blockquote className="text-xs italic text-slate-600 bg-orange-50/60 border-l-2 border-[#FF7600] px-3 py-2 rounded-r-lg">
            “{card.fields.motto}”
          </blockquote>
        )}

        <div className="space-y-2">
          {handles.map((h) => (
            <button
              key={h.label}
              type="button"
              onClick={() => void handleCopy(h.label, h.val)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 hover:border-[#FF7600] bg-white text-left text-xs cursor-pointer transition"
            >
              <div>
                <span className="font-bold text-slate-500 mr-2">{h.label}</span>
                <span className="font-semibold text-slate-900">{h.val}</span>
              </div>
              {copiedKey === h.label ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleDownloadVcf}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            存入通讯录 (.vcf)
          </button>
          <button
            type="button"
            onClick={() => {
              selectTemplate(tpl.id);
              navigate('/editor');
            }}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl btn-brand text-xs font-bold cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            使用同款模板制作
          </button>
        </div>
      </div>
    </div>
  );
}

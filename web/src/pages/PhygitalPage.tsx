import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, ExternalLink, QrCode } from 'lucide-react';
import { CardFaceView } from '../components/CardFaceView';
import { renderQrSvg } from '../engines/qrcode';
import { buildCardShareUrl } from '../engines/shareCodec';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';

export function PhygitalPage() {
  const navigate = useNavigate();
  const { activeProject, getTemplate } = useStudioStore();
  const { showToast } = useToastStore();
  const tpl = getTemplate(activeProject.tplId);

  const shareUrl = useMemo(() => buildCardShareUrl(activeProject), [activeProject]);
  const qrSvg = useMemo(
    () => renderQrSvg(shareUrl, { fg: '#0F172A', bg: '#FFFFFF', border: 3, ariaLabel: '名片二维码' }),
    [shareUrl],
  );

  const handleDownloadQrSvg = () => {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.fields.name || 'card'}_qrcode.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('已下载矢量 QR 二维码 SVG', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">实体卡片 × 数字 H5 名片联动</h1>
        <p className="text-sm text-slate-500 mt-1">
          采用离线 Base64url 紧凑编码 URL，即使不部署任何后端服务器，扫码即可在他人手机浏览器秒开您的专属名刺页面
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-white border border-slate-200 leaf-card p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <QrCode className="w-5 h-5 text-[#FF7600]" />
            实体背面二维码物料
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div
              className="w-40 h-40 bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-slate-900 text-sm">{activeProject.fields.name}</div>
              <p className="text-slate-600 leading-relaxed">
                将背面二维码印制在实体名刺上，交流对象扫码后即可直达移动端数字名片，并一键保存 vCard 联系人或复制您的社交句柄。
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadQrSvg}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载纯矢量 QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const hashIdx = shareUrl.indexOf('#/card');
                    navigate(hashIdx >= 0 ? shareUrl.slice(hashIdx + 1) : '/card');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg btn-brand font-bold cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  预览移动端落地页
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-600">数字名片分享链接</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    showToast('已复制数字名片链接', 'success');
                  } catch {
                    showToast('请手动选中文本框复制链接', 'info');
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                复制
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 leaf-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">正反实体联动预览</h2>
            <span className="text-xs text-slate-500">背面内置上方同源二维码</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <CardFaceView project={activeProject} template={tpl} side="front" />
            <CardFaceView project={activeProject} template={tpl} side="back" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          <span className="font-bold text-slate-800">一番星 ICHIBANBOSHI · 纯本地个性名刺工坊</span>
          <p className="mt-1">
            React 19 + TypeScript + Zustand + Three.js PBR + DeviceCMYK 印刷引擎 · 零服务器上传，所有草稿、图片与模板均持久保存在本地浏览器与可导出工程文件。
          </p>
        </div>
        <div className="flex flex-wrap gap-4 font-semibold text-slate-600">
          <Link to="/templates" className="hover:text-[#FF7600]">通用模板库</Link>
          <Link to="/editor" className="hover:text-[#FF7600]">在线设计台</Link>
          <Link to="/works" className="hover:text-[#FF7600]">本地资产与备份</Link>
          <Link to="/export" className="hover:text-[#FF7600]">CMYK 印前导出</Link>
        </div>
      </div>
    </footer>
  );
}

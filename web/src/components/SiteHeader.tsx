import { NavLink } from 'react-router-dom';
import { FolderSync, HardDrive, Sparkles, UserCircle2 } from 'lucide-react';
import { useStudioStore } from '../stores/useStudioStore';

interface SiteHeaderProps {
  onOpenBackup: () => void;
  onOpenProfile: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: '首页概览', end: true },
  { to: '/templates', label: '通用模板库', end: false },
  { to: '/editor', label: '在线设计台', end: false },
  { to: '/works', label: '本地资产库', end: false },
  { to: '/phygital', label: '数字名片', end: false },
  { to: '/export', label: '印前导出', end: false },
];

export function SiteHeader({ onOpenBackup, onOpenProfile }: SiteHeaderProps) {
  const { works, customTemplates, profile } = useStudioStore();

  return (
    <header className="sticky top-0 z-40 glass-nav border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-9 h-9 rounded-tr-xl rounded-bl-xl bg-gradient-to-br from-[#FF7600] to-[#F39800] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="leading-tight">
            <div className="font-black tracking-tight text-slate-900 text-base">
              一番星 <span className="text-[#FF7600]">MEISHI</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500">纯本地 · 个性名刺工坊</div>
          </div>
        </NavLink>

        <nav className="hidden lg:flex items-center gap-1" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-[#FF7600]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium"
            title="所有名片与模板修改实时存储在浏览器 IndexedDB 中"
          >
            <HardDrive className="w-3.5 h-3.5" />
            本地已存 {works.length} 卡 / {customTemplates.length} 模板
          </span>

          <button
            type="button"
            onClick={onOpenBackup}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer"
          >
            <FolderSync className="w-4 h-4 text-[#FF7600]" />
            <span>导入 / 备份</span>
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <UserCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline max-w-[96px] truncate">{profile.nickname}</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <nav className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2.5 text-xs font-semibold" aria-label="移动端导航">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-full whitespace-nowrap ${
                isActive ? 'bg-[#FF7600] text-white' : 'bg-slate-100 text-slate-600'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

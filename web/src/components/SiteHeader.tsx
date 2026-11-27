import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FolderSync } from 'lucide-react';
import { useStudioStore } from '../stores/useStudioStore';

interface SiteHeaderProps {
  onOpenBackup: () => void;
  onOpenProfile: () => void;
}

export function SiteHeader({ onOpenBackup, onOpenProfile }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { profile, works, customTemplates } = useStudioStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToHomeAnchor = (hashId: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById(hashId)?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } else {
      document.getElementById(hashId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const badgeColor = profile.tantouColor || '#FF7600';

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="prd-container site-header__inner">
        <Link to="/" className="brand-logo" aria-label="一番星 首页">
          <span className="brand-logo__main">
            一番星 <i className="brand-logo__star" aria-hidden="true">✦</i>
          </span>
          <span className="brand-logo__sub">ICHIBANBOSHI</span>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          <NavLink
            to="/templates"
            className={({ isActive }) => `nav-link ${isActive ? 'is-current' : ''}`}
          >
            <span className="nav-link__zh">模板库</span>
            <span className="nav-link__en">TEMPLATES</span>
          </NavLink>

          <NavLink
            to="/works"
            className={({ isActive }) => `nav-link ${isActive ? 'is-current' : ''}`}
          >
            <span className="nav-link__zh">我的作品</span>
            <span className="nav-link__en">WORKS</span>
          </NavLink>

          <button
            type="button"
            onClick={() => scrollToHomeAnchor('features')}
            className="nav-link cursor-pointer"
          >
            <span className="nav-link__zh">功能介绍</span>
            <span className="nav-link__en">FEATURES</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToHomeAnchor('about')}
            className="nav-link cursor-pointer"
          >
            <span className="nav-link__zh">关于</span>
            <span className="nav-link__en">ABOUT</span>
          </button>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            onClick={onOpenBackup}
            className="header-login border border-[#E9E9E7] bg-white/80"
            title={`纯本地已存 ${works.length} 份方案 / ${customTemplates.length} 套自定义模板`}
          >
            <FolderSync className="w-4 h-4 text-[#FF7600]" />
            <span>导入 / 备份</span>
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            className="header-user-pill"
            title="点击配置制作人名籍与预设担当信息"
          >
            <span className="header-user-pill__dot" style={{ backgroundColor: badgeColor }} />
            <span className="header-user-pill__name">
              {profile.nickname || '制作人报到'}
            </span>
          </button>

          <Link to="/templates" className="btn-cta btn-cta--sm">
            免费开始设计
          </Link>
        </div>
      </div>
    </header>
  );
}

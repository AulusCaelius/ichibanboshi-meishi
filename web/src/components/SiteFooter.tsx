import { Link } from 'react-router-dom';

interface SiteFooterProps {
  onOpenBackup: () => void;
}

export function SiteFooter({ onOpenBackup }: SiteFooterProps) {
  return (
    <footer id="about" className="site-footer">
      <div className="bg-text bg-text--white site-footer__bg-text" aria-hidden="true">
        ICHIBANBOSHI
      </div>

      <div className="prd-container">
        <div className="site-footer__card">
          <div>
            <Link to="/" className="brand-logo" aria-label="一番星">
              <span className="brand-logo__main">
                一番星 <i className="brand-logo__star" aria-hidden="true">✦</i>
              </span>
              <span className="brand-logo__sub">ICHIBANBOSHI</span>
            </Link>
            <p className="mt-3 text-sm text-[#535353] leading-relaxed">
              为偶像延伸文化与多风格独立创作者打造的名刺设计工坊。纯本地 IndexedDB 自动保存与工程备份导入，60 套通用多风格模板、WebGL 三维物理材质与 CMYK 印前直出。
            </p>
          </div>

          <div>
            <div className="footer-col__title">
              <span>产品</span>
              <span className="footer-col__en">PRODUCT</span>
            </div>
            <div className="flex flex-col gap-1">
              <Link to="/templates" className="footer-col__link">60 套通用模板库</Link>
              <Link to="/editor" className="footer-col__link">双模式材质编辑器</Link>
              <Link to="/works" className="footer-col__link">我的作品管理台</Link>
            </div>
          </div>

          <div>
            <div className="footer-col__title">
              <span>资源</span>
              <span className="footer-col__en">RESOURCE</span>
            </div>
            <div className="flex flex-col gap-1">
              <Link to="/export" className="footer-col__link">Preflight 印前质检</Link>
              <Link to="/phygital" className="footer-col__link">Phygital 双栖联动</Link>
              <button type="button" onClick={onOpenBackup} className="footer-col__link text-left cursor-pointer">
                导入 / 导出本地备份
              </button>
            </div>
          </div>

          <div>
            <div className="footer-col__title">
              <span>关于</span>
              <span className="footer-col__en">ABOUT</span>
            </div>
            <div className="flex flex-col gap-1">
              <Link to="/card" className="footer-col__link">H5 电子名刺示例</Link>
              <span className="footer-col__link">SIL OFL 开源字体规范</span>
              <span className="footer-col__link">100% 本地离线可运行</span>
            </div>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>© 2026 一番星 ICHIBANBOSHI · 同人制作 · Fan-made Tool</span>
          <span className="text-xs opacity-90">纯本地存储 · 随时导入导出延续创作</span>
        </div>
      </div>
    </footer>
  );
}

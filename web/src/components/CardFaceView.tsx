import { useMemo } from 'react';
import { renderCardFaceHtml } from '../engines/renderCardHtml';
import type { CardProject, CardTemplate } from '../types/card';

interface CardFaceViewProps {
  project: CardProject;
  template: CardTemplate;
  side?: 'front' | 'back';
  showGuides?: boolean;
  className?: string;
}

export function CardFaceView({
  project,
  template,
  side,
  showGuides = false,
  className = '',
}: CardFaceViewProps) {
  const effectiveSide = side || project.side;
  const html = useMemo(
    () => renderCardFaceHtml(project, template, effectiveSide),
    [project, template, effectiveSide],
  );

  return (
    <div className={`relative w-full ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {showGuides && (
        <div
          className="pointer-events-none absolute inset-[3.4%] border border-dashed border-[#FF7600]/60 rounded"
          aria-hidden="true"
        >
          <span className="absolute -top-4 left-1 text-[10px] font-mono font-semibold text-[#FF7600] bg-white/90 px-1 rounded">
            SAFE ZONE 3mm
          </span>
        </div>
      )}
    </div>
  );
}

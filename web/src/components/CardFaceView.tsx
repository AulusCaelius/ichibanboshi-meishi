import { useMemo } from 'react';
import { renderCardFaceHtml } from '../engines/renderCardHtml';
import type { CardProject, CardTemplate, EditableRegionId } from '../types/card';

interface CardFaceViewProps {
  project: CardProject;
  template: CardTemplate;
  side?: 'front' | 'back';
  flipOnHover?: boolean;
  showGuides?: boolean;
  showBleedGuide?: boolean;
  showTrimGuide?: boolean;
  showSafeGuide?: boolean;
  focusedRegion?: EditableRegionId;
  onRegionClick?: (region: EditableRegionId) => void;
  className?: string;
}

export function CardFaceView({
  project,
  template,
  side,
  flipOnHover = false,
  showGuides = false,
  showBleedGuide,
  showTrimGuide,
  showSafeGuide,
  focusedRegion,
  onRegionClick,
  className = '',
}: CardFaceViewProps) {
  const effectiveSide = side || project.side;
  const frontHtml = useMemo(
    () => renderCardFaceHtml(project, template, effectiveSide, focusedRegion),
    [project, template, effectiveSide, focusedRegion],
  );
  const backHtml = useMemo(
    () =>
      flipOnHover && project.sides === 2
        ? renderCardFaceHtml(project, template, 'back', focusedRegion)
        : '',
    [flipOnHover, project, template, focusedRegion],
  );

  const safeVisible = showSafeGuide ?? showGuides;
  const bleedVisible = showBleedGuide ?? false;
  const trimVisible = showTrimGuide ?? false;

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onRegionClick) return;
    const target = (e.target as HTMLElement).closest('[data-region]');
    if (target) {
      const reg = target.getAttribute('data-region') as EditableRegionId | null;
      if (reg) onRegionClick(reg);
    }
  };

  if (flipOnHover) {
    const isDouble = project.sides === 2;
    return (
      <div className={`bcard-flip-wrap ${isDouble ? 'is-double' : 'is-single'} ${className}`}>
        <div className="bcard-flip-inner">
          <div className="bcard-flip-front" dangerouslySetInnerHTML={{ __html: frontHtml }} />
          {isDouble && backHtml && (
            <div className="bcard-flip-back" dangerouslySetInnerHTML={{ __html: backHtml }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`} onClick={handleContainerClick}>
      <div dangerouslySetInnerHTML={{ __html: frontHtml }} />
      {bleedVisible && (
        <div
          className="pointer-events-none absolute -inset-[3%] border border-dashed border-[#E30F25]/75 rounded-sm z-20"
          aria-hidden="true"
        />
      )}
      {trimVisible && (
        <div
          className="pointer-events-none absolute inset-0 border border-[#333333]/65 z-20"
          aria-hidden="true"
        />
      )}
      {safeVisible && (
        <div
          className="pointer-events-none absolute inset-[3.4%] border border-dashed border-[#4E93F2]/80 rounded-sm z-20"
          aria-hidden="true"
        >
          <span className="absolute -top-4 left-1 text-[10px] font-mono font-semibold text-[#4E93F2] bg-white/90 px-1 rounded">
            SAFE ZONE 3mm
          </span>
        </div>
      )}
    </div>
  );
}

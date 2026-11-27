import { useEffect, useRef, useState } from 'react';
import { RotateCw, Sun } from 'lucide-react';
import { mountPreview3D, type Preview3DController } from '../engines/preview3d';
import type { CardProject, CardTemplate, RenderEnvId } from '../types/card';

interface CardPreview3DProps {
  project: CardProject;
  template: CardTemplate;
  heightClass?: string;
  compact?: boolean;
  paused?: boolean;
}

export function CardPreview3D({
  project,
  template,
  heightClass = 'h-[440px]',
  compact = false,
  paused = false,
}: CardPreview3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ctrlRef = useRef<Preview3DController | null>(null);
  const [env, setEnv] = useState<RenderEnvId>('studio');
  const [lightDeg, setLightDeg] = useState(120);
  const [autoRotate, setAutoRotate] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ctrl = mountPreview3D(el, project, template, {
      env,
      autoRotate,
      compact,
    });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
    // Mount once per component instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  useEffect(() => {
    ctrlRef.current?.update(project, template);
  }, [project, template]);

  useEffect(() => {
    ctrlRef.current?.setPaused(paused);
  }, [paused]);

  if (compact) {
    return (
      <div
        ref={hostRef}
        className={`w-full ${heightClass} rounded-[0_16px_0_16px] overflow-hidden bg-[#F0F0F0] relative`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={hostRef}
          className={`w-full ${heightClass} rounded-[0_20px_0_20px] overflow-hidden border border-[#E9E9E7] bg-[#F0F0F0]`}
        />
        <span className="pointer-events-none absolute right-3 bottom-3 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[11px] font-semibold text-[#535353]">
          左键拖拽旋转 · 滚轮缩放 · 双击复位
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['front', '正面'],
              ['back', '背面'],
              ['side', '侧面厚度'],
              ['macro', '微距材质'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => ctrlRef.current?.setView(id)}
              className="prd-chip !min-h-[34px] !px-3 !text-xs"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[#E9E9E7] bg-white p-0.5">
            {(
              [
                ['studio', '柔光影棚'],
                ['stage', '舞台聚光'],
                ['sunlit', '学园窗光'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setEnv(id);
                  ctrlRef.current?.setEnv(id);
                }}
                className={`px-2.5 py-1 rounded-full font-semibold cursor-pointer ${
                  env === id ? 'bg-[#FF7600] text-white' : 'text-[#535353]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E9E9E7] bg-white">
            <Sun className="w-3.5 h-3.5 text-[#FF7600]" />
            <input
              type="range"
              min={0}
              max={360}
              value={lightDeg}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLightDeg(v);
                ctrlRef.current?.setLight(v);
              }}
              aria-label="主光源角度"
              className="w-20 accent-[#FF7600]"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              const next = !autoRotate;
              setAutoRotate(next);
              ctrlRef.current?.setAutoRotate(next);
            }}
            className={`prd-chip !min-h-[34px] !px-3 !text-xs ${autoRotate ? 'is-active' : ''}`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            自动旋转
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { RotateCw, Sun } from 'lucide-react';
import { mountPreview3D, type Preview3DController } from '../engines/preview3d';
import type { CardProject, CardTemplate, RenderEnvId } from '../types/card';

interface CardPreview3DProps {
  project: CardProject;
  template: CardTemplate;
  heightClass?: string;
}

export function CardPreview3D({
  project,
  template,
  heightClass = 'h-[420px]',
}: CardPreview3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ctrlRef = useRef<Preview3DController | null>(null);
  const [env, setEnv] = useState<RenderEnvId>('studio');
  const [lightDeg, setLightDeg] = useState(120);
  const [autoRotate, setAutoRotate] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ctrl = mountPreview3D(el, project, template, { env, autoRotate });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
    // Mount once; updates below synchronize project/template/env smoothly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ctrlRef.current?.update(project, template);
  }, [project, template]);

  return (
    <div className="space-y-3">
      <div
        ref={hostRef}
        className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['front', '正面视角'],
              ['back', '背面二维码'],
              ['side', '侧边纸厚'],
              ['macro', '微距材质'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => ctrlRef.current?.setView(id)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#FF7600] font-semibold text-slate-700 cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(
              [
                ['studio', '摄影棚'],
                ['stage', '展厅暗调'],
                ['sunlit', '窗边暖光'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setEnv(id);
                  ctrlRef.current?.setEnv(id);
                }}
                className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                  env === id ? 'bg-[#FF7600] text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
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
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer ${
              autoRotate
                ? 'border-[#FF7600] bg-orange-50 text-[#FF7600]'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            自动旋转
          </button>
        </div>
      </div>
    </div>
  );
}

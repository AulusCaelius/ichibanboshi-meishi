import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useToastStore } from '../stores/useToastStore';

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'warning'
              ? AlertTriangle
              : t.type === 'error'
                ? XCircle
                : Info;
        const ring =
          t.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
            : t.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : t.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-950'
                : 'border-slate-200 bg-white text-slate-900';

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${ring}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="opacity-60 hover:opacity-100 p-0.5"
              aria-label="关闭通知"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

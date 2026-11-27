import { X } from 'lucide-react';
import { useToastStore } from '../stores/useToastStore';

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((t) => {
        const starColor =
          t.type === 'error'
            ? '#E30F25'
            : t.type === 'warning'
              ? '#F8C112'
              : '#FF7600';
        return (
          <div key={t.id} role="status" className="toast">
            <span className="toast__star" style={{ color: starColor }} aria-hidden="true">
              ✦
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#535353] hover:bg-[#F0F0F0] cursor-pointer"
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

import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { ROLE_PRESETS } from '../data/templates';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';
import type { CreatorProfile } from '../types/card';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { profile, saveProfile, applyProfileToActive } = useStudioStore();
  const { showToast } = useToastStore();
  const [form, setForm] = useState<CreatorProfile>(profile);

  useEffect(() => {
    if (open) setForm(profile);
  }, [open, profile]);

  if (!open) return null;

  const handleSave = (applyNow: boolean) => {
    saveProfile(form);
    if (applyNow) applyProfileToActive();
    showToast(
      applyNow ? '创作者默认资料已保存并同步至当前名片' : '创作者默认资料已保存至本地',
      'success',
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg leaf-card border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">本地创作者预设资料</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              切换任意通用模板时自动带入您的个人名刺常用信息（仅存本地）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label="关闭弹窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3.5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-600">常用姓名 / 昵称</span>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600">工作室 / 归属</span>
              <input
                type="text"
                value={form.studioName}
                onChange={(e) => setForm({ ...form, studioName: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">默认创作头衔（可选预设或自由输入）</span>
            <input
              type="text"
              value={form.roleTitle}
              onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ROLE_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, roleTitle: r })}
                  className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-orange-50 hover:text-[#FF7600] text-[11px] font-medium text-slate-600 cursor-pointer"
                >
                  {r}
                </button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-600">X / Twitter</span>
              <input
                type="text"
                value={form.x}
                onChange={(e) => setForm({ ...form, x: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600">B站主页 / UID</span>
              <input
                type="text"
                value={form.bilibili}
                onChange={(e) => setForm({ ...form, bilibili: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">个人网站 / 作品集网址</span>
            <input
              type="text"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">默认个性签名</span>
            <input
              type="text"
              value={form.motto}
              onChange={(e) => setForm({ ...form, motto: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF7600]"
            />
          </label>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer"
          >
            仅保存默认资料
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-brand text-xs font-bold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            保存并应用到当前名片
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { COMPANY_PRESETS, IDOL_PRESETS } from '../data/templates';
import { useStudioStore } from '../stores/useStudioStore';
import { useToastStore } from '../stores/useToastStore';
import type { CreatorProfile } from '../types/card';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { profile, saveProfile, applyProfileToActive, setPrefill } = useStudioStore();
  const { showToast } = useToastStore();
  const [form, setForm] = useState<CreatorProfile>(profile);

  useEffect(() => {
    if (open) setForm(profile);
  }, [open, profile]);

  if (!open) return null;

  const handleSave = (applyNow: boolean) => {
    saveProfile(form);
    setPrefill({
      name: form.nickname,
      title: form.roleTitle,
      company: form.studioName,
      accentColor: form.tantouColor || '#FF7600',
    });
    if (applyNow) applyProfileToActive();
    showToast(
      applyNow ? '制作人资料已保存，并已应用到当前名刺 ✦' : '制作人默认名籍已保存至本地 ✦',
      'success',
    );
    onClose();
  };

  return (
    <div className="auth-modal is-open" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
      <div className="auth-modal__dialog max-h-[90vh] overflow-y-auto">
        <div className="auth-modal__head">
          <div>
            <div className="auth-modal__eyebrow">✦ PRODUCER PROFILE</div>
            <h2 id="profileModalTitle" className="auth-modal__title">制作人身份名籍（纯本地）</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="auth-modal__close cursor-pointer"
            aria-label="关闭窗口"
          >
            ×
          </button>
        </div>

        <div className="auth-modal__form">
          <div className="grid grid-cols-2 gap-3">
            <div className="auth-field">
              <label htmlFor="profName">P 名 / 制作人名称</label>
              <input
                id="profName"
                type="text"
                placeholder="制作人Producer"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="profCompany">所属事务所 / 工作室</label>
              <input
                id="profCompany"
                type="text"
                placeholder="初星学園 / 765プロダクション"
                value={form.studioName}
                onChange={(e) => setForm({ ...form, studioName: e.target.value })}
              />
            </div>
          </div>

          <div className="auth-company-chips">
            {COMPANY_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, studioName: c })}
                className="auth-mini-chip cursor-pointer"
              >
                {c}
              </button>
            ))}
          </div>

          <div className="auth-field">
            <label htmlFor="profRole">职位 / 担当偶像（可点选下方担当色或自由输入）</label>
            <input
              id="profRole"
              type="text"
              placeholder="〇〇担当（如：花海咲季担当）"
              value={form.roleTitle}
              onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
            />
            <div className="auth-idol-grid pt-1">
              {IDOL_PRESETS.map((idol) => {
                const active = form.tantou === idol.name || form.roleTitle === `${idol.name}担当`;
                return (
                  <button
                    key={idol.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        tantou: idol.name,
                        tantouColor: idol.color,
                        roleTitle: `${idol.name}担当`,
                      })
                    }
                    className={`auth-idol-chip cursor-pointer ${active ? 'is-active' : ''}`}
                  >
                    <span className="auth-idol-chip__dot" style={{ backgroundColor: idol.color }} />
                    <span>{idol.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="auth-field">
              <label htmlFor="profX">X / Twitter</label>
              <input
                id="profX"
                type="text"
                value={form.x}
                onChange={(e) => setForm({ ...form, x: e.target.value })}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="profBili">B站 UID</label>
              <input
                id="profBili"
                type="text"
                value={form.bilibili}
                onChange={(e) => setForm({ ...form, bilibili: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="auth-field">
              <label htmlFor="profWeb">个人网站</label>
              <input
                id="profWeb"
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="profMotto">喜欢的曲 / Slogan</label>
              <input
                id="profMotto"
                type="text"
                value={form.motto}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="auth-modal__extras justify-end">
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="btn-outline btn-outline--sm"
          >
            仅保存默认资料
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="btn-cta btn-cta--sm"
          >
            保存并应用到当前名片 ✦
          </button>
        </div>
      </div>
    </div>
  );
}

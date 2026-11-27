/**
 * 全站通用交互与双模制作人身份系统 (v1.0)
 * - 服务端在线模式：真实用户名+密码注册/登录/编辑名籍/退出，自动同步作品与收藏
 * - 静态/离线模式：本地制作人名籍护照持久化
 */

import { IDOLS } from '../core/catalog.mjs';
import * as store from '../core/store.mjs';
import {
  isServerConnected,
  apiRegister,
  apiLogin,
  apiUpdateProfile,
  apiLogout
} from '../core/api-client.mjs';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 80);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function ensureToastRegion() {
  let region = document.getElementById('toastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toastRegion';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

export function showToast(message, duration = 3000) {
  const region = ensureToastRegion();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast__star" aria-hidden="true">✦</span>
    <span class="toast__msg"></span>
    <button type="button" class="toast__close" aria-label="关闭提示">×</button>
  `;
  toast.querySelector('.toast__msg').textContent = message;
  region.appendChild(toast);

  let timer = null;
  let remaining = duration;
  let startAt = Date.now();

  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 260);
  };

  const startTimer = () => {
    startAt = Date.now();
    timer = setTimeout(dismiss, remaining);
  };

  toast.addEventListener('mouseenter', () => {
    if (timer) clearTimeout(timer);
    remaining = Math.max(400, remaining - (Date.now() - startAt));
  });
  toast.addEventListener('mouseleave', startTimer);
  toast.querySelector('.toast__close').addEventListener('click', dismiss);
  startTimer();
  return toast;
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

export function syncModeBadge() {
  const online = isServerConnected();
  document.querySelectorAll('[data-mode-pill]').forEach((el) => {
    el.classList.toggle('is-offline', !online);
    el.textContent = online ? '云端数据库已连接' : '本地离线工作台';
  });
}

export function syncLoginUI() {
  const user = store.getUser();
  document.querySelectorAll('[data-login-btn]').forEach((btn) => {
    if (user) {
      btn.classList.add('header-user-pill');
      btn.innerHTML = `<span class="header-user-pill__dot" style="background:${esc(user.color || '#FF7600')};"></span><span class="header-user-pill__name">${esc(user.name)}</span>`;
      btn.setAttribute('aria-label', `制作人账号：${user.name}`);
    } else {
      btn.classList.remove('header-user-pill');
      btn.textContent = isServerConnected() ? '登录 / 注册' : '制作人护照';
      btn.setAttribute('aria-label', '登录制作人账号');
    }
  });
  syncModeBadge();
  window.dispatchEvent(new CustomEvent('ichiban:auth-changed', { detail: { user } }));
}

function ensureAuthModal() {
  let modal = document.getElementById('authModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'authModalTitle');
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="auth-modal__dialog">
      <div class="auth-modal__head">
        <div>
          <div class="auth-modal__eyebrow">✦ PRODUCER PASSPORT</div>
          <h2 id="authModalTitle" class="auth-modal__title">制作人身份登录</h2>
        </div>
        <button type="button" id="authCloseBtn" class="auth-modal__close" aria-label="关闭登录弹窗">×</button>
      </div>

      <div id="authTabsWrap" class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab-btn is-active" data-auth-tab="login">账号登录</button>
        <button type="button" class="auth-tab-btn" data-auth-tab="register">注册新制作人</button>
        <button type="button" class="auth-tab-btn" data-auth-tab="local">本地名籍</button>
      </div>

      <form id="authForm" class="auth-modal__form">
        <div id="authCredFields">
          <div class="auth-field" style="margin-bottom:10px;">
            <label for="authUsernameInput">账号 ID（3-24 位英文/数字）</label>
            <input id="authUsernameInput" type="text" maxlength="24" placeholder="hatsuboshi_p">
          </div>
          <div class="auth-field">
            <label for="authPasswordInput">密码</label>
            <input id="authPasswordInput" type="password" maxlength="64" placeholder="至少 4 位密码">
          </div>
        </div>

        <div id="authProfileFields">
          <div class="auth-field" style="margin-bottom:10px;">
            <label for="authNameInput">制作人显示名 (P 名)</label>
            <input id="authNameInput" type="text" maxlength="24" placeholder="制作人Producer">
          </div>

          <div class="auth-field" style="margin-bottom:10px;">
            <label>选择主推 / 担当偶像</label>
            <div id="authIdolGrid" class="auth-idol-grid">
              ${IDOLS.map(
                (i) => `
                <button type="button" class="auth-idol-chip" data-auth-idol="${esc(i.name)}" data-auth-color="${esc(i.color)}">
                  <span class="auth-idol-chip__dot" style="background:${esc(i.color)};${i.light ? 'border:1px solid #BFBFBF;' : ''}"></span>
                  <span>${esc(i.name)}</span>
                </button>`
              ).join('')}
            </div>
          </div>

          <div class="auth-field">
            <label for="authCompanyInput">所属事务所</label>
            <input id="authCompanyInput" type="text" maxlength="32" placeholder="初星学園">
            <div class="auth-company-chips">
              <button type="button" class="auth-mini-chip" data-auth-company="初星学園">初星学園</button>
              <button type="button" class="auth-mini-chip" data-auth-company="765プロダクション">765プロダクション</button>
            </div>
          </div>
        </div>

        <div id="authErrMsg" class="auth-error-msg"></div>
        <button type="submit" id="authSubmitBtn" class="btn-cta" style="width:100%;min-height:48px;">登录制作人账号 ✦</button>
      </form>

      <div id="authLoggedExtras" class="auth-modal__extras" hidden>
        <a href="works.html" class="btn-outline btn-cta--sm" style="flex:1;justify-content:center;">前往我的作品</a>
        <button type="button" id="authLogoutBtn" class="auth-logout-btn">退出登录</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#authForm');
  const tabsWrap = modal.querySelector('#authTabsWrap');
  const credFields = modal.querySelector('#authCredFields');
  const profileFields = modal.querySelector('#authProfileFields');
  const usernameInput = modal.querySelector('#authUsernameInput');
  const passwordInput = modal.querySelector('#authPasswordInput');
  const nameInput = modal.querySelector('#authNameInput');
  const companyInput = modal.querySelector('#authCompanyInput');
  const errMsg = modal.querySelector('#authErrMsg');
  const submitBtn = modal.querySelector('#authSubmitBtn');
  const closeBtn = modal.querySelector('#authCloseBtn');
  const logoutBtn = modal.querySelector('#authLogoutBtn');

  let authMode = isServerConnected() ? 'login' : 'local';
  let selectedIdol = IDOLS[0].name;
  let selectedColor = IDOLS[0].color;

  const syncTabUI = () => {
    const serverOn = isServerConnected();
    tabsWrap.querySelector('[data-auth-tab="login"]').hidden = !serverOn;
    tabsWrap.querySelector('[data-auth-tab="register"]').hidden = !serverOn;
    if (!serverOn && authMode !== 'local') authMode = 'local';

    tabsWrap.querySelectorAll('[data-auth-tab]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.authTab === authMode);
    });
    credFields.hidden = authMode === 'local';
    profileFields.hidden = authMode === 'login';
    errMsg.textContent = '';

    if (authMode === 'login') {
      submitBtn.textContent = '登录并同步作品 ✦';
    } else if (authMode === 'register') {
      submitBtn.textContent = '注册并点亮制作人身份 ✦';
    } else {
      submitBtn.textContent = '保存本地制作人护照 ✦';
    }
  };

  tabsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-auth-tab]');
    if (!btn || btn.hidden) return;
    authMode = btn.dataset.authTab;
    syncTabUI();
  });

  const highlightIdol = (idolName) => {
    modal.querySelectorAll('[data-auth-idol]').forEach((btn) => {
      const hit = btn.dataset.authIdol === idolName;
      btn.classList.toggle('is-active', hit);
      if (hit) {
        selectedIdol = btn.dataset.authIdol;
        selectedColor = btn.dataset.authColor;
      }
    });
  };

  modal.querySelector('#authIdolGrid').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-auth-idol]');
    if (chip) highlightIdol(chip.dataset.authIdol);
  });

  modal.querySelectorAll('[data-auth-company]').forEach((btn) => {
    btn.addEventListener('click', () => {
      companyInput.value = btn.dataset.authCompany;
    });
  });

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errMsg.textContent = '';

    if (authMode === 'local') {
      const name = nameInput.value.trim() || '制作人Producer';
      const company = companyInput.value.trim() || '初星学園';
      const current = store.getUser();
      if (isServerConnected() && current && current.id) {
        await apiUpdateProfile({ name, idol: selectedIdol, color: selectedColor, company });
      }
      const saved = store.setLocalUser({
        ...(current || {}),
        name,
        idol: selectedIdol,
        color: selectedColor,
        company
      });
      syncLoginUI();
      closeModal();
      showToast(`已更新制作人名籍：${saved.name}（${saved.idol}担当）✦`);
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      errMsg.textContent = '请输入账号 ID 与密码';
      return;
    }

    submitBtn.disabled = true;
    try {
      const res =
        authMode === 'register'
          ? await apiRegister({
              username,
              password,
              name: nameInput.value.trim() || '制作人Producer',
              idol: selectedIdol,
              color: selectedColor,
              company: companyInput.value.trim() || '初星学園'
            })
          : await apiLogin({ username, password });

      if (!res.ok || !res.data || !res.data.user) {
        errMsg.textContent = (res.data && res.data.error) || '认证失败，请检查账号或密码';
        submitBtn.disabled = false;
        return;
      }

      store.setLocalUser(res.data.user);
      await store.syncLocalWorksToCloud();
      syncLoginUI();
      closeModal();
      showToast(`欢迎回来，${res.data.user.name} · 云端作品已同步 ✦`);
    } finally {
      submitBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    if (isServerConnected()) await apiLogout();
    store.logoutUserLocal();
    syncLoginUI();
    closeModal();
    showToast('已退出当前制作人账号');
  });

  modal._populate = () => {
    const user = store.getUser();
    const extras = modal.querySelector('#authLoggedExtras');
    if (user && user.username && isServerConnected()) {
      authMode = 'local';
    } else {
      authMode = isServerConnected() ? 'login' : 'local';
    }
    syncTabUI();
    if (user) {
      nameInput.value = user.name || '制作人Producer';
      companyInput.value = user.company || '初星学園';
      usernameInput.value = user.username || '';
      highlightIdol(user.idol || IDOLS[0].name);
      extras.hidden = false;
    } else {
      nameInput.value = '制作人Producer';
      companyInput.value = '初星学園';
      highlightIdol(IDOLS[0].name);
      extras.hidden = true;
    }
  };

  return modal;
}

export function openLoginModal() {
  const modal = ensureAuthModal();
  modal._populate();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

export function initLoginButtons() {
  syncLoginUI();
  document.querySelectorAll('[data-login-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openLoginModal();
    });
  });
}

export function initReveal() {
  const nodes = document.querySelectorAll('[data-reveal]');
  if (!nodes.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || typeof IntersectionObserver === 'undefined') {
    nodes.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = Number(entry.target.dataset.revealDelay || 0);
          setTimeout(() => entry.target.classList.add('is-visible'), delay);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  nodes.forEach((el) => observer.observe(el));
}

export function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export async function bootCommon() {
  initHeader();
  initReveal();
  await store.hydrateFromStorage();
  initLoginButtons();
}

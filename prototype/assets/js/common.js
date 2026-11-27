/* ==========================================================
   全站通用交互：Header 滚动描边、Toast、滚动入场、制作人登录身份弹窗
   ========================================================== */

window.IchibanCommon = (function () {
  const USER_KEY = 'ichiban:user';
  const PREFILL_KEY = 'ichiban:prefill';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const update = () => {
      if (window.scrollY > 80) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
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

  function showToast(message, duration = 3000) {
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

    toast.addEventListener('mouseleave', () => {
      startTimer();
    });

    toast.querySelector('.toast__close').addEventListener('click', dismiss);
    startTimer();
    return toast;
  }

  function readUser() {
    if (window.IchibanStore && typeof window.IchibanStore.getUser === 'function') {
      return window.IchibanStore.getUser();
    }
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u && u.name ? u : null;
    } catch (e) {
      return null;
    }
  }

  function writeUser(user) {
    if (window.IchibanStore && typeof window.IchibanStore.saveUser === 'function') {
      return window.IchibanStore.saveUser(user);
    }
    const payload = {
      name: String(user.name || '').trim(),
      idol: String(user.idol || '').trim(),
      color: String(user.color || '#FF7600').trim(),
      company: String(user.company || '初星学園').trim(),
      loggedInAt: Date.now()
    };
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(payload));
      localStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({
          name: payload.name,
          title: payload.idol ? `${payload.idol}担当` : '',
          company: payload.company,
          accent: payload.color
        })
      );
    } catch (e) {}
    return payload;
  }

  function clearUser() {
    if (window.IchibanStore && typeof window.IchibanStore.logoutUser === 'function') {
      window.IchibanStore.logoutUser();
      return;
    }
    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  function syncLoginUI() {
    const user = readUser();
    document.querySelectorAll('[data-login-btn]').forEach((btn) => {
      if (user) {
        btn.classList.add('header-user-pill');
        btn.innerHTML = `<span class="header-user-pill__dot" style="background:${esc(user.color || '#FF7600')};"></span><span class="header-user-pill__name">${esc(user.name)}</span>`;
        btn.setAttribute('aria-label', `制作人账号：${user.name}`);
      } else {
        btn.classList.remove('header-user-pill');
        btn.textContent = '登录';
        btn.setAttribute('aria-label', '登录制作人账号');
      }
    });
    window.dispatchEvent(new CustomEvent('ichiban:auth-changed', { detail: { user } }));
  }

  function ensureAuthModal() {
    let modal = document.getElementById('authModal');
    if (modal) return modal;

    const idols = (window.IchibanData && window.IchibanData.IDOLS) || [
      { name: '花海咲季', initial: '咲', color: '#E30F25', light: false },
      { name: '月村手毬', initial: '手', color: '#0C7BBB', light: false },
      { name: '藤田ことね', initial: 'こ', color: '#F8C112', light: true }
    ];

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

        <form id="authForm" class="auth-modal__form">
          <div class="auth-field">
            <label for="authNameInput">制作人名称 (P 名)</label>
            <input id="authNameInput" type="text" maxlength="24" placeholder="制作人Producer" required>
          </div>

          <div class="auth-field">
            <label>选择主推 / 担当偶像</label>
            <div id="authIdolGrid" class="auth-idol-grid">
              ${idols
                .map(
                  (i) => `
                  <button type="button" class="auth-idol-chip" data-auth-idol="${esc(i.name)}" data-auth-color="${esc(i.color)}">
                    <span class="auth-idol-chip__dot" style="background:${esc(i.color)};${i.light ? 'border:1px solid #BFBFBF;' : ''}"></span>
                    <span>${esc(i.name)}</span>
                  </button>
                `
                )
                .join('')}
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

          <button type="submit" class="btn-cta" style="width:100%;min-height:48px;">点亮制作人身份 ✦</button>
        </form>

        <div id="authLoggedExtras" class="auth-modal__extras" hidden>
          <a href="works.html" class="btn-outline btn-cta--sm" style="flex:1;justify-content:center;">前往我的作品</a>
          <button type="button" id="authLogoutBtn" class="auth-logout-btn">退出登录</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#authForm');
    const nameInput = modal.querySelector('#authNameInput');
    const companyInput = modal.querySelector('#authCompanyInput');
    const closeBtn = modal.querySelector('#authCloseBtn');
    const logoutBtn = modal.querySelector('#authLogoutBtn');
    let selectedIdol = idols[0].name;
    let selectedColor = idols[0].color;

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
      if (!chip) return;
      highlightIdol(chip.dataset.authIdol);
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
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim() || '制作人Producer';
      const company = companyInput.value.trim() || '初星学園';
      const saved = writeUser({
        name,
        idol: selectedIdol,
        color: selectedColor,
        company
      });
      syncLoginUI();
      closeModal();
      showToast(`欢迎回来，${saved.name}（${saved.idol}担当）✦`);
    });

    logoutBtn.addEventListener('click', () => {
      clearUser();
      syncLoginUI();
      closeModal();
      showToast('已退出当前制作人账号');
    });

    modal._populate = () => {
      const user = readUser();
      const extras = modal.querySelector('#authLoggedExtras');
      if (user) {
        nameInput.value = user.name;
        companyInput.value = user.company || '初星学園';
        highlightIdol(user.idol || idols[0].name);
        extras.hidden = false;
      } else {
        nameInput.value = '制作人Producer';
        companyInput.value = '初星学園';
        highlightIdol(idols[0].name);
        extras.hidden = true;
      }
    };

    return modal;
  }

  function openLoginModal() {
    const modal = ensureAuthModal();
    modal._populate();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    const nameInput = modal.querySelector('#authNameInput');
    if (nameInput) setTimeout(() => nameInput.focus(), 40);
  }

  function initLoginButtons() {
    syncLoginUI();
    document.querySelectorAll('[data-login-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
      });
    });
  }

  function initReveal() {
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
            setTimeout(() => {
              entry.target.classList.add('is-visible');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    nodes.forEach((el) => observer.observe(el));
  }

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initLoginButtons();
    initReveal();
  });

  window.showToast = showToast;

  return {
    showToast,
    debounce,
    openLoginModal,
    syncLoginUI,
    readUser
  };
})();

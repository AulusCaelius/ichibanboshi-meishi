/**
 * 首页落地页逻辑 (v1.0)
 */

import { TEMPLATES, PICKUP_IDS, ACTIVE, LONG } from '../core/catalog.mjs';
import { renderCard, fitText, escapeHtml } from '../core/card-render.mjs';
import { bootCommon, debounce } from '../ui/common.mjs';

const byId = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

function renderHeroCards() {
  const slots = [
    { sel: '#heroCardBackLeft', id: 'T01' },
    { sel: '#heroCardCenter', id: 'T12' },
    { sel: '#heroCardBackRight', id: 'T03' }
  ];
  slots.forEach(({ sel, id }) => {
    const el = document.querySelector(sel);
    const t = byId[id];
    if (!el || !t) return;
    el.innerHTML = renderCard(t, ACTIVE, {
      forceSingle: true,
      accent: ACTIVE.title.includes('咲季') ? '#E30F25' : t.color
    });
  });
}

function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const wraps = document.querySelectorAll('.hero-card-wrap');
  if (!hero || !wraps.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const baseTransforms = {
    'hero-card-wrap--back-left': { tx: -118, ty: -74, rz: -13, sc: 0.9, depth: 0.7 },
    'hero-card-wrap--center': { tx: 0, ty: 0, rz: -3, sc: 1.04, depth: 1.0 },
    'hero-card-wrap--back-right': { tx: 118, ty: 66, rz: 12, sc: 0.92, depth: 0.85 }
  };

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    wraps.forEach((wrap) => {
      const key = Object.keys(baseTransforms).find((k) => wrap.classList.contains(k));
      if (!key) return;
      const b = baseTransforms[key];
      const rx = (-ny * 6 * b.depth).toFixed(2);
      const ry = (nx * 6 * b.depth).toFixed(2);
      wrap.style.transform = `translate(${b.tx + nx * 8 * b.depth}px, ${b.ty + ny * 6 * b.depth}px) rotate(${b.rz}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${b.sc})`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    wraps.forEach((wrap) => {
      wrap.style.transform = '';
    });
  });
}

function renderWhyDemos() {
  const autoGood = document.getElementById('demoAutoGood');
  if (autoGood && byId.T06) {
    autoGood.innerHTML = renderCard(byId.T06, LONG, { forceSingle: true });
  }
  const phygitalCard = document.getElementById('demoPhygitalCard');
  if (phygitalCard && byId.T01) {
    phygitalCard.innerHTML = renderCard(byId.T01, ACTIVE, { forceSingle: true });
  }
}

function initPickup() {
  const track = document.getElementById('pickupTrack');
  const chips = document.querySelectorAll('#pickupFilters .chip');
  const prevBtn = document.getElementById('pickupPrev');
  const nextBtn = document.getElementById('pickupNext');
  if (!track) return;

  const pickupTemplates = PICKUP_IDS.map((id) => byId[id]).filter(Boolean);

  const draw = (styleFilter) => {
    const list = styleFilter === 'all' ? pickupTemplates : pickupTemplates.filter((t) => t.style === styleFilter);
    track.innerHTML = list
      .map(
        (t) => `
        <a class="pickup-item" href="templates.html?highlight=${encodeURIComponent(t.id)}">
          <div class="pickup-item__stage stage-backdrop">
            ${renderCard(t, ACTIVE, { forceSingle: true, accent: '#E30F25' })}
          </div>
          <div class="pickup-item__body">
            <div>
              <div class="pickup-item__name">${escapeHtml(t.name)}</div>
              <div class="pickup-item__jp">${escapeHtml(t.jp)} · ${escapeHtml(t.idol)}</div>
            </div>
            <span class="chip is-active" style="min-height:28px;padding:0 12px;font-size:12px;">${escapeHtml(t.styleLabel)}</span>
          </div>
        </a>`
      )
      .join('');
    requestAnimationFrame(() => fitText(track));
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('is-active');
      chip.setAttribute('aria-pressed', 'true');
      draw(chip.dataset.style || 'all');
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', () => track.scrollBy({ left: -324, behavior: 'smooth' }));
  if (nextBtn) nextBtn.addEventListener('click', () => track.scrollBy({ left: 324, behavior: 'smooth' }));
  draw('all');
}

document.addEventListener('DOMContentLoaded', async () => {
  await bootCommon();
  renderHeroCards();
  initHeroParallax();
  renderWhyDemos();
  initPickup();

  requestAnimationFrame(() => fitText(document));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fitText(document));
  }
  window.addEventListener('resize', debounce(() => fitText(document), 150));
});

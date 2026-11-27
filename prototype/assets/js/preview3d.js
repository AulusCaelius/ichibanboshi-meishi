/* ==========================================================
   WebGL / Three.js 真实物理材质 3D 渲染引擎 (window.Ichiban3D)
   支持：6 种特种纸基底（含正反独立指定）、8 种可编辑区域特殊材质 PBR 遮罩、
        真实卡片厚度与倒角、自然光照与 3 套真实三维环境（去除人工反光扫光）
   ========================================================== */

window.Ichiban3D = (function () {
  const PAPER_NOISE_CACHE = {};
  let fallbackNotified = false;

  const MAT_PRESETS = {
    matte: {
      roughness: 0.72,
      metalness: 0.0,
      bumpScale: 0.008,
      depth: 0.028,
      edgeColor: 0xf4f1ea,
      transparent: false,
      opacity: 1.0,
      envIntensity: 0.55
    },
    cotton: {
      roughness: 0.92,
      metalness: 0.0,
      bumpScale: 0.028,
      depth: 0.046,
      edgeColor: 0xf3eee3,
      transparent: false,
      opacity: 1.0,
      envIntensity: 0.45
    },
    pearl: {
      roughness: 0.46,
      metalness: 0.14,
      bumpScale: 0.011,
      depth: 0.032,
      edgeColor: 0xede7f6,
      transparent: false,
      opacity: 1.0,
      envIntensity: 0.72
    },
    black: {
      roughness: 0.86,
      metalness: 0.0,
      bumpScale: 0.014,
      depth: 0.038,
      edgeColor: 0x16171c,
      transparent: false,
      opacity: 1.0,
      envIntensity: 0.5
    },
    washi: {
      roughness: 0.9,
      metalness: 0.0,
      bumpScale: 0.024,
      depth: 0.036,
      edgeColor: 0xefe6d5,
      transparent: false,
      opacity: 1.0,
      envIntensity: 0.46
    },
    pvc: {
      roughness: 0.56,
      metalness: 0.0,
      bumpScale: 0.006,
      depth: 0.024,
      edgeColor: 0xdff6ff,
      transparent: true,
      opacity: 0.85,
      envIntensity: 0.62
    }
  };

  function isWebGLAvailable() {
    if (typeof window === 'undefined' || !window.THREE) return false;
    try {
      const canvas = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext &&
          (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getPaperNoise(matId) {
    if (PAPER_NOISE_CACHE[matId]) return PAPER_NOISE_CACHE[matId];
    const size = 256;
    const height = new Float32Array(size * size);
    const sparkle = new Float32Array(size * size);
    const rng = mulberry32(matId.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 1337));

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const n = rng();
        if (matId === 'cotton') {
          const weaveX = Math.sin((x / size) * Math.PI * 36) * 0.25;
          const weaveY = Math.cos((y / size) * Math.PI * 36) * 0.25;
          height[idx] = Math.max(0, Math.min(1, 0.5 + weaveX * weaveY + (n - 0.5) * 0.55));
        } else if (matId === 'washi') {
          const strand1 = Math.sin((x * 0.14 + y * 0.36) * 0.65) * 0.22;
          const strand2 = Math.cos((x * 0.28 - y * 0.09) * 0.5) * 0.18;
          height[idx] = Math.max(0, Math.min(1, 0.5 + strand1 + strand2 + (n - 0.5) * 0.42));
        } else if (matId === 'pearl') {
          height[idx] = 0.48 + (n - 0.5) * 0.22;
          sparkle[idx] = n > 0.93 ? (n - 0.93) / 0.07 : 0;
        } else if (matId === 'black') {
          height[idx] = 0.48 + (n - 0.5) * 0.34;
        } else if (matId === 'pvc') {
          height[idx] = 0.5 + (n - 0.5) * 0.1;
        } else {
          height[idx] = 0.5 + (n - 0.5) * 0.16;
        }
      }
    }

    PAPER_NOISE_CACHE[matId] = { size, height, sparkle };
    return PAPER_NOISE_CACHE[matId];
  }

  function getSideStock(project, side) {
    if (window.IchibanProject && typeof window.IchibanProject.getEffectiveStock === 'function') {
      return window.IchibanProject.getEffectiveStock(project, side);
    }
    const sm = project && project.sideMaterials;
    if (sm && sm[side] && sm[side] !== 'inherit') return sm[side];
    return (project && project.material) || 'matte';
  }

  function collectActiveSurfaceMaterials(project) {
    const active = new Set();
    if (project && project.regionMaterials) {
      Object.values(project.regionMaterials).forEach((m) => {
        if (m && m !== 'none') active.add(m);
      });
    }
    if (project && project.crafts) {
      Object.entries(project.crafts).forEach(([k, v]) => {
        if (v) active.add(k);
      });
    }
    if (project && project.canvas) {
      ['front', 'back'].forEach((side) => {
        const list = project.canvas[side];
        if (Array.isArray(list)) {
          list.forEach((el) => {
            if (el && el.visible !== false && el.craft && el.craft !== 'none') {
              active.add(el.craft);
            }
          });
        }
      });
    }
    return active;
  }

  function collectInlineCss() {
    if (typeof document === 'undefined') return '';
    let css = '';
    for (const sheet of Array.from(document.styleSheets || [])) {
      try {
        const rules = sheet.cssRules;
        if (rules) {
          for (const rule of Array.from(rules)) {
            const text = rule.cssText || '';
            if (/@font-face|@import/i.test(text)) continue;
            css += text.replace(/url\(\s*['"]?https?:\/\/[^)]+\)/gi, 'none') + '\n';
          }
        }
      } catch (err) {
        // 跨域字体样式表跳过
      }
    }
    return css.replace(/<\/style>/gi, '');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  function buildRoundedRectShape(w, h, r) {
    const THREE = window.THREE;
    const hw = w / 2;
    const hh = h / 2;
    const rad = Math.max(0.005, Math.min(r, hw * 0.92, hh * 0.92));
    const shape = new THREE.Shape();
    shape.moveTo(-hw + rad, -hh);
    shape.lineTo(hw - rad, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + rad);
    shape.lineTo(hw, hh - rad);
    shape.quadraticCurveTo(hw, hh, hw - rad, hh);
    shape.lineTo(-hw + rad, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - rad);
    shape.lineTo(-hw, -hh + rad);
    shape.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
    return shape;
  }

  function createNormalizedFaceGeometry(shape, w, h) {
    const THREE = window.THREE;
    const geo = new THREE.ShapeGeometry(shape, 20);
    const pos = geo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uvs[i * 2] = (x + w / 2) / w;
      uvs[i * 2 + 1] = (y + h / 2) / h;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geo;
  }

  // 柔和均匀的自然影棚环境光图，去除刺眼高光反光块
  function buildStudioEnvMap(renderer) {
    const THREE = window.THREE;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x454750);

    const geometries = [];
    const materials = [];
    const addPanel = (w, h, colorHex, intensity, pos, lookAt) => {
      const g = new THREE.PlaneGeometry(w, h);
      const c = new THREE.Color(colorHex).multiplyScalar(intensity);
      const m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.lookAt(lookAt[0], lookAt[1], lookAt[2]);
      envScene.add(mesh);
      geometries.push(g);
      materials.push(m);
    };

    addPanel(14, 10, 0xfaf8f2, 0.92, [0, 7, 2], [0, 0, 0]);
    addPanel(10, 8, 0xf2ede4, 0.78, [6.5, 2.5, 4.5], [0, 0, 0]);
    addPanel(10, 8, 0xe8eef6, 0.72, [-6.5, 2.0, 4.0], [0, 0, 0]);
    addPanel(16, 16, 0x5c5e66, 0.55, [0, -7, 0], [0, 0, 0]);

    const rt = pmrem.fromScene(envScene, 0.068);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    pmrem.dispose();
    return rt;
  }

  function createBokehSpriteTexture() {
    const THREE = window.THREE;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 246, 214, 0.9)');
    grad.addColorStop(0.4, 'rgba(255, 198, 110, 0.42)');
    grad.addColorStop(1, 'rgba(255, 118, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function createShadowBlobTexture() {
    const THREE = window.THREE;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(30, 30, 35, 0.24)');
    grad.addColorStop(0.55, 'rgba(30, 30, 35, 0.08)');
    grad.addColorStop(1, 'rgba(30, 30, 35, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function createWindowBlindTexture() {
    const THREE = window.THREE;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#E8DCCB';
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(-Math.PI / 7);
    for (let y = -360; y <= 360; y += 54) {
      const g = ctx.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, 'rgba(255, 246, 224, 0.78)');
      g.addColorStop(1, 'rgba(255, 240, 206, 0.06)');
      ctx.fillStyle = g;
      ctx.fillRect(-400, y, 800, 30);
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  const COLOR_OVERRIDE_CSS = `
    .p3d-tex-root .bcard__face { border-radius: 0 !important; box-shadow: none !important; }
    .p3d-tex-root .craft-gold,
    .p3d-tex-root .craft-gold * {
      background: none !important;
      -webkit-text-fill-color: #C99E32 !important;
      color: #C99E32 !important;
      text-shadow: none !important;
    }
    .p3d-tex-root .craft-silver,
    .p3d-tex-root .craft-silver * {
      background: none !important;
      -webkit-text-fill-color: #AEB6C2 !important;
      color: #AEB6C2 !important;
      text-shadow: none !important;
    }
    .p3d-tex-root .craft-copper,
    .p3d-tex-root .craft-copper * {
      background: none !important;
      -webkit-text-fill-color: #B86B43 !important;
      color: #B86B43 !important;
      text-shadow: none !important;
    }
    .p3d-tex-root .craft-brushed,
    .p3d-tex-root .craft-brushed * {
      background: none !important;
      -webkit-text-fill-color: #98A0AA !important;
      color: #98A0AA !important;
      text-shadow: none !important;
    }
    .p3d-tex-root .bcard-el--icon.craft-gold svg,
    .p3d-tex-root .bcard-el--qr.craft-gold { color: #C99E32 !important; }
    .p3d-tex-root .bcard-el--icon.craft-silver svg,
    .p3d-tex-root .bcard-el--qr.craft-silver { color: #AEB6C2 !important; }
    .p3d-tex-root .bcard-el--icon.craft-copper svg,
    .p3d-tex-root .bcard-el--qr.craft-copper { color: #B86B43 !important; }
    .p3d-tex-root .bcard-el--icon.craft-brushed svg,
    .p3d-tex-root .bcard-el--qr.craft-brushed { color: #98A0AA !important; }
    .p3d-tex-root.is-pvc-light .bcard__face { background-color: rgba(242, 250, 255, 0.72) !important; }
  `;

  // 6 组正交高纯度 RGB 通道掩码：
  // 金属烫印(#FF0000) | 拉丝金属(#FFFF00) | 立体厚墨(#00FF00) | 击凸(#0000FF) | 压凹(#00FFFF) | 丝绒(#FF00FF)
  const MASK_OVERRIDE_CSS = `
    .p3d-mask-root,
    .p3d-mask-root .bcard,
    .p3d-mask-root .bcard__face {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    .p3d-mask-root .bcard__ribbon,
    .p3d-mask-root .bcard__beams,
    .p3d-mask-root .bcard__bubbles,
    .p3d-mask-root .bcard__tachie,
    .p3d-mask-root .bcard__back-pattern,
    .p3d-mask-root .bcard__pattern,
    .p3d-mask-root .bcard__topbars,
    .p3d-mask-root .bcard__swatch,
    .p3d-mask-root .bcard__rule,
    .p3d-mask-root .bcard__vdiv,
    .p3d-mask-root .bcard__qr {
      opacity: 0 !important;
      visibility: hidden !important;
    }
    .p3d-mask-root .bcard__content *,
    .p3d-mask-root .bcard__back-inner *,
    .p3d-mask-root .bcard__jp-vert,
    .p3d-mask-root .el-layer .bcard-el,
    .p3d-mask-root .bcard__crest,
    .p3d-mask-root .bcard__deco-frame,
    .p3d-mask-root .bcard__constellation {
      visibility: hidden !important;
    }
    .p3d-mask-root .craft-gold,
    .p3d-mask-root .craft-gold *,
    .p3d-mask-root .craft-silver,
    .p3d-mask-root .craft-silver *,
    .p3d-mask-root .craft-copper,
    .p3d-mask-root .craft-copper * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #FF0000 !important;
      -webkit-text-fill-color: #FF0000 !important;
      background: none !important;
      border-color: #FF0000 !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .p3d-mask-root .craft-gold span,
    .p3d-mask-root .craft-silver span,
    .p3d-mask-root .craft-copper span { background: #FF0000 !important; }
    .p3d-mask-root .bcard-el--icon.craft-gold svg,
    .p3d-mask-root .bcard-el--icon.craft-silver svg,
    .p3d-mask-root .bcard-el--icon.craft-copper svg { stroke: #FF0000 !important; color: #FF0000 !important; }

    .p3d-mask-root .craft-brushed,
    .p3d-mask-root .craft-brushed * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #FFFF00 !important;
      -webkit-text-fill-color: #FFFF00 !important;
      background: none !important;
      border-color: #FFFF00 !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .p3d-mask-root .bcard-el--icon.craft-brushed svg { stroke: #FFFF00 !important; }

    .p3d-mask-root .craft-uv,
    .p3d-mask-root .craft-uv * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #00FF00 !important;
      -webkit-text-fill-color: #00FF00 !important;
      background: none !important;
      border-color: #00FF00 !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .p3d-mask-root .bcard-el--icon.craft-uv svg { stroke: #00FF00 !important; }

    .p3d-mask-root .craft-emboss,
    .p3d-mask-root .craft-emboss * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #0000FF !important;
      -webkit-text-fill-color: #0000FF !important;
      background: none !important;
      border-color: #0000FF !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .p3d-mask-root .bcard-el--icon.craft-emboss svg { stroke: #0000FF !important; }

    .p3d-mask-root .craft-deboss,
    .p3d-mask-root .craft-deboss * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #00FFFF !important;
      -webkit-text-fill-color: #00FFFF !important;
      background: none !important;
      border-color: #00FFFF !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .p3d-mask-root .bcard-el--icon.craft-deboss svg { stroke: #00FFFF !important; }

    .p3d-mask-root .craft-velvet,
    .p3d-mask-root .craft-velvet * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #FF00FF !important;
      -webkit-text-fill-color: #FF00FF !important;
      background: none !important;
      border-color: #FF00FF !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .p3d-mask-root .bcard-el--icon.craft-velvet svg { stroke: #FF00FF !important; }

    .p3d-mask-root .bcard__tachie.craft-gold,
    .p3d-mask-root .bcard__tachie.craft-silver,
    .p3d-mask-root .bcard__tachie.craft-copper {
      background: rgba(255, 0, 0, 0.85) !important;
    }
    .p3d-mask-root .bcard__tachie.craft-brushed { background: rgba(255, 255, 0, 0.85) !important; }
    .p3d-mask-root .bcard__tachie.craft-uv { background: rgba(0, 255, 0, 0.85) !important; }
    .p3d-mask-root .bcard__tachie.craft-emboss { background: rgba(0, 0, 255, 0.85) !important; }
    .p3d-mask-root .bcard__tachie.craft-deboss { background: rgba(0, 255, 255, 0.85) !important; }
    .p3d-mask-root .bcard__tachie.craft-velvet { background: rgba(255, 0, 255, 0.85) !important; }
  `;

  function getSandboxEl() {
    let el = document.getElementById('p3dTextureSandbox');
    if (!el) {
      el = document.createElement('div');
      el.id = 'p3dTextureSandbox';
      el.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;z-index:-1;';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    return el;
  }

  function serializeSlotToXhtml(slot) {
    if (!slot) return '';
    if (typeof XMLSerializer !== 'undefined') {
      const s = new XMLSerializer();
      let out = '';
      for (const child of Array.from(slot.childNodes)) {
        out += s.serializeToString(child);
      }
      return out;
    }
    return slot.innerHTML;
  }

  function extractFaceDomSnapshot(project, side, measureW) {
    const renderer = window.IchibanProject;
    const cardMod = window.IchibanCard;
    const store = window.IchibanStore;
    const sandbox = getSandboxEl();

    sandbox.innerHTML = `<div class="p3d-tex-slot" style="width:${measureW}px;">${renderer.renderFace(project, side)}</div>`;
    const isCanvasSide = project.canvas && Array.isArray(project.canvas[side]);
    if (!isCanvasSide && cardMod && typeof cardMod.fitText === 'function') {
      cardMod.fitText(sandbox);
    }

    const face = sandbox.querySelector('.bcard__face');
    const faceRect = face ? face.getBoundingClientRect() : null;
    const t = store.getTemplate(project.templateId);
    const rawBg = face ? window.getComputedStyle(face).backgroundColor : '';
    const bg =
      rawBg && rawBg !== 'rgba(0, 0, 0, 0)' && rawBg !== 'transparent'
        ? rawBg
        : (renderer.STYLE_BG && renderer.STYLE_BG[t.style]) || '#FFFFFF';
    const items = [];

    if (face && faceRect && faceRect.width && faceRect.height) {
      const sel =
        '.bcard__name, .bcard__en, .bcard__title, .bcard__company, .bcard__sns-item, .bcard__sns, .bcard__fav, .bcard__meta, .bcard__back-jp, .bcard__jp-vert, .bcard__label-en, .bcard-el--text';
      face.querySelectorAll(sel).forEach((node) => {
        const r = node.getBoundingClientRect();
        const cs = window.getComputedStyle(node);
        if (!r.width || !r.height || cs.display === 'none' || cs.visibility === 'hidden') return;
        const text = (node.textContent || '').trim();
        if (!text) return;
        let craft = 'none';
        ['gold', 'silver', 'copper', 'emboss', 'deboss', 'uv', 'velvet', 'brushed'].forEach((k) => {
          if (node.classList.contains(`craft-${k}`)) craft = k;
        });
        items.push({
          kind: 'text',
          text,
          rx: (r.left - faceRect.left) / faceRect.width,
          ry: (r.top - faceRect.top) / faceRect.height,
          rw: r.width / faceRect.width,
          fontRatio: (parseFloat(cs.fontSize) || 12) / faceRect.width,
          fontWeight: cs.fontWeight || '500',
          color:
            craft === 'gold'
              ? '#C99E32'
              : craft === 'silver'
              ? '#AEB6C2'
              : craft === 'copper'
              ? '#B86B43'
              : craft === 'brushed'
              ? '#98A0AA'
              : cs.color || '#333333',
          craft
        });
      });

      face.querySelectorAll('.bcard-el--image img').forEach((img) => {
        const r = img.getBoundingClientRect();
        if (!r.width || !r.height) return;
        items.push({
          kind: 'image',
          src: img.src,
          rx: (r.left - faceRect.left) / faceRect.width,
          ry: (r.top - faceRect.top) / faceRect.height,
          rw: r.width / faceRect.width,
          rh: r.height / faceRect.height
        });
      });
    }

    const slot = sandbox.querySelector('.p3d-tex-slot');
    const html = serializeSlotToXhtml(slot);
    sandbox.innerHTML = '';
    return { html, bg, items };
  }

  async function drawFallbackFace(ctx, w, h, snap, isMask, isPvcLight) {
    ctx.clearRect(0, 0, w, h);
    if (!isMask) {
      ctx.fillStyle = isPvcLight ? 'rgba(242, 250, 255, 0.72)' : snap.bg || '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }

    for (const item of snap.items) {
      if (item.kind === 'image' && !isMask && item.src) {
        try {
          const img = await loadImage(item.src);
          ctx.drawImage(img, item.rx * w, item.ry * h, item.rw * w, item.rh * h);
        } catch (e) {}
      } else if (item.kind === 'text') {
        if (isMask) {
          if (item.craft === 'gold' || item.craft === 'silver' || item.craft === 'copper') ctx.fillStyle = '#FF0000';
          else if (item.craft === 'brushed') ctx.fillStyle = '#FFFF00';
          else if (item.craft === 'uv') ctx.fillStyle = '#00FF00';
          else if (item.craft === 'emboss') ctx.fillStyle = '#0000FF';
          else if (item.craft === 'deboss') ctx.fillStyle = '#00FFFF';
          else if (item.craft === 'velvet') ctx.fillStyle = '#FF00FF';
          else continue;
        } else {
          ctx.fillStyle = item.color;
        }
        const fz = Math.max(10, Math.round(item.fontRatio * w));
        ctx.font = `${item.fontWeight} ${fz}px "Noto Sans SC", "Poppins", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(item.text, item.rx * w, item.ry * h, item.rw * w + fz);
      }
    }
  }

  function synthesizePbrChannels(sideData, matId, maskData) {
    const preset = MAT_PRESETS[matId] || MAT_PRESETS.matte;
    const noise = getPaperNoise(matId);
    const w = sideData.pbrW;
    const h = sideData.pbrH;

    const ormImg = sideData.ormCtx.createImageData(w, h);
    const bumpImg = sideData.bumpCtx.createImageData(w, h);

    const ormOut = ormImg.data;
    const bumpOut = bumpImg.data;

    const baseR = Math.round(preset.roughness * 255);
    const baseM = Math.round(preset.metalness * 255);
    const nSize = noise.size;
    const nH = noise.height;
    const nS = noise.sparkle;

    for (let y = 0; y < h; y++) {
      const ny = (y % nSize) * nSize;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const p4 = i * 4;
        const nIdx = ny + (x % nSize);

        const paperHeight = nH[nIdx];
        const sparkleVal = nS[nIdx];

        let rough = baseR + (paperHeight - 0.5) * (matId === 'cotton' || matId === 'washi' ? 38 : 18);
        let metal = baseM;
        let bump = 122 + (paperHeight - 0.5) * (matId === 'cotton' || matId === 'washi' ? 148 : 42);

        if (matId === 'pearl' && sparkleVal > 0) {
          rough = Math.max(58, rough - sparkleVal * 42);
          metal = Math.min(130, metal + sparkleVal * 90);
        }

        if (maskData) {
          const mr = maskData[p4];
          const mg = maskData[p4 + 1];
          const mb = maskData[p4 + 2];
          const ma = maskData[p4 + 3];

          if (ma > 55) {
            const rOn = mr > 120;
            const gOn = mg > 120;
            const bOn = mb > 120;

            if (rOn && gOn && !bOn) {
              // 拉丝金属：细腻横向拉丝微槽 + 缎面金属感
              metal = 186;
              rough = 112 + ((y % 3 === 0) ? 18 : -10);
              bump = Math.max(40, bump + ((y % 3 === 0) ? -22 : 12));
            } else if (rOn && !gOn && bOn) {
              // 丝绒触感：极高粗糙度完全吸光，微细绒毛凹凸
              metal = 0;
              rough = 250;
              bump = Math.max(30, bump + (paperHeight - 0.5) * 45);
            } else if (!rOn && gOn && bOn) {
              // 活字压凹：明显凹陷沟壑，无金属
              metal = 0;
              rough = Math.min(252, rough + 16);
              bump = Math.max(6, bump - 135);
            } else if (rOn && !gOn && !bOn) {
              // 缎面烫金 / 哑光烫银 / 赤铜烫印：自然缎面金属，无刺眼高光
              metal = 204;
              rough = 98;
              bump = Math.max(16, bump - 32);
            } else if (!rOn && gOn && !bOn) {
              // 立体厚墨：饱满厚度，柔和半哑光
              metal = 0;
              rough = 88;
              bump = Math.min(255, bump + 66);
            } else if (!rOn && !gOn && bOn) {
              // 击凸浮雕：高耸纸面立体浮雕
              metal = 0;
              bump = Math.min(255, bump + 145);
            }
          }
        }

        const rClamped = Math.max(18, Math.min(255, Math.round(rough)));
        const mClamped = Math.max(0, Math.min(255, Math.round(metal)));
        const bClamped = Math.max(0, Math.min(255, Math.round(bump)));

        ormOut[p4] = 255;
        ormOut[p4 + 1] = rClamped;
        ormOut[p4 + 2] = mClamped;
        ormOut[p4 + 3] = 255;

        bumpOut[p4] = bClamped;
        bumpOut[p4 + 1] = bClamped;
        bumpOut[p4 + 2] = bClamped;
        bumpOut[p4 + 3] = 255;
      }
    }

    sideData.ormCtx.putImageData(ormImg, 0, 0);
    sideData.bumpCtx.putImageData(bumpImg, 0, 0);

    sideData.ormTex.needsUpdate = true;
    sideData.bumpTex.needsUpdate = true;
  }

  /* ----------------------------------------------------------
     无 WebGL 环境的轻量化 2D/CSS 降级视图（符合 PRD 10.4）
     ---------------------------------------------------------- */
  function mountFallback2D(container, getProject) {
    container.dataset.engine = 'fallback-2d';
    let currentSide = 'front';
    const wrap = document.createElement('div');
    wrap.className = 'p3d-fallback';
    wrap.innerHTML = `
      <div class="p3d-fallback__stage"></div>
      <div class="p3d-fallback__bar">
        <span>轻量 2D 降级模式</span>
        <button type="button" class="p3d-fallback__flip">翻转正反面</button>
      </div>
    `;
    container.innerHTML = '';
    container.appendChild(wrap);

    const stage = wrap.querySelector('.p3d-fallback__stage');
    const flipBtn = wrap.querySelector('.p3d-fallback__flip');

    function update() {
      const p = getProject();
      if (!p || !window.IchibanProject) return;
      stage.innerHTML = window.IchibanProject.renderFace(p, currentSide);
      if (window.IchibanCard) window.IchibanCard.fitText(stage);
    }

    flipBtn.addEventListener('click', () => {
      currentSide = currentSide === 'front' ? 'back' : 'front';
      update();
    });

    if (!fallbackNotified && typeof window.showToast === 'function') {
      fallbackNotified = true;
      window.showToast('当前设备未启用 WebGL，已自动切换为轻量 2D 预览');
    }

    update();
    return {
      update,
      setView(v) {
        currentSide = v === 'back' ? 'back' : 'front';
        update();
      },
      setLight() {},
      setAutoRotate() {},
      setEnv() {},
      setPaused() {},
      getDiagnostics() {
        return { engine: 'fallback-2d', webgl: false };
      },
      destroy() {
        container.innerHTML = '';
      }
    };
  }

  /* ----------------------------------------------------------
     主挂载入口：Three.js WebGL 纯真实材质 PBR 引擎（无人工反光/扫光）
     ---------------------------------------------------------- */
  function mount(container, getProject, opts = {}) {
    if (!container) return null;
    if (!isWebGLAvailable()) {
      return mountFallback2D(container, getProject, opts);
    }

    const THREE = window.THREE;
    const interactive = opts.interactive !== false;
    const isModal = (opts.size || 260) >= 400;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      return mountFallback2D(container, getProject, opts);
    }

    container.dataset.engine = 'webgl';
    container.innerHTML = '';

    const width = Math.max(container.clientWidth || (isModal ? 800 : 268), 180);
    const height = Math.max(container.clientHeight || (isModal ? 460 : 190), 140);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xefefe9);
    scene.fog = new THREE.Fog(0xefefe9, 7.5, 16);

    const envRT = buildStudioEnvMap(renderer);
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    const defaultDist = isModal ? 4.35 : 4.75;
    let targetDist = defaultDist;
    let curDist = defaultDist;
    camera.position.set(0, 0.12, curDist);
    camera.lookAt(0, 0, 0);

    // 灯光系统：自然漫反射半球光 + 主方向光 + 辅光 + 柔和轮廓光（无扫光灯）
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd8d6d0, 0.68);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffdf8, 1.35);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -2.8;
    keyLight.shadow.camera.right = 2.8;
    keyLight.shadow.camera.top = 2.8;
    keyLight.shadow.camera.bottom = -2.8;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe6eefc, 0.52);
    fillLight.position.set(-4.2, 1.8, 3.2);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0xff7600, 0.9, 12, Math.PI / 4, 0.65, 1.2);
    rimLight.position.set(-2.5, 2.8, -3.5);
    scene.add(rimLight);

    // 3 套真实三维环境底座元素
    const shadowBlobTex = createShadowBlobTexture();
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.2),
      new THREE.MeshBasicMaterial({ map: shadowBlobTex, transparent: true, opacity: 0.72, depthWrite: false })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -1.62;
    scene.add(contactShadow);

    const studioShadowFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.ShadowMaterial({ opacity: 0.14 })
    );
    studioShadowFloor.rotation.x = -Math.PI / 2;
    studioShadowFloor.position.y = -1.63;
    studioShadowFloor.receiveShadow = true;
    scene.add(studioShadowFloor);

    // 舞台聚光环境群组
    const stageGroup = new THREE.Group();
    stageGroup.visible = false;
    const stageFloor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x161822, roughness: 0.52, metalness: 0.25 })
    );
    stageFloor.rotation.x = -Math.PI / 2;
    stageFloor.position.y = -1.64;
    stageFloor.receiveShadow = true;
    stageGroup.add(stageFloor);

    const beamGeo = new THREE.CylinderGeometry(0.18, 1.75, 5.4, 24, 1, true);
    const beamMat1 = new THREE.MeshBasicMaterial({
      color: 0xffa64d,
      transparent: true,
      opacity: 0.065,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam1 = new THREE.Mesh(beamGeo, beamMat1);
    beam1.position.set(-1.35, 1.15, -1.2);
    beam1.rotation.z = -0.35;
    stageGroup.add(beam1);

    const beamMat2 = beamMat1.clone();
    beamMat2.color.setHex(0xffffff);
    beamMat2.opacity = 0.045;
    const beam2 = new THREE.Mesh(beamGeo, beamMat2);
    beam2.position.set(1.45, 1.2, -1.1);
    beam2.rotation.z = 0.36;
    stageGroup.add(beam2);

    const particleCount = 44;
    const pPositions = new Float32Array(particleCount * 3);
    const pSpeeds = new Float32Array(particleCount);
    const pRng = mulberry32(2026);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (pRng() - 0.5) * 6.2;
      pPositions[i * 3 + 1] = (pRng() - 0.5) * 3.4;
      pPositions[i * 3 + 2] = -0.6 - pRng() * 2.8;
      pSpeeds[i] = 0.22 + pRng() * 0.35;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const bokehTex = createBokehSpriteTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 0.2,
      map: bokehTex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const stageParticles = new THREE.Points(particleGeo, particleMat);
    stageGroup.add(stageParticles);
    scene.add(stageGroup);

    // 学园窗光环境群组
    const sunlitGroup = new THREE.Group();
    sunlitGroup.visible = false;
    const blindTex = createWindowBlindTexture();
    const sunlitFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ map: blindTex, roughness: 0.78, metalness: 0.0 })
    );
    sunlitFloor.rotation.x = -Math.PI / 2;
    sunlitFloor.position.y = -1.64;
    sunlitFloor.receiveShadow = true;
    sunlitGroup.add(sunlitFloor);
    scene.add(sunlitGroup);

    // 卡片三维容器与双面贴图状态
    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    function createSideResources() {
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = 1024;
      colorCanvas.height = 614;
      const colorCtx = colorCanvas.getContext('2d');
      const colorTex = new THREE.CanvasTexture(colorCanvas);
      colorTex.encoding = THREE.sRGBEncoding;
      colorTex.anisotropy = maxAnisotropy;

      const ormCanvas = document.createElement('canvas');
      ormCanvas.width = 512;
      ormCanvas.height = 307;
      const ormCtx = ormCanvas.getContext('2d');
      const ormTex = new THREE.CanvasTexture(ormCanvas);

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 307;
      const bumpCtx = bumpCanvas.getContext('2d');
      const bumpTex = new THREE.CanvasTexture(bumpCanvas);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 512;
      maskCanvas.height = 307;
      const maskCtx = maskCanvas.getContext('2d');

      return {
        colorCanvas,
        colorCtx,
        colorTex,
        ormCanvas,
        ormCtx,
        ormTex,
        bumpCanvas,
        bumpCtx,
        bumpTex,
        maskCanvas,
        maskCtx,
        pbrW: 512,
        pbrH: 307
      };
    }

    const frontRes = createSideResources();
    const backRes = createSideResources();

    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f1ea,
      roughness: 0.65,
      metalness: 0.0
    });

    const frontMaterial = new THREE.MeshStandardMaterial({
      map: frontRes.colorTex,
      roughnessMap: frontRes.ormTex,
      metalnessMap: frontRes.ormTex,
      roughness: 1.0,
      metalness: 1.0,
      bumpMap: frontRes.bumpTex,
      bumpScale: 0.012
    });

    const backMaterial = new THREE.MeshStandardMaterial({
      map: backRes.colorTex,
      roughnessMap: backRes.ormTex,
      metalnessMap: backRes.ormTex,
      roughness: 1.0,
      metalness: 1.0,
      bumpMap: backRes.bumpTex,
      bumpScale: 0.012
    });

    let coreMesh = null;
    let frontMesh = null;
    let backMesh = null;
    let geoKey = '';

    // 交互与渲染控制状态
    let envMode = opts.env || 'studio';
    let lightDeg = 120;
    let autoRotate = Boolean(opts.autoRotate);
    let paused = false;
    let targetRotX = -0.14;
    let targetRotY = 0.32;
    let curRotX = targetRotX;
    let curRotY = targetRotY;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let updateSeq = 0;
    let debounceTimer = null;
    let rafId = null;

    function applyLightPosition() {
      const rad = (lightDeg * Math.PI) / 180;
      const r = 4.6;
      keyLight.position.set(Math.sin(rad) * r, 3.2, Math.cos(rad) * r);
    }

    function applyEnvVisuals(project) {
      const accentHex = (project && project.accent) || '#FF7600';
      if (envMode === 'stage') {
        scene.background.setHex(0x11131c);
        scene.fog.color.setHex(0x11131c);
        stageGroup.visible = true;
        sunlitGroup.visible = false;
        studioShadowFloor.visible = false;
        contactShadow.material.opacity = 0.32;
        hemiLight.color.setHex(0xc8d8ff);
        hemiLight.groundColor.setHex(0x141520);
        hemiLight.intensity = 0.56;
        keyLight.color.setHex(0xfff6e8);
        keyLight.intensity = 1.45;
        rimLight.color.set(accentHex);
        rimLight.intensity = 1.9;
        beamMat1.color.set(accentHex);
      } else if (envMode === 'sunlit') {
        scene.background.setHex(0xf4ece1);
        scene.fog.color.setHex(0xf4ece1);
        stageGroup.visible = false;
        sunlitGroup.visible = true;
        studioShadowFloor.visible = false;
        contactShadow.material.opacity = 0.48;
        hemiLight.color.setHex(0xfff6e5);
        hemiLight.groundColor.setHex(0xe5d3bc);
        hemiLight.intensity = 0.78;
        keyLight.color.setHex(0xffe7bd);
        keyLight.intensity = 1.5;
        rimLight.color.setHex(0xffffff);
        rimLight.intensity = 0.65;
      } else {
        scene.background.setHex(0xefefe9);
        scene.fog.color.setHex(0xefefe9);
        stageGroup.visible = false;
        sunlitGroup.visible = false;
        studioShadowFloor.visible = true;
        contactShadow.material.opacity = 0.72;
        hemiLight.color.setHex(0xffffff);
        hemiLight.groundColor.setHex(0xd6d4ce);
        hemiLight.intensity = 0.68;
        keyLight.color.setHex(0xfffdf8);
        keyLight.intensity = 1.35;
        rimLight.color.set(accentHex);
        rimLight.intensity = 0.72;
      }
    }

    function applyFaceMaterialProps(mat, stockId, activeSet) {
      const preset = MAT_PRESETS[stockId] || MAT_PRESETS.matte;
      const nextTransparent = Boolean(preset.transparent);
      if (mat.transparent !== nextTransparent) {
        mat.transparent = nextTransparent;
        mat.needsUpdate = true;
      }
      mat.opacity = preset.opacity;
      mat.bumpScale =
        preset.bumpScale +
        (activeSet.has('emboss') || activeSet.has('deboss') ? 0.018 : 0) +
        (activeSet.has('uv') ? 0.005 : 0);
      mat.envMapIntensity = preset.envIntensity;
    }

    function syncGeometry(project) {
      const store = window.IchibanStore;
      const dims = store.getDims(project);
      const frontStock = getSideStock(project, 'front');
      const backStock = getSideStock(project, 'back');
      const frontPreset = MAT_PRESETS[frontStock] || MAT_PRESETS.matte;
      const backPreset = MAT_PRESETS[backStock] || MAT_PRESETS.matte;
      const activeSet = collectActiveSurfaceMaterials(project);
      const cornerMm = Number(project.corner) || 0;
      const hasRelief = activeSet.has('emboss') || activeSet.has('deboss');
      const nextKey = `${dims.w}x${dims.h}|${cornerMm}|${frontStock}|${backStock}|${hasRelief ? 1 : 0}`;

      // 同步卡边物理材质
      if (activeSet.has('gold') && frontStock !== 'black' && frontStock !== 'pvc') {
        edgeMaterial.color.setHex(0xc99e32);
        edgeMaterial.metalness = 0.78;
        edgeMaterial.roughness = 0.38;
        edgeMaterial.transparent = false;
        edgeMaterial.opacity = 1.0;
      } else if (activeSet.has('silver') && frontStock !== 'black' && frontStock !== 'pvc') {
        edgeMaterial.color.setHex(0xaeb6c2);
        edgeMaterial.metalness = 0.78;
        edgeMaterial.roughness = 0.36;
        edgeMaterial.transparent = false;
        edgeMaterial.opacity = 1.0;
      } else if (activeSet.has('copper') && frontStock !== 'black' && frontStock !== 'pvc') {
        edgeMaterial.color.setHex(0xb86b43);
        edgeMaterial.metalness = 0.76;
        edgeMaterial.roughness = 0.4;
        edgeMaterial.transparent = false;
        edgeMaterial.opacity = 1.0;
      } else if (frontStock === 'pvc') {
        edgeMaterial.color.setHex(0xdff6ff);
        edgeMaterial.metalness = 0.0;
        edgeMaterial.roughness = 0.56;
        edgeMaterial.transparent = true;
        edgeMaterial.opacity = 0.58;
      } else {
        edgeMaterial.color.setHex(frontPreset.edgeColor);
        edgeMaterial.metalness = 0.0;
        edgeMaterial.roughness = frontPreset.roughness;
        edgeMaterial.transparent = false;
        edgeMaterial.opacity = 1.0;
      }
      edgeMaterial.needsUpdate = true;

      applyFaceMaterialProps(frontMaterial, frontStock, activeSet);
      applyFaceMaterialProps(backMaterial, backStock, activeSet);

      if (geoKey === nextKey && coreMesh) return;
      geoKey = nextKey;

      if (coreMesh) {
        cardGroup.remove(coreMesh, frontMesh, backMesh);
        coreMesh.geometry.dispose();
        frontMesh.geometry.dispose();
        backMesh.geometry.dispose();
      }

      const worldScale = 3.05 / Math.max(dims.w, dims.h);
      const w = dims.w * worldScale;
      const h = dims.h * worldScale;
      const effCornerMm = cornerMm > 0 ? cornerMm : 0.35;
      const r = effCornerMm * worldScale;

      const coreDepth = Math.max(frontPreset.depth, backPreset.depth) + (hasRelief ? 0.006 : 0);
      const bevelT = coreDepth * 0.16;
      const bevelS = coreDepth * 0.14;

      const shape = buildRoundedRectShape(w, h, r);
      const coreGeo = new THREE.ExtrudeGeometry(shape, {
        depth: coreDepth,
        bevelEnabled: true,
        bevelThickness: bevelT,
        bevelSize: bevelS,
        bevelSegments: 2,
        curveSegments: 20
      });
      coreGeo.translate(0, 0, -coreDepth / 2);

      const frontGeo = createNormalizedFaceGeometry(shape, w, h);
      const backGeo = createNormalizedFaceGeometry(shape, w, h);

      coreMesh = new THREE.Mesh(coreGeo, edgeMaterial);
      coreMesh.castShadow = true;

      const zOffset = coreDepth / 2 + bevelT + 0.0008;
      frontMesh = new THREE.Mesh(frontGeo, frontMaterial);
      frontMesh.position.z = zOffset;

      backMesh = new THREE.Mesh(backGeo, backMaterial);
      backMesh.position.z = -zOffset;
      backMesh.rotation.y = Math.PI;

      cardGroup.add(coreMesh, frontMesh, backMesh);
    }

    async function renderSideTextures(project, side, res, seq) {
      const store = window.IchibanStore;
      const dims = store.getDims(project);
      const matId = getSideStock(project, side);
      const activeSet = collectActiveSurfaceMaterials(project);
      const hasAnySurface = activeSet.size > 0;

      const cw = 1024;
      const ch = Math.max(420, Math.round((cw * dims.h) / dims.w));
      const pw = 512;
      const ph = Math.max(210, Math.round((pw * dims.h) / dims.w));

      if (res.colorCanvas.width !== cw || res.colorCanvas.height !== ch) {
        res.colorCanvas.width = cw;
        res.colorCanvas.height = ch;
      }
      if (res.pbrW !== pw || res.pbrH !== ph) {
        res.pbrW = pw;
        res.pbrH = ph;
        [res.ormCanvas, res.bumpCanvas, res.maskCanvas].forEach((cv) => {
          cv.width = pw;
          cv.height = ph;
        });
      }

      const t = store.getTemplate(project.templateId);
      const isPvcLight = matId === 'pvc' && t.style !== 'stage' && t.style !== 'starlight';
      const snap = extractFaceDomSnapshot(project, side, 560);
      if (seq !== updateSeq) return;

      const css = collectInlineCss().replace(/\]\]>/g, '');
      const colorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="${Math.round((560 * dims.h) / dims.w)}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" class="p3d-tex-root${isPvcLight ? ' is-pvc-light' : ''}">
            <style><![CDATA[${css}${COLOR_OVERRIDE_CSS}
              .p3d-tex-box { width:560px; height:${Math.round((560 * dims.h) / dims.w)}px; }
              .p3d-tex-box .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
            ]]></style>
            <div class="p3d-tex-box">${snap.html}</div>
          </div>
        </foreignObject>
      </svg>`;

      try {
        const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(colorSvg));
        if (seq !== updateSeq) return;
        res.colorCtx.clearRect(0, 0, cw, ch);
        res.colorCtx.drawImage(img, 0, 0, cw, ch);
        res.colorCtx.getImageData(0, 0, 1, 1);
      } catch (err) {
        if (seq !== updateSeq) return;
        await drawFallbackFace(res.colorCtx, cw, ch, snap, false, isPvcLight);
      }
      res.colorTex.needsUpdate = true;

      let maskData = null;
      if (hasAnySurface) {
        const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="${Math.round((560 * dims.h) / dims.w)}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" class="p3d-mask-root">
              <style><![CDATA[${css}${MASK_OVERRIDE_CSS}
                .p3d-tex-box { width:560px; height:${Math.round((560 * dims.h) / dims.w)}px; }
                .p3d-tex-box .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
              ]]></style>
              <div class="p3d-tex-box">${snap.html}</div>
            </div>
          </foreignObject>
        </svg>`;
        try {
          const mImg = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maskSvg));
          if (seq !== updateSeq) return;
          res.maskCtx.clearRect(0, 0, pw, ph);
          res.maskCtx.drawImage(mImg, 0, 0, pw, ph);
          maskData = res.maskCtx.getImageData(0, 0, pw, ph).data;
        } catch (err) {
          if (seq !== updateSeq) return;
          await drawFallbackFace(res.maskCtx, pw, ph, snap, true, false);
          maskData = res.maskCtx.getImageData(0, 0, pw, ph).data;
        }
      }

      synthesizePbrChannels(res, matId, maskData);
    }

    function runUpdate(immediate) {
      const exec = () => {
        const project = getProject();
        if (!project) return;
        const seq = ++updateSeq;
        applyEnvVisuals(project);
        syncGeometry(project);
        renderSideTextures(project, 'front', frontRes, seq);
        renderSideTextures(project, 'back', backRes, seq);
      };
      if (immediate) {
        clearTimeout(debounceTimer);
        exec();
      } else {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(exec, 140);
      }
    }

    function setView(view) {
      if (view === 'front') {
        targetRotX = 0;
        targetRotY = 0;
        targetDist = defaultDist;
      } else if (view === 'back') {
        targetRotX = 0;
        targetRotY = Math.PI;
        targetDist = defaultDist;
      } else if (view === 'side') {
        targetRotX = -0.2;
        targetRotY = 1.28;
        targetDist = defaultDist * 0.72;
      } else if (view === 'macro') {
        targetRotX = -0.38;
        targetRotY = 0.44;
        targetDist = defaultDist * 0.62;
      }
    }

    function setLight(deg) {
      lightDeg = Number(deg) || 0;
      applyLightPosition();
    }

    function setAutoRotate(enabled) {
      autoRotate = Boolean(enabled);
    }

    function setEnv(mode) {
      envMode = ['studio', 'stage', 'sunlit'].includes(mode) ? mode : 'studio';
      applyEnvVisuals(getProject());
    }

    function setPaused(nextPaused) {
      paused = Boolean(nextPaused);
    }

    function onPointerDown(e) {
      if (!interactive) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      renderer.domElement.classList.add('is-dragging');
      renderer.domElement.setPointerCapture && renderer.domElement.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;
      targetRotY += dx * 0.011;
      targetRotX = Math.max(-0.95, Math.min(0.95, targetRotX + dy * 0.0085));
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.classList.remove('is-dragging');
    }

    function onDblClick() {
      targetRotX = -0.14;
      targetRotY = 0.32;
      targetDist = defaultDist;
    }

    function onWheel(e) {
      if (!interactive || !isModal) return;
      e.preventDefault();
      targetDist = Math.max(2.2, Math.min(6.4, targetDist + e.deltaY * 0.003));
    }

    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      renderer.domElement.addEventListener('dblclick', onDblClick);
      if (isModal) {
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      }
    }

    let resizeObs = null;
    function syncSize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(syncSize);
      resizeObs.observe(container);
    }

    function tick() {
      rafId = window.requestAnimationFrame(tick);
      if (paused) return;

      if (autoRotate && !dragging && !reduceMotion) {
        targetRotY += 0.0075;
      }

      curRotX += (targetRotX - curRotX) * 0.14;
      curRotY += (targetRotY - curRotY) * 0.14;
      curDist += (targetDist - curDist) * 0.14;

      cardGroup.rotation.x = curRotX;
      cardGroup.rotation.y = curRotY;
      camera.position.z = curDist;

      const tiltScale = 0.72 + Math.abs(Math.cos(curRotY)) * 0.28;
      contactShadow.scale.set(tiltScale, 0.8 + Math.abs(Math.cos(curRotX)) * 0.2, 1);

      if (envMode === 'stage' && stageGroup.visible && !reduceMotion) {
        const posAttr = particleGeo.attributes.position;
        for (let i = 0; i < particleCount; i++) {
          let py = posAttr.getY(i) + pSpeeds[i] * 0.004;
          if (py > 1.8) py = -1.7;
          posAttr.setY(i, py);
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    }

    applyLightPosition();
    runUpdate(true);
    rafId = window.requestAnimationFrame(tick);

    return {
      update() {
        syncSize();
        runUpdate(false);
      },
      setView,
      setLight,
      setAutoRotate,
      setEnv,
      setPaused,
      getDiagnostics() {
        return {
          engine: 'webgl',
          env: envMode,
          sweep: false,
          dims: { w: renderer.domElement.width, h: renderer.domElement.height },
          rot: { x: Number(curRotX.toFixed(2)), y: Number(curRotY.toFixed(2)) }
        };
      },
      destroy() {
        clearTimeout(debounceTimer);
        if (rafId) window.cancelAnimationFrame(rafId);
        if (resizeObs) resizeObs.disconnect();
        if (interactive) {
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
          renderer.domElement.removeEventListener('dblclick', onDblClick);
          if (isModal) renderer.domElement.removeEventListener('wheel', onWheel);
        }
        if (coreMesh) {
          coreMesh.geometry.dispose();
          frontMesh.geometry.dispose();
          backMesh.geometry.dispose();
        }
        edgeMaterial.dispose();
        frontMaterial.dispose();
        backMaterial.dispose();
        [frontRes, backRes].forEach((r) => {
          r.colorTex.dispose();
          r.ormTex.dispose();
          r.bumpTex.dispose();
        });
        envRT.dispose();
        shadowBlobTex.dispose();
        bokehTex.dispose();
        blindTex.dispose();
        stageFloor.geometry.dispose();
        stageFloor.material.dispose();
        beamGeo.dispose();
        beamMat1.dispose();
        beamMat2.dispose();
        particleGeo.dispose();
        particleMat.dispose();
        sunlitFloor.geometry.dispose();
        sunlitFloor.material.dispose();
        contactShadow.geometry.dispose();
        contactShadow.material.dispose();
        studioShadowFloor.geometry.dispose();
        studioShadowFloor.material.dispose();
        renderer.dispose();
        container.innerHTML = '';
      }
    };
  }

  return {
    mount,
    isWebGLAvailable
  };
})();

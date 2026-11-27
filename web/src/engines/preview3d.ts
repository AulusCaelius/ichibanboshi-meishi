import * as THREE from 'three';
import { getCardDims } from '../stores/useStudioStore';
import type { CardProject, CardTemplate, PaperStockId, RenderEnvId, SurfaceCraftId } from '../types/card';
import { getEffectiveSidePaper, renderCardFaceHtml, resolveCardBgHex } from './renderCardHtml';

interface PaperPreset {
  roughness: number;
  metalness: number;
  bumpScale: number;
  depth: number;
  edgeColor: number;
  transparent: boolean;
  opacity: number;
  envIntensity: number;
}

const MAT_PRESETS: Record<PaperStockId, PaperPreset> = {
  matte: { roughness: 0.72, metalness: 0.0, bumpScale: 0.008, depth: 0.028, edgeColor: 0xf4f1ea, transparent: false, opacity: 1.0, envIntensity: 0.55 },
  cotton: { roughness: 0.92, metalness: 0.0, bumpScale: 0.028, depth: 0.046, edgeColor: 0xf3eee3, transparent: false, opacity: 1.0, envIntensity: 0.45 },
  pearl: { roughness: 0.46, metalness: 0.14, bumpScale: 0.011, depth: 0.032, edgeColor: 0xede7f6, transparent: false, opacity: 1.0, envIntensity: 0.72 },
  black: { roughness: 0.86, metalness: 0.0, bumpScale: 0.014, depth: 0.038, edgeColor: 0x16171c, transparent: false, opacity: 1.0, envIntensity: 0.5 },
  washi: { roughness: 0.9, metalness: 0.0, bumpScale: 0.024, depth: 0.036, edgeColor: 0xefe6d5, transparent: false, opacity: 1.0, envIntensity: 0.46 },
  pvc: { roughness: 0.56, metalness: 0.0, bumpScale: 0.006, depth: 0.024, edgeColor: 0xdff6ff, transparent: true, opacity: 0.85, envIntensity: 0.62 },
};

interface NoiseCacheEntry {
  size: number;
  height: Float32Array;
  sparkle: Float32Array;
}

const PAPER_NOISE_CACHE: Partial<Record<PaperStockId, NoiseCacheEntry>> = {};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getPaperNoise(matId: PaperStockId): NoiseCacheEntry {
  const existing = PAPER_NOISE_CACHE[matId];
  if (existing) return existing;
  const size = 256;
  const height = new Float32Array(size * size);
  const sparkle = new Float32Array(size * size);
  const rng = mulberry32(matId.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 1337));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const n = rng();
      if (matId === 'cotton') {
        const wx = Math.sin((x / size) * Math.PI * 36) * 0.25;
        const wy = Math.cos((y / size) * Math.PI * 36) * 0.25;
        height[idx] = Math.max(0, Math.min(1, 0.5 + wx * wy + (n - 0.5) * 0.55));
      } else if (matId === 'washi') {
        const s1 = Math.sin((x * 0.14 + y * 0.36) * 0.65) * 0.22;
        const s2 = Math.cos((x * 0.28 - y * 0.09) * 0.5) * 0.18;
        height[idx] = Math.max(0, Math.min(1, 0.5 + s1 + s2 + (n - 0.5) * 0.42));
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
  const entry = { size, height, sparkle };
  PAPER_NOISE_CACHE[matId] = entry;
  return entry;
}

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function collectActiveCrafts(project: CardProject): Set<SurfaceCraftId> {
  const active = new Set<SurfaceCraftId>();
  if (project.craft && project.craft !== 'none') active.add(project.craft);
  if (project.regionCrafts) {
    Object.values(project.regionCrafts).forEach((m) => {
      if (m && m !== 'none') active.add(m);
    });
  }
  if (project.standee?.enabled && project.standee.craft && project.standee.craft !== 'none') {
    active.add(project.standee.craft);
  }
  (project.customElements || []).forEach((el) => {
    if (el.craft && el.craft !== 'none') active.add(el.craft);
  });
  return active;
}

function collectInlineCss(): string {
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
    } catch {
      // ignore cross-origin css
    }
  }
  return css.replace(/<\/style>/gi, '');
}

const COLOR_OVERRIDE_CSS = `
  .p3d-tex-root .bcard__face { border-radius: 0 !important; box-shadow: none !important; }
  .p3d-tex-root .craft-gold, .p3d-tex-root .craft-gold * { background: none !important; -webkit-text-fill-color: #C99E32 !important; color: #C99E32 !important; text-shadow: none !important; }
  .p3d-tex-root .craft-silver, .p3d-tex-root .craft-silver * { background: none !important; -webkit-text-fill-color: #AEB6C2 !important; color: #AEB6C2 !important; text-shadow: none !important; }
  .p3d-tex-root .craft-copper, .p3d-tex-root .craft-copper * { background: none !important; -webkit-text-fill-color: #B86B43 !important; color: #B86B43 !important; text-shadow: none !important; }
  .p3d-tex-root .craft-brushed, .p3d-tex-root .craft-brushed * { background: none !important; -webkit-text-fill-color: #98A0AA !important; color: #98A0AA !important; text-shadow: none !important; }
  .p3d-tex-root.is-pvc-light .bcard__face { background-color: rgba(242, 250, 255, 0.72) !important; }
`;

const MASK_OVERRIDE_CSS = `
  .p3d-mask-root, .p3d-mask-root .bcard, .p3d-mask-root .bcard__face { background: transparent !important; background-image: none !important; box-shadow: none !important; border-radius: 0 !important; }
  .p3d-mask-root .bcard__ribbon, .p3d-mask-root .bcard__pattern, .p3d-mask-root .bcard__qr { opacity: 0 !important; visibility: hidden !important; }
  .p3d-mask-root .bcard__content *, .p3d-mask-root .bcard__back-inner *, .p3d-mask-root .el-layer .bcard-el, .p3d-mask-root .bcard__deco-frame { visibility: hidden !important; }
  .p3d-mask-root .craft-gold, .p3d-mask-root .craft-gold *, .p3d-mask-root .craft-silver, .p3d-mask-root .craft-silver *, .p3d-mask-root .craft-copper, .p3d-mask-root .craft-copper * { visibility: visible !important; opacity: 1 !important; color: #FF0000 !important; -webkit-text-fill-color: #FF0000 !important; background: none !important; border-color: #FF0000 !important; text-shadow: none !important; }
  .p3d-mask-root .craft-brushed, .p3d-mask-root .craft-brushed * { visibility: visible !important; opacity: 1 !important; color: #FFFF00 !important; -webkit-text-fill-color: #FFFF00 !important; background: none !important; border-color: #FFFF00 !important; text-shadow: none !important; }
  .p3d-mask-root .craft-uv, .p3d-mask-root .craft-uv * { visibility: visible !important; opacity: 1 !important; color: #00FF00 !important; -webkit-text-fill-color: #00FF00 !important; background: none !important; border-color: #00FF00 !important; text-shadow: none !important; }
  .p3d-mask-root .craft-emboss, .p3d-mask-root .craft-emboss * { visibility: visible !important; opacity: 1 !important; color: #0000FF !important; -webkit-text-fill-color: #0000FF !important; background: none !important; border-color: #0000FF !important; text-shadow: none !important; }
  .p3d-mask-root .craft-deboss, .p3d-mask-root .craft-deboss * { visibility: visible !important; opacity: 1 !important; color: #00FFFF !important; -webkit-text-fill-color: #00FFFF !important; background: none !important; border-color: #00FFFF !important; text-shadow: none !important; }
  .p3d-mask-root .craft-velvet, .p3d-mask-root .craft-velvet * { visibility: visible !important; opacity: 1 !important; color: #FF00FF !important; -webkit-text-fill-color: #FF00FF !important; background: none !important; border-color: #FF00FF !important; text-shadow: none !important; }
`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function buildRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
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

function createNormalizedFaceGeometry(shape: THREE.Shape, w: number, h: number): THREE.ShapeGeometry {
  const geo = new THREE.ShapeGeometry(shape, 20);
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + w / 2) / w;
    uvs[i * 2 + 1] = (pos.getY(i) + h / 2) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function buildStudioEnvMap(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x454750);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const addPanel = (w: number, h: number, hex: number, intensity: number, pos: [number, number, number]) => {
    const g = new THREE.PlaneGeometry(w, h);
    const c = new THREE.Color(hex).multiplyScalar(intensity);
    const m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
    geometries.push(g);
    materials.push(m);
  };
  addPanel(14, 10, 0xfaf8f2, 0.92, [0, 7, 2]);
  addPanel(10, 8, 0xf2ede4, 0.78, [6.5, 2.5, 4.5]);
  addPanel(10, 8, 0xe8eef6, 0.72, [-6.5, 2.0, 4.0]);
  addPanel(16, 16, 0x5c5e66, 0.55, [0, -7, 0]);
  const rt = pmrem.fromScene(envScene, 0.068);
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  pmrem.dispose();
  return rt;
}

function createShadowBlobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(30, 30, 35, 0.24)');
  grad.addColorStop(0.55, 'rgba(30, 30, 35, 0.08)');
  grad.addColorStop(1, 'rgba(30, 30, 35, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function createBokehSpriteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 246, 214, 0.9)');
  grad.addColorStop(0.4, 'rgba(255, 198, 110, 0.42)');
  grad.addColorStop(1, 'rgba(255, 118, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWindowBlindTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
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
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface SideResources {
  colorCanvas: HTMLCanvasElement;
  colorCtx: CanvasRenderingContext2D;
  colorTex: THREE.CanvasTexture;
  ormCanvas: HTMLCanvasElement;
  ormCtx: CanvasRenderingContext2D;
  ormTex: THREE.CanvasTexture;
  bumpCanvas: HTMLCanvasElement;
  bumpCtx: CanvasRenderingContext2D;
  bumpTex: THREE.CanvasTexture;
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  pbrW: number;
  pbrH: number;
}

function synthesizePbrChannels(sideData: SideResources, matId: PaperStockId, maskData: Uint8ClampedArray | null) {
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

      if (maskData && maskData[p4 + 3] > 55) {
        const rOn = maskData[p4] > 120;
        const gOn = maskData[p4 + 1] > 120;
        const bOn = maskData[p4 + 2] > 120;
        if (rOn && gOn && !bOn) {
          metal = 186;
          rough = 112 + (y % 3 === 0 ? 18 : -10);
          bump = Math.max(40, bump + (y % 3 === 0 ? -22 : 12));
        } else if (rOn && !gOn && bOn) {
          metal = 0;
          rough = 250;
          bump = Math.max(30, bump + (paperHeight - 0.5) * 45);
        } else if (!rOn && gOn && bOn) {
          metal = 0;
          rough = Math.min(252, rough + 16);
          bump = Math.max(6, bump - 135);
        } else if (rOn && !gOn && !bOn) {
          metal = 204;
          rough = 98;
          bump = Math.max(16, bump - 32);
        } else if (!rOn && gOn && !bOn) {
          metal = 0;
          rough = 88;
          bump = Math.min(255, bump + 66);
        } else if (!rOn && !gOn && bOn) {
          metal = 0;
          bump = Math.min(255, bump + 145);
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

export interface Preview3DController {
  update: (project: CardProject, template: CardTemplate) => void;
  setView: (view: 'front' | 'back' | 'side' | 'macro') => void;
  setLight: (deg: number) => void;
  setAutoRotate: (enabled: boolean) => void;
  setEnv: (env: RenderEnvId) => void;
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}

export function mountPreview3D(
  container: HTMLElement,
  initialProject: CardProject,
  initialTemplate: CardTemplate,
  opts: { env?: RenderEnvId; autoRotate?: boolean; compact?: boolean } = {},
): Preview3DController {
  let curProject = initialProject;
  let curTemplate = initialTemplate;

  if (!isWebGLAvailable()) {
    container.dataset.engine = 'fallback-2d';
    const render2D = (side: 'front' | 'back' = 'front') => {
      container.innerHTML = `<div class="p-3 flex items-center justify-center h-full">${renderCardFaceHtml(curProject, curTemplate, side)}</div>`;
    };
    render2D('front');
    return {
      update(p, t) {
        curProject = p;
        curTemplate = t;
        render2D(p.side);
      },
      setView(v) {
        render2D(v === 'back' ? 'back' : 'front');
      },
      setLight() {},
      setAutoRotate() {},
      setEnv() {},
      setPaused() {},
      destroy() {
        container.innerHTML = '';
      },
    };
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    container.dataset.engine = 'fallback-2d';
    return {
      update() {},
      setView() {},
      setLight() {},
      setAutoRotate() {},
      setEnv() {},
      setPaused() {},
      destroy() {},
    };
  }

  container.dataset.engine = 'webgl';
  container.innerHTML = '';

  const width = Math.max(container.clientWidth || (opts.compact ? 268 : 720), 180);
  const height = Math.max(container.clientHeight || (opts.compact ? 190 : 440), 140);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.cursor = 'grab';
  container.appendChild(renderer.domElement);

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xefefe9);
  scene.fog = new THREE.Fog(0xefefe9, 7.5, 16);

  const envRT = buildStudioEnvMap(renderer);
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
  const defaultDist = opts.compact ? 4.75 : 4.35;
  let targetDist = defaultDist;
  let curDist = defaultDist;
  camera.position.set(0, 0.12, curDist);
  camera.lookAt(0, 0, 0);

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

  const shadowBlobTex = createShadowBlobTexture();
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.2),
    new THREE.MeshBasicMaterial({ map: shadowBlobTex, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -1.62;
  scene.add(contactShadow);

  const studioShadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: 0.14 }));
  studioShadowFloor.rotation.x = -Math.PI / 2;
  studioShadowFloor.position.y = -1.63;
  studioShadowFloor.receiveShadow = true;
  scene.add(studioShadowFloor);

  const stageGroup = new THREE.Group();
  stageGroup.visible = false;
  const stageFloor = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x161822, roughness: 0.52, metalness: 0.25 }),
  );
  stageFloor.rotation.x = -Math.PI / 2;
  stageFloor.position.y = -1.64;
  stageFloor.receiveShadow = true;
  stageGroup.add(stageFloor);

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
  const stageParticles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      size: 0.2,
      map: bokehTex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  stageGroup.add(stageParticles);
  scene.add(stageGroup);

  const sunlitGroup = new THREE.Group();
  sunlitGroup.visible = false;
  const blindTex = createWindowBlindTexture();
  const sunlitFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ map: blindTex, roughness: 0.78, metalness: 0.0 }),
  );
  sunlitFloor.rotation.x = -Math.PI / 2;
  sunlitFloor.position.y = -1.64;
  sunlitFloor.receiveShadow = true;
  sunlitGroup.add(sunlitFloor);
  scene.add(sunlitGroup);

  const cardGroup = new THREE.Group();
  scene.add(cardGroup);

  function createSideResources(): SideResources {
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = 1024;
    colorCanvas.height = 614;
    const colorCtx = colorCanvas.getContext('2d')!;
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = maxAnisotropy;

    const ormCanvas = document.createElement('canvas');
    ormCanvas.width = 512;
    ormCanvas.height = 307;
    const ormCtx = ormCanvas.getContext('2d')!;
    const ormTex = new THREE.CanvasTexture(ormCanvas);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = 512;
    bumpCanvas.height = 307;
    const bumpCtx = bumpCanvas.getContext('2d')!;
    const bumpTex = new THREE.CanvasTexture(bumpCanvas);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = 512;
    maskCanvas.height = 307;
    const maskCtx = maskCanvas.getContext('2d')!;

    return { colorCanvas, colorCtx, colorTex, ormCanvas, ormCtx, ormTex, bumpCanvas, bumpCtx, bumpTex, maskCanvas, maskCtx, pbrW: 512, pbrH: 307 };
  }

  const frontRes = createSideResources();
  const backRes = createSideResources();

  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.65, metalness: 0.0 });
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: frontRes.colorTex,
    roughnessMap: frontRes.ormTex,
    metalnessMap: frontRes.ormTex,
    roughness: 1.0,
    metalness: 1.0,
    bumpMap: frontRes.bumpTex,
    bumpScale: 0.012,
  });
  const backMaterial = new THREE.MeshStandardMaterial({
    map: backRes.colorTex,
    roughnessMap: backRes.ormTex,
    metalnessMap: backRes.ormTex,
    roughness: 1.0,
    metalness: 1.0,
    bumpMap: backRes.bumpTex,
    bumpScale: 0.012,
  });

  let coreMesh: THREE.Mesh | null = null;
  let frontMesh: THREE.Mesh | null = null;
  let backMesh: THREE.Mesh | null = null;
  let geoKey = '';

  let envMode: RenderEnvId = opts.env || 'studio';
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
  let rafId = 0;

  function applyLightPosition() {
    const rad = (lightDeg * Math.PI) / 180;
    keyLight.position.set(Math.sin(rad) * 4.6, 3.2, Math.cos(rad) * 4.6);
  }

  function applyEnvVisuals() {
    const accentHex = curProject.color || '#FF7600';
    if (envMode === 'stage') {
      scene.background = new THREE.Color(0x11131c);
      scene.fog = new THREE.Fog(0x11131c, 7.5, 16);
      stageGroup.visible = true;
      sunlitGroup.visible = false;
      studioShadowFloor.visible = false;
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.32;
      hemiLight.color.setHex(0xc8d8ff);
      hemiLight.groundColor.setHex(0x141520);
      hemiLight.intensity = 0.56;
      keyLight.color.setHex(0xfff6e8);
      keyLight.intensity = 1.45;
      rimLight.color.set(accentHex);
      rimLight.intensity = 1.9;
    } else if (envMode === 'sunlit') {
      scene.background = new THREE.Color(0xf4ece1);
      scene.fog = new THREE.Fog(0xf4ece1, 7.5, 16);
      stageGroup.visible = false;
      sunlitGroup.visible = true;
      studioShadowFloor.visible = false;
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.48;
      hemiLight.color.setHex(0xfff6e5);
      hemiLight.groundColor.setHex(0xe5d3bc);
      hemiLight.intensity = 0.78;
      keyLight.color.setHex(0xffe7bd);
      keyLight.intensity = 1.5;
      rimLight.color.setHex(0xffffff);
      rimLight.intensity = 0.65;
    } else {
      scene.background = new THREE.Color(0xefefe9);
      scene.fog = new THREE.Fog(0xefefe9, 7.5, 16);
      stageGroup.visible = false;
      sunlitGroup.visible = false;
      studioShadowFloor.visible = true;
      (contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.72;
      hemiLight.color.setHex(0xffffff);
      hemiLight.groundColor.setHex(0xd6d4ce);
      hemiLight.intensity = 0.68;
      keyLight.color.setHex(0xfffdf8);
      keyLight.intensity = 1.35;
      rimLight.color.set(accentHex);
      rimLight.intensity = 0.72;
    }
  }

  function syncGeometry() {
    const dims = getCardDims(curProject);
    const frontStock = getEffectiveSidePaper(curProject, 'front');
    const backStock = getEffectiveSidePaper(curProject, 'back');
    const frontPreset = MAT_PRESETS[frontStock] || MAT_PRESETS.matte;
    const backPreset = MAT_PRESETS[backStock] || MAT_PRESETS.matte;
    const activeSet = collectActiveCrafts(curProject);
    const cornerMm = curProject.cornerMm || (curProject.rounded ? 3 : 0);
    const hasRelief = activeSet.has('emboss') || activeSet.has('deboss');
    const nextKey = `${dims.w}x${dims.h}|${cornerMm}|${frontStock}|${backStock}|${hasRelief ? 1 : 0}`;

    if (activeSet.has('gold') && frontStock !== 'black' && frontStock !== 'pvc') {
      edgeMaterial.color.setHex(0xc99e32);
      edgeMaterial.metalness = 0.78;
      edgeMaterial.roughness = 0.38;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
    } else if (activeSet.has('silver') && frontStock !== 'black' && frontStock !== 'pvc') {
      edgeMaterial.color.setHex(0xaeb6c2);
      edgeMaterial.metalness = 0.78;
      edgeMaterial.roughness = 0.36;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
    } else if (activeSet.has('copper') && frontStock !== 'black' && frontStock !== 'pvc') {
      edgeMaterial.color.setHex(0xb86b43);
      edgeMaterial.metalness = 0.76;
      edgeMaterial.roughness = 0.4;
      edgeMaterial.transparent = false;
      edgeMaterial.opacity = 1;
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
      edgeMaterial.opacity = 1;
    }
    edgeMaterial.needsUpdate = true;

    const syncMat = (mat: THREE.MeshStandardMaterial, preset: PaperPreset) => {
      if (mat.transparent !== preset.transparent) {
        mat.transparent = preset.transparent;
        mat.needsUpdate = true;
      }
      mat.opacity = preset.opacity;
      mat.bumpScale =
        preset.bumpScale +
        (hasRelief ? 0.018 : 0) +
        (activeSet.has('uv') ? 0.005 : 0);
      mat.envMapIntensity = preset.envIntensity;
    };
    syncMat(frontMaterial, frontPreset);
    syncMat(backMaterial, backPreset);

    if (geoKey === nextKey && coreMesh) return;
    geoKey = nextKey;

    if (coreMesh && frontMesh && backMesh) {
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
      curveSegments: 20,
    });
    coreGeo.translate(0, 0, -coreDepth / 2);
    coreMesh = new THREE.Mesh(coreGeo, edgeMaterial);
    coreMesh.castShadow = true;

    const zOffset = coreDepth / 2 + bevelT + 0.0008;
    frontMesh = new THREE.Mesh(createNormalizedFaceGeometry(shape, w, h), frontMaterial);
    frontMesh.position.z = zOffset;

    backMesh = new THREE.Mesh(createNormalizedFaceGeometry(shape, w, h), backMaterial);
    backMesh.position.z = -zOffset;
    backMesh.rotation.y = Math.PI;

    cardGroup.add(coreMesh, frontMesh, backMesh);
  }

  async function renderSideTextures(side: 'front' | 'back', res: SideResources, seq: number) {
    const dims = getCardDims(curProject);
    const matId = getEffectiveSidePaper(curProject, side);
    const activeSet = collectActiveCrafts(curProject);
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

    if (side === 'back' && curProject.sides === 1) {
      res.colorCtx.fillStyle = resolveCardBgHex(curProject, 'back');
      res.colorCtx.fillRect(0, 0, cw, ch);
      res.colorTex.needsUpdate = true;
      synthesizePbrChannels(res, matId, null);
      return;
    }

    const html = renderCardFaceHtml(curProject, curTemplate, side);
    const css = collectInlineCss().replace(/\]\]>/g, '');
    const isPvcLight = matId === 'pvc' && !curProject.bgDark;
    const boxW = 560;
    const boxH = Math.round((560 * dims.h) / dims.w);

    const colorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" class="p3d-tex-root${isPvcLight ? ' is-pvc-light' : ''}">
          <style><![CDATA[${css}${COLOR_OVERRIDE_CSS}
            .p3d-tex-box { width:${boxW}px; height:${boxH}px; }
            .p3d-tex-box .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
          ]]></style>
          <div class="p3d-tex-box">${html}</div>
        </div>
      </foreignObject>
    </svg>`;

    try {
      const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(colorSvg));
      if (seq !== updateSeq) return;
      res.colorCtx.clearRect(0, 0, cw, ch);
      res.colorCtx.drawImage(img, 0, 0, cw, ch);
      res.colorCtx.getImageData(0, 0, 1, 1);
    } catch {
      if (seq !== updateSeq) return;
      res.colorCtx.fillStyle = resolveCardBgHex(curProject, side);
      res.colorCtx.fillRect(0, 0, cw, ch);
      res.colorCtx.fillStyle = curProject.bgDark ? '#F8FAFC' : '#333333';
      res.colorCtx.font = 'bold 48px "Noto Sans SC", sans-serif';
      res.colorCtx.fillText(curProject.fields.name || '制作人Producer', 64, 140);
    }
    res.colorTex.needsUpdate = true;
    renderer.render(scene, camera);

    let maskData: Uint8ClampedArray | null = null;
    if (activeSet.size > 0) {
      const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" class="p3d-mask-root">
            <style><![CDATA[${css}${MASK_OVERRIDE_CSS}
              .p3d-tex-box { width:${boxW}px; height:${boxH}px; }
              .p3d-tex-box .bcard-frame { width:100% !important; max-width:none !important; height:100% !important; }
            ]]></style>
            <div class="p3d-tex-box">${html}</div>
          </div>
        </foreignObject>
      </svg>`;
      try {
        const mImg = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maskSvg));
        if (seq !== updateSeq) return;
        res.maskCtx.clearRect(0, 0, pw, ph);
        res.maskCtx.drawImage(mImg, 0, 0, pw, ph);
        maskData = res.maskCtx.getImageData(0, 0, pw, ph).data;
      } catch {
        maskData = null;
      }
    }

    synthesizePbrChannels(res, matId, maskData);
    renderer.render(scene, camera);
  }

  function refresh() {
    const seq = ++updateSeq;
    applyEnvVisuals();
    syncGeometry();
    void renderSideTextures('front', frontRes, seq);
    void renderSideTextures('back', backRes, seq);
  }

  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    targetRotY += dx * 0.011;
    targetRotX = Math.max(-0.95, Math.min(0.95, targetRotX + dy * 0.0085));
  };
  const onPointerUp = () => {
    dragging = false;
    renderer.domElement.style.cursor = 'grab';
  };
  const onDblClick = () => {
    targetRotX = -0.14;
    targetRotY = 0.32;
    targetDist = defaultDist;
  };
  const onWheel = (e: WheelEvent) => {
    if (opts.compact) return;
    e.preventDefault();
    targetDist = Math.max(2.2, Math.min(6.4, targetDist + e.deltaY * 0.003));
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('dblclick', onDblClick);
  if (!opts.compact) {
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  }

  const syncSize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  };
  const resizeObs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
  resizeObs?.observe(container);

  const tick = () => {
    rafId = window.requestAnimationFrame(tick);
    if (paused) return;
    if (autoRotate && !dragging) targetRotY += 0.0075;
    curRotX += (targetRotX - curRotX) * 0.14;
    curRotY += (targetRotY - curRotY) * 0.14;
    curDist += (targetDist - curDist) * 0.14;
    cardGroup.rotation.x = curRotX;
    cardGroup.rotation.y = curRotY;
    camera.position.z = curDist;

    const tiltScale = 0.72 + Math.abs(Math.cos(curRotY)) * 0.28;
    contactShadow.scale.set(tiltScale, 0.8 + Math.abs(Math.cos(curRotX)) * 0.2, 1);

    if (envMode === 'stage' && stageGroup.visible) {
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        let py = posAttr.getY(i) + pSpeeds[i] * 0.004;
        if (py > 1.8) py = -1.7;
        posAttr.setY(i, py);
      }
      posAttr.needsUpdate = true;
    }

    renderer.render(scene, camera);
  };

  applyLightPosition();
  refresh();
  rafId = window.requestAnimationFrame(tick);

  return {
    update(p, t) {
      curProject = p;
      curTemplate = t;
      syncSize();
      refresh();
    },
    setView(v) {
      if (v === 'front') { targetRotX = 0; targetRotY = 0; targetDist = defaultDist; }
      else if (v === 'back') { targetRotX = 0; targetRotY = Math.PI; targetDist = defaultDist; }
      else if (v === 'side') { targetRotX = -0.2; targetRotY = 1.28; targetDist = defaultDist * 0.72; }
      else if (v === 'macro') { targetRotX = -0.38; targetRotY = 0.44; targetDist = defaultDist * 0.62; }
    },
    setLight(deg) {
      lightDeg = Number(deg) || 0;
      applyLightPosition();
    },
    setAutoRotate(enabled) {
      autoRotate = Boolean(enabled);
    },
    setEnv(nextEnv) {
      envMode = nextEnv;
      applyEnvVisuals();
    },
    setPaused(nextPaused) {
      paused = Boolean(nextPaused);
    },
    destroy() {
      if (rafId) window.cancelAnimationFrame(rafId);
      resizeObs?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      if (!opts.compact) renderer.domElement.removeEventListener('wheel', onWheel);
      [frontRes, backRes].forEach((r) => {
        r.colorTex.dispose();
        r.ormTex.dispose();
        r.bumpTex.dispose();
      });
      bokehTex.dispose();
      shadowBlobTex.dispose();
      blindTex.dispose();
      envRT.dispose();
      renderer.dispose();
      container.innerHTML = '';
    },
  };
}

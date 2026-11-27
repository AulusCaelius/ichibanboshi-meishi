/**
 * Pure ES Module ISO/IEC 18004 QR Code Generator (Byte mode, UTF-8)
 * Supports Versions 1-15 with Error Correction Levels L (7%) & M (15%).
 * Outputs boolean matrix, compact crisp SVG markup, and draws onto Canvas 2D.
 */

// GF(256) with primitive polynomial 0x11D
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
}

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

const POLY_CACHE = new Map();
function rsGeneratorPoly(ecLen) {
  if (POLY_CACHE.has(ecLen)) return POLY_CACHE.get(ecLen);
  let poly = new Uint8Array([1]);
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  POLY_CACHE.set(ecLen, poly);
  return poly;
}

function rsRemainder(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
}

// Version specs (V1..V15): [totalCodewords, ecPerBlock, blocksG1, dataG1, blocksG2, dataG2]
// For ECC L (index 0) and ECC M (index 1)
const VERSION_TABLE = {
  L: [
    null,
    [26, 7, 1, 19, 0, 0],
    [44, 10, 1, 34, 0, 0],
    [70, 15, 1, 55, 0, 0],
    [100, 20, 1, 80, 0, 0],
    [134, 26, 1, 108, 0, 0],
    [172, 18, 2, 68, 0, 0],
    [196, 20, 2, 78, 0, 0],
    [242, 24, 2, 97, 0, 0],
    [292, 30, 2, 116, 0, 0],
    [346, 18, 2, 68, 2, 69],
    [404, 20, 4, 81, 0, 0],
    [466, 24, 2, 92, 2, 93],
    [532, 26, 4, 107, 0, 0],
    [581, 30, 3, 115, 1, 116],
    [655, 22, 5, 87, 1, 88]
  ],
  M: [
    null,
    [26, 10, 1, 16, 0, 0],
    [44, 16, 1, 28, 0, 0],
    [70, 26, 1, 44, 0, 0],
    [100, 18, 2, 32, 0, 0],
    [134, 24, 2, 43, 0, 0],
    [172, 16, 4, 27, 0, 0],
    [196, 18, 4, 31, 0, 0],
    [242, 22, 2, 38, 2, 39],
    [292, 22, 3, 36, 2, 37],
    [346, 26, 4, 43, 1, 44],
    [404, 30, 1, 50, 4, 51],
    [466, 22, 6, 36, 2, 37],
    [532, 22, 8, 37, 1, 38],
    [581, 24, 4, 40, 5, 41],
    [655, 24, 5, 41, 5, 42]
  ]
};

const ALIGNMENT_POSITIONS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70]
];

const REMAINDER_BITS = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 3, 3];

function utf8Bytes(str) {
  return new TextEncoder().encode(String(str ?? ''));
}

function chooseVersion(byteLen, ecl = 'M') {
  const table = VERSION_TABLE[ecl] || VERSION_TABLE.M;
  for (let v = 1; v <= 15; v++) {
    const [, , b1, d1, b2, d2] = table[v];
    const totalDataBytes = b1 * d1 + b2 * d2;
    const countBits = v < 10 ? 8 : 16;
    const neededBits = 4 + countBits + byteLen * 8;
    if (neededBits <= totalDataBytes * 8) {
      return v;
    }
  }
  return 15;
}

function encodeDataCodewords(bytes, version, ecl) {
  const table = VERSION_TABLE[ecl] || VERSION_TABLE.M;
  const [, ecPerBlock, b1, d1, b2, d2] = table[version];
  const totalDataBytes = b1 * d1 + b2 * d2;
  const countBits = version < 10 ? 8 : 16;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  const usableByteLen = Math.min(bytes.length, Math.floor((totalDataBytes * 8 - 4 - countBits) / 8));
  pushBits(usableByteLen, countBits);
  for (let i = 0; i < usableByteLen; i++) {
    pushBits(bytes[i], 8);
  }

  const maxBits = totalDataBytes * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(totalDataBytes);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    data[byteIdx++] = val;
  }
  const padBytes = [0xec, 0x11];
  let padToggle = 0;
  while (byteIdx < totalDataBytes) {
    data[byteIdx++] = padBytes[padToggle & 1];
    padToggle++;
  }

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let i = 0; i < b1; i++) {
    const blk = data.slice(offset, offset + d1);
    offset += d1;
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainder(blk, ecPerBlock));
  }
  for (let i = 0; i < b2; i++) {
    const blk = data.slice(offset, offset + d2);
    offset += d2;
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainder(blk, ecPerBlock));
  }

  const interleaved = [];
  const maxDataLen = Math.max(d1, d2);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < dataBlocks.length; b++) {
      if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      interleaved.push(ecBlocks[b][i]);
    }
  }
  return new Uint8Array(interleaved);
}

function makeEmptyMatrix(size) {
  return {
    size,
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    isFunc: Array.from({ length: size }, () => new Uint8Array(size))
  };
}

function setFunc(mat, x, y, dark) {
  if (x < 0 || y < 0 || x >= mat.size || y >= mat.size) return;
  mat.modules[y][x] = dark ? 1 : 0;
  mat.isFunc[y][x] = 1;
}

function drawFinderPattern(mat, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= mat.size || y >= mat.size) continue;
      setFunc(mat, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignmentPattern(mat, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunc(mat, cx + dx, cy + dy, dist !== 1);
    }
  }
}

function bchFormatBits(eclBits, mask) {
  const data = (eclBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  return (version << 12) | rem;
}

function drawFormatBits(mat, ecl, mask) {
  const eclBits = ecl === 'L' ? 1 : 0; // L=01, M=00
  const bits = bchFormatBits(eclBits, mask);
  const s = mat.size;
  for (let i = 0; i <= 5; i++) setFunc(mat, 8, i, ((bits >>> i) & 1) !== 0);
  setFunc(mat, 8, 7, ((bits >>> 6) & 1) !== 0);
  setFunc(mat, 8, 8, ((bits >>> 7) & 1) !== 0);
  setFunc(mat, 7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunc(mat, 14 - i, 8, ((bits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) setFunc(mat, s - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunc(mat, 8, s - 15 + i, ((bits >>> i) & 1) !== 0);
  setFunc(mat, 8, s - 8, true);
}

function drawVersionBits(mat, version) {
  if (version < 7) return;
  const bits = bchVersionBits(version);
  const s = mat.size;
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) !== 0;
    const a = s - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunc(mat, a, b, bit);
    setFunc(mat, b, a, bit);
  }
}

function drawFunctionPatterns(mat, version, ecl) {
  const s = mat.size;
  for (let i = 0; i < s; i++) {
    setFunc(mat, 6, i, i % 2 === 0);
    setFunc(mat, i, 6, i % 2 === 0);
  }
  drawFinderPattern(mat, 3, 3);
  drawFinderPattern(mat, s - 4, 3);
  drawFinderPattern(mat, 3, s - 4);

  const pos = ALIGNMENT_POSITIONS[version] || [];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) {
        continue;
      }
      drawAlignmentPattern(mat, pos[i], pos[j]);
    }
  }

  drawFormatBits(mat, ecl, 0);
  drawVersionBits(mat, version);
}

function placeCodewords(mat, codewords, remainderBits) {
  const s = mat.size;
  const totalBits = codewords.length * 8 + remainderBits;
  let bitIdx = 0;
  let upward = true;

  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++) {
      const y = upward ? s - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (!mat.isFunc[y][x]) {
          let dark = false;
          if (bitIdx < codewords.length * 8) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
          }
          mat.modules[y][x] = dark ? 1 : 0;
          if (bitIdx < totalBits) bitIdx++;
        }
      }
    }
    upward = !upward;
  }
}

function applyMask(mat, mask) {
  const s = mat.size;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (mat.isFunc[y][x]) continue;
      let inv = false;
      switch (mask) {
        case 0: inv = (x + y) % 2 === 0; break;
        case 1: inv = y % 2 === 0; break;
        case 2: inv = x % 3 === 0; break;
        case 3: inv = (x + y) % 3 === 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        case 7: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      }
      if (inv) mat.modules[y][x] ^= 1;
    }
  }
}

function penaltyScore(mat) {
  const s = mat.size;
  let score = 0;
  let darkCount = 0;

  const linePenalty = (isRow) => {
    for (let i = 0; i < s; i++) {
      let runColor = 0;
      let runLen = 0;
      const runHistory = [];
      for (let j = 0; j < s; j++) {
        const val = isRow ? mat.modules[i][j] : mat.modules[j][i];
        if (isRow && val) darkCount++;
        if (val === runColor) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else {
          runHistory.push(runLen);
          runColor = val;
          runLen = 1;
        }
      }
      runHistory.push(runLen);
      // Finder-like 1:1:3:1:1 pattern check
      for (let k = 0; k <= s - 7; k++) {
        const get = (off) => (isRow ? mat.modules[i][k + off] : mat.modules[k + off][i]);
        if (get(0) && !get(1) && get(2) && get(3) && get(4) && !get(5) && get(6)) {
          const leftClear = k < 4 || (!get(-1) && !get(-2) && !get(-3) && !get(-4));
          const rightClear = k + 10 >= s || (!get(7) && !get(8) && !get(9) && !get(10));
          if (leftClear || rightClear) score += 40;
        }
      }
    }
  };

  linePenalty(true);
  linePenalty(false);

  for (let y = 0; y < s - 1; y++) {
    for (let x = 0; x < s - 1; x++) {
      const c = mat.modules[y][x];
      if (c === mat.modules[y][x + 1] && c === mat.modules[y + 1][x] && c === mat.modules[y + 1][x + 1]) {
        score += 3;
      }
    }
  }

  const total = s * s;
  const pct = (darkCount * 100) / total;
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * Generates QR matrix { size, version, modules } for given UTF-8 string.
 */
export function encodeQrMatrix(text, ecl = 'M') {
  const bytes = utf8Bytes(text || 'https://auluscaelius.github.io/ichibanboshi-meishi/card.html');
  const safeEcl = bytes.length > 260 ? 'L' : ecl;
  const version = chooseVersion(bytes.length, safeEcl);
  const size = version * 4 + 17;
  const codewords = encodeDataCodewords(bytes, version, safeEcl);

  const baseMat = makeEmptyMatrix(size);
  drawFunctionPatterns(baseMat, version, safeEcl);
  placeCodewords(baseMat, codewords, REMAINDER_BITS[version] || 0);

  let bestMask = 0;
  let bestScore = Infinity;
  let bestModules = null;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = {
      size,
      modules: baseMat.modules.map((row) => row.slice()),
      isFunc: baseMat.isFunc
    };
    applyMask(candidate, mask);
    drawFormatBits(candidate, safeEcl, mask);
    const sc = penaltyScore(candidate);
    if (sc < bestScore) {
      bestScore = sc;
      bestMask = mask;
      bestModules = candidate.modules;
    }
  }

  return {
    version,
    size,
    mask: bestMask,
    ecl: safeEcl,
    modules: bestModules
  };
}

/**
 * Renders crisp single-<path> SVG markup for a QR matrix with quiet zone.
 */
export function renderQrSvg(text, opts = {}) {
  const qr = encodeQrMatrix(text, opts.ecl || 'M');
  const border = opts.border != null ? Number(opts.border) : 2;
  const fg = opts.fg || 'currentColor';
  const bg = opts.bg || '#FFFFFF';
  const total = qr.size + border * 2;
  const parts = [];
  for (let y = 0; y < qr.size; y++) {
    const row = qr.modules[y];
    for (let x = 0; x < qr.size; x++) {
      if (row[x]) {
        parts.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }
  }
  const aria = opts.ariaLabel ? ` aria-label="${String(opts.ariaLabel).replace(/"/g, '&quot;')}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"${aria}><rect width="${total}" height="${total}" fill="${bg}"/><path d="${parts.join('')}" fill="${fg}"/></svg>`;
}

/**
 * Draws QR code sharply onto a Canvas 2D context inside the given box.
 */
export function drawQrToCanvas(ctx, text, x, y, w, h, opts = {}) {
  const qr = encodeQrMatrix(text, opts.ecl || 'M');
  const border = opts.border != null ? Number(opts.border) : 2;
  const total = qr.size + border * 2;
  const modW = w / total;
  const modH = h / total;

  ctx.save();
  if (opts.bg !== 'transparent') {
    ctx.fillStyle = opts.bg || '#FFFFFF';
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = opts.fg || '#222222';
  for (let r = 0; r < qr.size; r++) {
    const row = qr.modules[r];
    for (let c = 0; c < qr.size; c++) {
      if (row[c]) {
        const px = Math.floor(x + (c + border) * modW);
        const py = Math.floor(y + (r + border) * modH);
        const pw = Math.ceil(x + (c + border + 1) * modW) - px;
        const ph = Math.ceil(y + (r + border + 1) * modH) - py;
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }
  ctx.restore();
}

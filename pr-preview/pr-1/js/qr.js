// Local QR encoder (byte mode, error correction M). No network, so the address stays on the device.
(function (root) {
  const GS = root.GS || (root.GS = {});

  // ECC level M. Each version lists groups of [block count, data bytes per block] and ECC bytes per block.
  // Totals match ISO/IEC 18004: data bytes + blocks * ecc = raw codeword count.
  const ECC = [
    null,
    { ecc: 10, groups: [[1, 16]] },
    { ecc: 16, groups: [[1, 28]] },
    { ecc: 26, groups: [[1, 44]] },
    { ecc: 18, groups: [[2, 32]] },
    { ecc: 24, groups: [[2, 43]] },
    { ecc: 16, groups: [[4, 27]] },
    { ecc: 18, groups: [[4, 31]] },
    { ecc: 22, groups: [[2, 38], [2, 39]] },
    { ecc: 22, groups: [[3, 36], [2, 37]] },
    { ecc: 26, groups: [[4, 43], [1, 44]] },
  ];
  const ALIGN = [
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
  ];

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  const divisors = new Map();
  function rsDivisor(degree) {
    let divisor = divisors.get(degree);
    if (divisor) return divisor;
    divisor = new Array(degree).fill(0);
    divisor[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < divisor.length; j++) {
        divisor[j] = mul(divisor[j], root);
        if (j + 1 < divisor.length) divisor[j] ^= divisor[j + 1];
      }
      root = mul(root, 0x02);
    }
    divisors.set(degree, divisor);
    return divisor;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (let k = 0; k < data.length; k++) {
      const factor = data[k] ^ result.shift();
      result.push(0);
      for (let i = 0; i < result.length; i++) result[i] ^= mul(divisor[i], factor);
    }
    return result;
  }

  function dataBytes(version) {
    return ECC[version].groups.reduce((sum, [count, len]) => sum + count * len, 0);
  }

  function capacity(version) {
    const countBits = version < 10 ? 8 : 16;
    return Math.floor((dataBytes(version) * 8 - 4 - countBits) / 8);
  }

  function chooseVersion(length) {
    for (let version = 1; version < ECC.length; version++) {
      if (length <= capacity(version)) return version;
    }
    return 0;
  }

  function encodeData(bytes, version) {
    const spec = ECC[version];
    const total = dataBytes(version);
    const bits = [];
    const push = (value, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    push(0b0100, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    for (let i = 0; i < bytes.length; i++) push(bytes[i], 8);
    const room = total * 8 - bits.length;
    push(0, Math.min(4, room));
    while (bits.length % 8) bits.push(0);
    const pad = [0xec, 0x11];
    let p = 0;
    while (bits.length < total * 8) {
      push(pad[p], 8);
      p ^= 1;
    }
    const out = [];
    for (let i = 0; i < total; i++) {
      let value = 0;
      for (let b = 0; b < 8; b++) value = (value << 1) | bits[i * 8 + b];
      out.push(value);
    }
    return { bytes: out, spec };
  }

  function interleave(data, spec) {
    const blocks = [];
    let offset = 0;
    const divisor = rsDivisor(spec.ecc);
    spec.groups.forEach(([count, len]) => {
      for (let i = 0; i < count; i++) {
        const chunk = data.slice(offset, offset + len);
        offset += len;
        blocks.push({ data: chunk, ecc: rsRemainder(chunk, divisor) });
      }
    });
    const out = [];
    const max = Math.max(...blocks.map((b) => b.data.length));
    for (let i = 0; i < max; i++) {
      blocks.forEach((b) => { if (i < b.data.length) out.push(b.data[i]); });
    }
    for (let i = 0; i < spec.ecc; i++) blocks.forEach((b) => out.push(b.ecc[i]));
    return out;
  }

  function blank(n) {
    const dark = [];
    const func = [];
    for (let y = 0; y < n; y++) {
      dark.push(new Array(n).fill(false));
      func.push(new Array(n).fill(false));
    }
    return { n, dark, func };
  }

  function paintFinder(matrix, row, col) {
    const { n, dark, func } = matrix;
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = row + r;
        const x = col + c;
        if (y < 0 || x < 0 || y >= n || x >= n) continue;
        const inside = r >= 0 && c >= 0 && r <= 6 && c <= 6;
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        dark[y][x] = inside && (edge || core);
        func[y][x] = true;
      }
    }
  }

  function overlapsFinder(x, y, n) {
    return (x < 9 && y < 9) || (x < 9 && y >= n - 9) || (x >= n - 9 && y < 9);
  }

  function paintAlignment(matrix, version) {
    const { n, dark, func } = matrix;
    ALIGN[version].forEach((y) => {
      ALIGN[version].forEach((x) => {
        if (overlapsFinder(x, y, n)) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const edge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
            dark[y + dy][x + dx] = edge || (dx === 0 && dy === 0);
            func[y + dy][x + dx] = true;
          }
        }
      });
    });
  }

  function formatBits(mask) {
    let rem = mask;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
    return ((mask << 10) | rem) ^ 0x5412;
  }

  function versionBits(version) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1f25);
    return (version << 12) | rem;
  }

  function reserveFormat(matrix) {
    const { n, func } = matrix;
    const mark = (x, y) => { func[y][x] = true; };
    for (let i = 0; i <= 5; i++) { mark(8, i); mark(i, 8); }
    mark(8, 7);
    mark(8, 8);
    mark(7, 8);
    for (let i = 9; i < 15; i++) mark(14 - i, 8);
    for (let i = 0; i < 8; i++) mark(n - 1 - i, 8);
    for (let i = 8; i < 15; i++) mark(8, n - 15 + i);
    mark(8, n - 8);
  }

  function drawFormat(matrix, mask) {
    const { n, dark } = matrix;
    const bits = formatBits(mask);
    const on = (i) => ((bits >>> i) & 1) === 1;
    const set = (x, y, value) => { dark[y][x] = value; };
    for (let i = 0; i <= 5; i++) set(8, i, on(i));
    set(8, 7, on(6));
    set(8, 8, on(7));
    set(7, 8, on(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, on(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, on(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, on(i));
    set(8, n - 8, true);
  }

  function drawVersion(matrix, version) {
    if (version < 7) return;
    const { n, dark, func } = matrix;
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      dark[b][a] = on;
      dark[a][b] = on;
      func[b][a] = true;
      func[a][b] = true;
    }
  }

  function buildMatrix(version) {
    const n = 21 + (version - 1) * 4;
    const matrix = blank(n);
    paintFinder(matrix, 0, 0);
    paintFinder(matrix, 0, n - 7);
    paintFinder(matrix, n - 7, 0);
    for (let i = 0; i < n; i++) {
      if (!matrix.func[6][i]) {
        matrix.dark[6][i] = i % 2 === 0;
        matrix.func[6][i] = true;
      }
      if (!matrix.func[i][6]) {
        matrix.dark[i][6] = i % 2 === 0;
        matrix.func[i][6] = true;
      }
    }
    paintAlignment(matrix, version);
    matrix.dark[4 * version + 9][8] = true;
    matrix.func[4 * version + 9][8] = true;
    drawVersion(matrix, version);
    reserveFormat(matrix);
    return matrix;
  }

  function placeData(matrix, codewords) {
    const { n, dark, func } = matrix;
    const bits = [];
    codewords.forEach((word) => {
      for (let i = 7; i >= 0; i--) bits.push((word >>> i) & 1);
    });
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (func[y][x] || i >= bits.length) continue;
          dark[y][x] = bits[i] === 1;
          i++;
        }
      }
    }
  }

  function maskFlips(mask, y, x) {
    switch (mask) {
      case 0: return (y + x) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (y + x) % 3 === 0;
      case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5: return ((y * x) % 2) + ((y * x) % 3) === 0;
      case 6: return (((y * x) % 2) + ((y * x) % 3)) % 2 === 0;
      default: return (((y + x) % 2) + ((y * x) % 3)) % 2 === 0;
    }
  }

  function applyMask(matrix, mask) {
    const { n, dark, func } = matrix;
    const copy = dark.map((row) => row.slice());
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!func[y][x] && maskFlips(mask, y, x)) copy[y][x] = !copy[y][x];
      }
    }
    return { n, dark: copy, func };
  }

  function penalty(dark) {
    const n = dark.length;
    let score = 0;
    const runs = (line) => {
      let run = 1;
      for (let i = 1; i < line.length; i++) {
        if (line[i] === line[i - 1]) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    };
    for (let y = 0; y < n; y++) runs(dark[y]);
    for (let x = 0; x < n; x++) runs(dark.map((row) => row[x]));
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const v = dark[y][x];
        if (v === dark[y][x + 1] && v === dark[y + 1][x] && v === dark[y + 1][x + 1]) score += 3;
      }
    }
    const finderLike = (line) => {
      let s = '';
      for (let i = 0; i < line.length; i++) s += line[i] ? '1' : '0';
      for (let i = 0; i + 11 <= s.length; i++) {
        const w = s.slice(i, i + 11);
        if (w === '10111010000' || w === '00001011101') score += 40;
      }
    };
    for (let y = 0; y < n; y++) finderLike(dark[y]);
    for (let x = 0; x < n; x++) finderLike(dark.map((row) => row[x]));
    let filled = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (dark[y][x]) filled++;
    score += Math.floor(Math.abs(filled * 100 / (n * n) - 50) / 5) * 10;
    return score;
  }

  function modules(text) {
    const bytes = new TextEncoder().encode(String(text));
    const version = chooseVersion(bytes.length);
    if (!version) return null;
    const packed = encodeData(bytes, version);
    const matrix = buildMatrix(version);
    placeData(matrix, interleave(packed.bytes, packed.spec));
    let best = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const masked = applyMask(matrix, mask);
      drawFormat(masked, mask);
      const score = penalty(masked.dark);
      if (score < bestScore) {
        bestScore = score;
        best = masked.dark;
      }
    }
    return best;
  }

  function draw(canvas, text) {
    const grid = modules(text);
    if (!grid || !canvas) return false;
    const quiet = 4;
    const cells = grid.length + quiet * 2;
    const scale = Math.max(6, Math.round(320 / cells));
    canvas.width = canvas.height = cells * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#12131c';
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid.length; x++) {
        if (!grid[y][x]) continue;
        ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
    return true;
  }

  GS.qr = { draw, modules };
})(typeof window !== 'undefined' ? window : globalThis);

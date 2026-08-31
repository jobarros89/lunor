const VERSION = 4;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const MAX_BYTES = 78;

function gfMultiply(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = ((z << 1) ^ ((z >>> 7) * 0x11d)) & 0xff;
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function reedSolomonDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

function encodeCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > MAX_BYTES) {
    throw new Error(`QR payload too long: ${bytes.length} bytes`);
  }

  const bits: number[] = [];
  const append = (number: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((number >>> i) & 1);
  };

  append(0b0100, 4); // byte mode
  append(bytes.length, 8); // version 1–9
  for (const byte of bytes) append(byte, 8);

  const capacity = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, capacity - bits.length); i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }

  const pads = [0xec, 0x11];
  for (let i = 0; data.length < DATA_CODEWORDS; i++) data.push(pads[i % 2]);

  return [
    ...data,
    ...reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS)),
  ];
}

/**
 * Gera um QR Code Model 2, versão 4-L, localmente.
 * A versão é fixa de propósito: o fluxo Kids usa URLs curtas (/q/<token>) e
 * assim não depende de API, imagem remota ou pacote de terceiros em runtime.
 */
export function makeQrMatrix(value: string): boolean[][] {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
  const isFunction = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  // Timing patterns.
  for (let i = 0; i < SIZE; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  const drawFinder = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(SIZE - 4, 3);
  drawFinder(3, SIZE - 4);

  // Version 4 usa posições de alinhamento [6, 26]; apenas (26, 26) não
  // colide com um finder.
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunction(26 + dx, 26 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  const drawFormatBits = (mask: number) => {
    // Error correction L = 01.
    const data = (1 << 3) | mask;
    let remainder = data;
    for (let i = 0; i < 10; i++) {
      remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    }
    const bits = ((data << 10) | remainder) ^ 0x5412;
    const bit = (index: number) => ((bits >>> index) & 1) !== 0;

    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(i));

    for (let i = 0; i < 8; i++) setFunction(SIZE - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFunction(8, SIZE - 15 + i, bit(i));
    setFunction(8, SIZE - 8, true); // dark module
  };

  // Reserva módulos de formato antes de inserir os dados.
  drawFormatBits(0);

  const codewords = encodeCodewords(value);
  const dataBits: number[] = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >>> i) & 1);
  }

  let bitIndex = 0;
  let right = SIZE - 1;
  let upward = true;
  while (right >= 1) {
    if (right === 6) right--;
    for (let vertical = 0; vertical < SIZE; vertical++) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (isFunction[y][x]) continue;
        modules[y][x] = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        bitIndex++;
      }
    }
    upward = !upward;
    right -= 2;
  }

  // Máscara 0. Um mask fixo continua sendo QR válido e mantém o encoder
  // pequeno; o payload deste fluxo é curto e aleatório.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isFunction[y][x] && (x + y) % 2 === 0) modules[y][x] = !modules[y][x];
    }
  }

  drawFormatBits(0);
  return modules;
}

export function qrSvgMarkup(value: string, moduleSize = 6, quietZone = 4) {
  const matrix = makeQrMatrix(value);
  const fullSize = (matrix.length + quietZone * 2) * moduleSize;
  const rects: string[] = [];

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y][x]) continue;
      rects.push(
        `<rect x="${(x + quietZone) * moduleSize}" y="${(y + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${fullSize}" height="${fullSize}" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects.join("")}</g></svg>`;
}

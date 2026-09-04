"use client";

import { useMemo } from "react";

const SIZE = 37;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;

function gfMultiply(x: number, y: number) {
  let z = 0;
  for (let i = 0; i < 8; i += 1) {
    if ((y & 1) !== 0) z ^= x;
    y >>>= 1;
    x <<= 1;
    if ((x & 0x100) !== 0) x ^= 0x11d;
  }
  return z;
}

function reedSolomonGenerator(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const divisor = reedSolomonGenerator(degree);
  const result = Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

function encodeQr(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 106) throw new Error("invite_url_too_long");

  const bits: number[] = [];
  const appendBits = (val: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };

  appendBits(0b0100, 4);
  appendBits(bytes.length, 8);
  for (const byte of bytes) appendBits(byte, 8);

  const capacityBits = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, capacityBits - bits.length); i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }

  const codewords = [...data, ...reedSolomonRemainder(data, ECC_CODEWORDS)];
  const modules = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const functions = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    modules[y][x] = dark;
    functions[y][x] = true;
  };

  const drawFinder = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(SIZE - 4, 3);
  drawFinder(3, SIZE - 4);

  for (let i = 0; i < SIZE; i += 1) {
    if (!functions[6][i]) setFunction(i, 6, i % 2 === 0);
    if (!functions[i][6]) setFunction(6, i, i % 2 === 0);
  }

  for (const centerY of [6, 30]) {
    for (const centerX of [6, 30]) {
      if (functions[centerY][centerX]) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const drawFormatBits = () => {
    const dataBits = 1 << 3; // nível L, máscara 0
    let remainder = dataBits;
    for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const format = ((dataBits << 10) | remainder) ^ 0x5412;
    const bit = (index: number) => ((format >>> index) & 1) !== 0;

    for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, bit(i));
    setFunction(8, SIZE - 8, true);
  };

  drawFormatBits();

  const payloadBits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1)
  );
  let bitIndex = 0;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functions[y][x]) continue;
        let dark = (payloadBits[bitIndex] ?? 0) !== 0;
        bitIndex += 1;
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
      }
    }
  }

  drawFormatBits();
  return modules;
}

export function FamilyInviteQr({ value, label }: { value: string; label: string }) {
  const matrix = useMemo(() => encodeQr(value), [value]);
  const quietZone = 4;
  const fullSize = SIZE + quietZone * 2;
  const path = useMemo(() => {
    const commands: string[] = [];
    matrix.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) commands.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`);
      });
    });
    return commands.join("");
  }, [matrix]);

  return (
    <svg
      viewBox={`0 0 ${fullSize} ${fullSize}`}
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-56 rounded-2xl bg-white p-2 text-black"
      shapeRendering="crispEdges"
    >
      <rect width={fullSize} height={fullSize} fill="white" />
      <path d={path} fill="currentColor" />
    </svg>
  );
}

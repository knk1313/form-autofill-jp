// アイコン（DADS のキーカラー（blue-900）の角丸の四角に、白い入力欄の線）を PNG で書き出す。依存なしで node だけで動く
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function draw(size) {
  const S = 4; // 4x4 の超標本化でふちを滑らかにする
  const px = new Float32Array(size * size * 4);
  const r = 0.22, blue = [0, 23, 193], white = [255, 255, 255];
  const inRound = (x, y, x0, y0, x1, y1, rr) => {
    const cx = Math.min(Math.max(x, x0 + rr), x1 - rr), cy = Math.min(Math.max(y, y0 + rr), y1 - rr);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr && x >= x0 && x <= x1 && y >= y0 && y <= y1;
  };
  // 白い線：ラベル（短い）＋入力欄（長い）を3段
  const bars = [0.27, 0.47, 0.67].flatMap((y) => [[0.2, y, 0.34, y + 0.1], [0.4, y, 0.8, y + 0.1]]);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let acc = [0, 0, 0, 0];
    for (let sj = 0; sj < S; sj++) for (let si = 0; si < S; si++) {
      const x = (i + (si + 0.5) / S) / size, y = (j + (sj + 0.5) / S) / size;
      if (!inRound(x, y, 0.04, 0.04, 0.96, 0.96, r)) continue;
      const onBar = bars.some(([x0, y0, x1, y1]) => inRound(x, y, x0, y0, x1, y1, 0.04));
      const col = onBar ? white : blue;
      acc = [acc[0] + col[0], acc[1] + col[1], acc[2] + col[2], acc[3] + 255];
    }
    const n = S * S, k = (j * size + i) * 4, a = acc[3] / n;
    px.set(a ? [acc[0] / (acc[3] / 255), acc[1] / (acc[3] / 255), acc[2] / (acc[3] / 255), a] : [0, 0, 0, 0], k);
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) {
    raw[j * (size * 4 + 1)] = 0;
    for (let i = 0; i < size * 4; i++) raw[j * (size * 4 + 1) + 1 + i] = Math.round(px[j * size * 4 + i]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [16, 32, 48, 128]) writeFileSync(new URL(`../icons/icon${s}.png`, import.meta.url), draw(s));
console.log('icons/ に書き出しました');

import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { assessCutout } from "../src/lib/studio/cutout-quality";
import {
  decontaminateEdges,
  rasterToSoftAlpha,
  refineMaskRaster,
} from "../src/lib/studio/mask-refine";

function rect(w: number, h: number, x1: number, y1: number, x2: number, y2: number, v = 1) {
  const r = new Uint8Array(w * h);
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) r[y * w + x] = v;
  return r;
}
const count = (r: Uint8Array) => r.reduce((n, v) => n + v, 0);

test("refine drops speckles and keeps the main body", () => {
  const w = 100;
  const h = 100;
  const r = rect(w, h, 20, 10, 80, 90);
  r[3 * w + 3] = 1;
  r[4 * w + 3] = 1; // 2px speckle far from the body
  const { mask, stats } = refineMaskRaster(r, w, h);
  assert.equal(mask[3 * w + 3], 0);
  assert.equal(stats.secondaryComponents, 0);
  assert.equal(count(mask), 61 * 81);
});

test("refine fills small enclosed holes but keeps large ones (handle) open", () => {
  const w = 100;
  const h = 100;
  const r = rect(w, h, 10, 10, 90, 90);
  for (const [x, y] of [[80, 80], [81, 80]]) r[y * w + x] = 0; // highlight pinhole
  const big = rect(w, h, 30, 30, 60, 60); // 31x31 hole
  for (let i = 0; i < r.length; i++) if (big[i]) r[i] = 0;
  const { mask, stats } = refineMaskRaster(r, w, h);
  assert.equal(mask[80 * w + 80], 1, "pinhole filled");
  assert.equal(mask[45 * w + 45], 0, "large hole stays open");
  assert.equal(stats.filledHoles, 1);
  assert.ok(stats.openHoleRatio > 0.1);
});

test("hole touching the box border is background, not a hole", () => {
  const w = 60;
  const h = 60;
  const r = rect(w, h, 0, 0, 59, 59);
  for (let y = 0; y < 20; y++) for (let x = 20; x < 40; x++) r[y * w + x] = 0; // notch open to top border
  const { mask } = refineMaskRaster(r, w, h);
  assert.equal(mask[5 * w + 30], 0);
});

test("regression: upscaling a mask keeps one alpha byte per pixel (sharp 3-channel quirk)", async () => {
  const w = 40;
  const h = 100;
  const r = rect(w, h, 5, 5, 34, 94);
  const alpha = await rasterToSoftAlpha(r, w, h, 130, 330);
  assert.equal(alpha.length, 130 * 330);
  assert.equal(alpha[165 * 130 + 65], 255, "centre solid");
  assert.equal(alpha[2 * 130 + 2], 0, "corner transparent");
  // The edge is anti-aliased, not a 0/255 staircase
  let partial = 0;
  for (const a of alpha) if (a > 0 && a < 255) partial++;
  assert.ok(partial > 100);
  // No interleaving artefacts: rows are identical inside the solid body
  const rowA = alpha.subarray(165 * 130 + 40, 165 * 130 + 90);
  const rowB = alpha.subarray(200 * 130 + 40, 200 * 130 + 90);
  assert.deepEqual(rowA, rowB);
});

test("decontamination removes background colour from edge pixels", async () => {
  const w = 60;
  const h = 60;
  const alpha = Buffer.alloc(w * h, 0);
  const rgb = Buffer.alloc(w * h * 3, 255); // white wall everywhere
  for (let y = 10; y < 50; y++) {
    for (let x = 10; x < 50; x++) {
      const i = y * w + x;
      const edge = x < 13 || x >= 47 || y < 13 || y >= 47;
      alpha[i] = edge ? 128 : 255;
      rgb[i * 3] = 120;
      rgb[i * 3 + 1] = 0;
      rgb[i * 3 + 2] = 120; // purple product
    }
  }
  for (let y = 10; y < 50; y++) {
    for (let x = 10; x < 13; x++) {
      const i = (y * w + x) * 3;
      rgb[i] = 190;
      rgb[i + 1] = 128;
      rgb[i + 2] = 190; // edge pixels mixed with the white wall
    }
  }
  const out = await decontaminateEdges(rgb, alpha, w, h);
  const i = (30 * w + 11) * 3;
  assert.ok(out[i + 1] < 40, `edge green channel pulled back to purple, got ${out[i + 1]}`);
  assert.equal(out[(30 * w + 30) * 3], 120, "interior untouched");
});

const box = (w: number, h: number) => ({ x1: 100, y1: 100, x2: 100 + w - 1, y2: 100 + h - 1, w: 1000, h: 1000 });

function assess(mask: Uint8Array, w: number, h: number, pixelBox = box(w, h)) {
  const { mask: m, stats } = refineMaskRaster(mask, w, h);
  return assessCutout({ mask: m, width: w, height: h, stats, pixelBox });
}

test("gate passes a bottle-like silhouette", () => {
  const w = 200;
  const h = 600;
  const r = rect(w, h, 10, 120, 190, 590);
  for (let y = 0; y < 120; y++) for (let x = 70; x < 130; x++) r[y * w + x] = 1; // neck
  const res = assess(r, w, h, { x1: 300, y1: 100, x2: 499, y2: 699, w: 1000, h: 1000 });
  assert.equal(res.ok, true, res.reasons.join(","));
});

test("gate rejects tiny, sparse, boxy, fragmented, ragged and cropped masks", () => {
  const w = 200;
  const h = 200;
  // tiny box relative to the photo
  assert.ok(assess(rect(w, h, 0, 0, 199, 199), w, h, { x1: 0, y1: 0, x2: 9, y2: 9, w: 1000, h: 1000 }).reasons.includes("too_small"));
  // sparse
  assert.ok(assess(rect(w, h, 90, 90, 100, 100), w, h).reasons.includes("sparse_mask"));
  // box-like (everything selected)
  assert.ok(assess(rect(w, h, 0, 0, 199, 199), w, h).reasons.includes("box_like"));
  // fragmented: two big separate blobs
  const frag = rect(w, h, 0, 0, 80, 199);
  for (let y = 0; y < h; y++) for (let x = 120; x < 190; x++) frag[y * w + x] = 1;
  assert.ok(assess(frag, w, h).reasons.includes("fragmented"));
  // cropped: product runs along the photo's left edge
  assert.ok(assess(rect(w, h, 0, 20, 120, 180), w, h, { x1: 0, y1: 100, x2: 199, y2: 299, w: 1000, h: 1000 }).reasons.includes("cropped_product"));
  // ragged: thin diagonal strip
  const rag = new Uint8Array(w * h);
  for (let i = 0; i < 190; i++) for (let t = 0; t < 8; t++) rag[i * w + Math.min(w - 1, i + t)] = 1;
  const r = assess(rag, w, h);
  assert.ok(r.reasons.includes("ragged") || r.reasons.includes("sparse_mask"), r.reasons.join(","));
});

test("a full cutout pipeline step produces an RGBA PNG", async () => {
  const w = 40;
  const h = 60;
  const alpha = await rasterToSoftAlpha(rect(w, h, 4, 4, 35, 55), w, h, 80, 120);
  const rgb = Buffer.alloc(80 * 120 * 3, 90);
  const png = await sharp(await decontaminateEdges(rgb, alpha, 80, 120), { raw: { width: 80, height: 120, channels: 3 } })
    .joinChannel(alpha, { raw: { width: 80, height: 120, channels: 1 } })
    .png()
    .toBuffer();
  const meta = await sharp(png).metadata();
  assert.equal(meta.channels, 4);
});

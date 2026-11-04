// AI Lab: run the SAM 3.1 cutout on a local photo and dump every intermediate
// artifact, so cutout quality can be debugged without the website flow.
// Usage: pnpm lab:cutout <photo|dir> [--hint "water bottle"]
import { decodeMaskToRaster, type SegmentationMask } from "@meta-sam/parser";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { callModelWithTelemetry } from "../../src/lib/gateway";
import { CutoutFailedError, cutoutProduct } from "../../src/lib/studio/cutout";
import { normalizePhoto, photoToModelDataUrl } from "../../src/lib/studio/photo";

type SamOut = {
  rawSegmentationText?: string;
  mask?: SegmentationMask | null;
  pixelBox?: { x1: number; y1: number; x2: number; y2: number; w: number; h: number } | null;
  bbox?: unknown;
  confidence?: number | null;
  issue?: string | null;
};

const args = process.argv.slice(2);
const hintIdx = args.indexOf("--hint");
const hint = hintIdx >= 0 ? args.splice(hintIdx, 2)[1] : undefined;
const target = args[0];
if (!target) {
  console.error('Usage: pnpm lab:cutout <photo|dir> [--hint "bottle"]');
  process.exit(1);
}

async function bg(
  cut: Buffer,
  color: string | "checker",
): Promise<Buffer> {
  const meta = await sharp(cut).metadata();
  const w = meta.width!;
  const h = meta.height!;
  let base: ReturnType<typeof sharp>;
  if (color === "checker") {
    const s = 16;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><pattern id="p" width="${s * 2}" height="${s * 2}" patternUnits="userSpaceOnUse"><rect width="${s * 2}" height="${s * 2}" fill="#ccc"/><rect width="${s}" height="${s}" fill="#fff"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="#fff"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`;
    base = sharp(Buffer.from(svg));
  } else {
    base = sharp({ create: { width: w, height: h, channels: 3, background: color } });
  }
  return base.composite([{ input: cut }]).png().toBuffer();
}

async function runOne(file: string) {
  const name = path.parse(file).name;
  const out = path.join("scratch/lab", `${new Date().toISOString().replace(/[:.]/g, "-")}-${name}`);
  fs.mkdirSync(out, { recursive: true });
  const w = (f: string, d: Buffer | string) => fs.writeFileSync(path.join(out, f), d);

  const photo = await normalizePhoto(fs.readFileSync(file));
  w("00_input.png", photo.uprightPng);
  const report: Record<string, unknown> = { file, width: photo.width, height: photo.height, hint };

  // Diagnostic SAM call (raw output + mask decode)
  const dataUrl = await photoToModelDataUrl(photo, 2048);
  const t0 = Date.now();
  const { data: sam, telemetry } = await callModelWithTelemetry<
    { imageUrl: string; labelHint: string },
    SamOut
  >({
    step: "cutout",
    model: "sam-3.1",
    input: { imageUrl: dataUrl, labelHint: hint?.trim() || "main product" },
  });
  report.samLatencyMs = Date.now() - t0;
  report.telemetry = telemetry;
  const rawText: string = sam.rawSegmentationText ?? "";
  w("01_sam_raw.txt", rawText.replace(/(data=)[^|]{80,}/g, (_, p) => `${p}<…truncated…>`));
  report.issue = sam.issue ?? null;
  report.pixelBox = sam.pixelBox;
  report.bbox = sam.bbox;
  report.confidence = sam.confidence;
  report.masksInRaw = (rawText.match(/<\|mask;/g) ?? []).length;
  report.boxesInRaw = (rawText.match(/<\|box;/g) ?? []).length;

  if (sam.mask && sam.pixelBox) {
    const m = sam.mask as { width: number; height: number; encoding: string };
    const raster = decodeMaskToRaster(sam.mask);
    let fg = 0;
    for (const v of raster) if (v) fg++;
    report.mask = { width: m.width, height: m.height, encoding: m.encoding, fgRatio: fg / raster.length };
    const png = Buffer.alloc(raster.length);
    for (let i = 0; i < raster.length; i++) png[i] = raster[i] ? 255 : 0;
    w("02_mask_raw.png", await sharp(png, { raw: { width: m.width, height: m.height, channels: 1 } }).png().toBuffer());

    // Overlay: mask (red) + box (green) on SAM's frame
    const pb = sam.pixelBox as { x1: number; y1: number; x2: number; y2: number; w: number; h: number };
    const frame = await sharp(photo.uprightPng).resize(pb.w, pb.h, { fit: "fill" }).png().toBuffer();
    const red = await sharp(png, { raw: { width: m.width, height: m.height, channels: 1 } })
      .resize(pb.x2 - pb.x1 + 1, pb.y2 - pb.y1 + 1, { fit: "fill" })
      .extractChannel(0)
      .raw()
      .toBuffer();
    const redRgba = await sharp({
      create: { width: pb.x2 - pb.x1 + 1, height: pb.y2 - pb.y1 + 1, channels: 3, background: "#ff0000" },
    })
      .joinChannel(Buffer.from(red.map((v) => (v ? 140 : 0))), {
        raw: { width: pb.x2 - pb.x1 + 1, height: pb.y2 - pb.y1 + 1, channels: 1 },
      })
      .png()
      .toBuffer();
    const boxSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pb.w}" height="${pb.h}"><rect x="${pb.x1}" y="${pb.y1}" width="${pb.x2 - pb.x1 + 1}" height="${pb.y2 - pb.y1 + 1}" fill="none" stroke="#00ff00" stroke-width="4"/></svg>`;
    w(
      "03_overlay.png",
      await sharp(frame)
        .composite([{ input: redRgba, left: pb.x1, top: pb.y1 }, { input: Buffer.from(boxSvg) }])
        .png()
        .toBuffer(),
    );
  }

  // Production cutout (second SAM call: results may differ slightly run to run)
  try {
    const cut = await cutoutProduct({ photo, labelHint: hint });
    w("04_cutout.png", cut.cutoutBuffer);
    w("04_cutout_on_white.png", await bg(cut.cutoutBuffer, "#ffffff"));
    w("04_cutout_on_dark.png", await bg(cut.cutoutBuffer, "#222222"));
    w("04_cutout_on_checker.png", await bg(cut.cutoutBuffer, "checker"));
    const alpha = await sharp(cut.cutoutBuffer).extractChannel(3).raw().toBuffer();
    let opaque = 0;
    let partial = 0;
    for (const a of alpha) {
      if (a === 255) opaque++;
      else if (a > 0) partial++;
    }
    report.cutout = {
      width: cut.width,
      height: cut.height,
      opaqueRatio: opaque / alpha.length,
      partialAlphaRatio: partial / alpha.length,
      confidence: cut.confidence,
      quality: cut.quality,
      costUsd: cut.telemetry.costUsd,
      samCalls: cut.telemetry.images,
    };
  } catch (e) {
    report.cutoutError = (e as Error).message;
    if (e instanceof CutoutFailedError) {
      report.cutoutRejected = { reasons: e.reasons, hints: e.hints, costUsd: e.telemetry.costUsd };
    }
  }

  w("report.json", JSON.stringify(report, null, 2));
  console.log(`\n== ${file}\n-> ${out}\n${JSON.stringify(report, null, 2)}`);
}

const files = fs.statSync(target).isDirectory()
  ? fs.readdirSync(target).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => path.join(target, f))
  : [target];
async function main() {
  for (const f of files) await runOne(f);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

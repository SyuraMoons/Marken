// AI Lab: Test contemporary templates with palette extraction and determinism.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { extractProductPalette } from "../../src/lib/studio/palette";
import { renderLayeredSlide } from "../../src/lib/studio/render";
import { applyTemplateLayout, buildTemplateBackgroundShapes, type TemplateId } from "../../src/lib/studio/templates";

async function main() {
  const cutoutPath = "scratch/lab/2026-11-03T17-22-11-746Z-bottle_hires/04_cutout.png";
  const scenePath = "scratch/lab/2026-11-03T17-23-50-880Z-slide-bottle_hires/scene.png";

  if (!fs.existsSync(cutoutPath) || !fs.existsSync(scenePath)) {
    console.error("Missing test assets. Run previous lab first.");
    process.exit(1);
  }

  const cutoutBuffer = fs.readFileSync(cutoutPath);
  const sceneBuffer = fs.readFileSync(scenePath);
  const palette = await extractProductPalette(cutoutBuffer);

  const outDir = path.join("scratch/lab", `templates-test-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const templates: Array<{
    id: TemplateId;
    headline: string;
    subline?: string;
    cta?: string;
    bigWord?: string;
  }> = [
    {
      id: "big-type-behind",
      bigWord: "COLD",
      headline: "WHAT IS INSIDE?",
      subline: "24 HOURS ICE-COLD FRESHNESS",
      cta: "SWIPE TO EXPLORE",
    },
    {
      id: "color-block",
      headline: "TIRED OF LUKEWARM SIPS?",
      subline: "Double-wall pure vacuum insulation",
      cta: "TAP TO UPGRADE YOUR DAILY SIP",
    },
    {
      id: "pedestal-hero",
      headline: "STAY COLD ALL DAY.",
      subline: "Engineered for pure refreshing taste",
      cta: "SWIPE FOR COLORWAYS",
    },
    {
      id: "tilted-hero",
      headline: "FREEZE TIME",
      subline: "Zero condensation. 100% pure ice.",
      cta: "SHOP NOW IN BIO",
    },
  ];

  const results: Buffer[] = [];

  for (const t of templates) {
    const layers = applyTemplateLayout({
      templateId: t.id,
      sceneBrief: "Ice cold pedestal with frosty mist",
      headline: t.headline,
      subline: t.subline,
      cta: t.cta,
      bigWord: t.bigWord,
      palette,
    });

    const backgroundShapes = buildTemplateBackgroundShapes(t.id, palette);

    const rendered = await renderLayeredSlide({
      scene: sceneBuffer,
      cutout: cutoutBuffer,
      layers,
      backgroundShapes,
      shadow: { enabled: true, blurSigma: 16, opacity: 0.35, offsetY: 22 },
    });

    const file = path.join(outDir, `${t.id}.png`);
    fs.writeFileSync(file, rendered.slideBuffer);
    console.log(`Rendered: ${file}`);
    results.push(rendered.slideBuffer);
  }

  // Create side-by-side comparison sheet
  const thumbs = await Promise.all(results.map((b) => sharp(b).resize(540, 675).toBuffer()));
  await sharp({
    create: { width: 540 * 2 + 30, height: 675 * 2 + 30, channels: 3, background: "#1e1e24" },
  })
    .composite([
      { input: thumbs[0], left: 10, top: 10 },
      { input: thumbs[1], left: 560, top: 10 },
      { input: thumbs[2], left: 10, top: 695 },
      { input: thumbs[3], left: 560, top: 695 },
    ])
    .png()
    .toFile(path.join(outDir, "comparison_sheet.png"));

  console.log(`\nComparison sheet created: ${path.join(outDir, "comparison_sheet.png")}`);
}

main().catch(console.error);

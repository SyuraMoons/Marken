// AI Lab: Test the 3 Official Post Categories (Product Highlight, Product Poster, Product with Name).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { generateSlideScene } from "../../src/lib/studio/scene";
import { extractProductPalette } from "../../src/lib/studio/palette";
import { renderLayeredSlide } from "../../src/lib/studio/render";
import { applyTemplateLayout, buildTemplateBackgroundShapes } from "../../src/lib/studio/templates";

async function main() {
  const cutoutPath = "scratch/lab/2026-11-03T17-22-11-746Z-bottle_hires/04_cutout.png";
  if (!fs.existsSync(cutoutPath)) {
    console.error("Missing cutout asset. Run previous lab first.");
    process.exit(1);
  }

  const cutoutBuffer = fs.readFileSync(cutoutPath);
  const palette = await extractProductPalette(cutoutBuffer);

  const outDir = path.join("scratch/lab", `three-categories-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const categories = [
    {
      category: "product-poster" as const,
      name: "category_2_product_poster",
      title: "Category 2: Product Poster (Campaign & Messaging)",
      sceneBrief: "Commercial studio product shot on an icy blue pedestal with cool geometric lighting and soft mist",
      headline: "BUILT FOR MAXIMUM CHILL",
      subline: "Double-wall pure vacuum insulation",
      cta: "TAP LINK IN BIO TO ORDER",
    },
    {
      category: "product-highlight" as const,
      name: "category_1_product_highlight",
      title: "Category 1: Product Highlight (Text-Free Aesthetic)",
      // Adopting the exact formula from the user's reference:
      sceneBrief: "Clear glass podium from the bottom up (low-angle monumental shot), wet glass surface with small drops of clear water dripping down, time frozen effect, uniform matte cool grey background, soft studio-style lighting",
      headline: "",
      subline: "",
      cta: "",
    },
    {
      category: "product-with-name" as const,
      name: "category_3_product_with_name",
      title: "Category 3: Product with Name (Minimalist Identification)",
      sceneBrief: "Minimalist architectural stone podium, neutral grey matte background, soft top-directional daylight, clean negative space",
      headline: "HYDRO FLASK — 32 OZ WIDE MOUTH",
      subline: "",
      cta: "",
    },
  ];

  const renderedSlides: Buffer[] = [];

  for (const cat of categories) {
    console.log(`\nGenerating ${cat.title}...`);
    // 1. Generate appropriate scene with Meta Model API
    const sceneResult = await generateSlideScene({
      sceneBrief: cat.sceneBrief,
      slideText: "",
      step: "render_image",
    });

    // 2. Apply template layout
    const layers = applyTemplateLayout({
      templateId: cat.category,
      sceneBrief: cat.sceneBrief,
      headline: cat.headline,
      subline: cat.subline,
      cta: cat.cta,
      palette,
    });

    const backgroundShapes = buildTemplateBackgroundShapes(cat.category, palette);

    // 3. Render deterministic layered slide
    const rendered = await renderLayeredSlide({
      scene: sceneResult.sceneBuffer,
      cutout: cutoutBuffer,
      layers,
      backgroundShapes,
      shadow: { enabled: true, blurSigma: 16, opacity: 0.35, offsetY: 22 },
    });

    const file = path.join(outDir, `${cat.name}.png`);
    fs.writeFileSync(file, rendered.slideBuffer);
    console.log(`Saved: ${file}`);
    renderedSlides.push(rendered.slideBuffer);
  }

  // 4. Create composite contact sheet for side-by-side comparison
  const H = 720;
  const W = 576; // 4:5 ratio
  const resizedThumbs = await Promise.all(
    renderedSlides.map((b) => sharp(b).resize(W, H).toBuffer())
  );

  await sharp({
    create: {
      width: W * 3 + 40,
      height: H + 30,
      channels: 3,
      background: "#18181b",
    },
  })
    .composite([
      { input: resizedThumbs[0], left: 10, top: 15 },
      { input: resizedThumbs[1], left: W + 20, top: 15 },
      { input: resizedThumbs[2], left: W * 2 + 30, top: 15 },
    ])
    .png()
    .toFile(path.join(outDir, "three_categories_sheet.png"));

  console.log(`\nContact sheet created: ${path.join(outDir, "three_categories_sheet.png")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


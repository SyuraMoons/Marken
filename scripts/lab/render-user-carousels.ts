// AI Lab: Render 3-slide carousels for Vans Shoes and Pepperoni Pizza based on user selections.
// STRICT CONSTRAINT: NEVER use em-dash (—) or hyphen (--) or underscore (__) in any slide text.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { generateSlideScene } from "../../src/lib/studio/scene";
import { extractProductPalette } from "../../src/lib/studio/palette";
import { renderLayeredSlide } from "../../src/lib/studio/render";
import { applyTemplateLayout, buildTemplateBackgroundShapes } from "../../src/lib/studio/templates";

async function main() {
  const shoesCutoutPath = "scratch/lab/inputs/shoes_cutout.png";
  const pizzaCutoutPath = "scratch/lab/inputs/pizza_cutout.png";

  const shoesCutout = fs.readFileSync(shoesCutoutPath);
  const pizzaCutout = fs.readFileSync(pizzaCutoutPath);

  const shoesPalette = await extractProductPalette(shoesCutout);
  const pizzaPalette = await extractProductPalette(pizzaCutout);

  const outDir = path.join("scratch/lab", `user-carousels-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const tasks = [
    // === VANS SHOES CAROUSEL ===
    {
      group: "shoes",
      slideNumber: 1,
      category: "product-poster" as const,
      sceneBrief: "Minimalist industrial concrete studio, wet asphalt ground with neon cyan reflections, low-angle dynamic shot, dramatic commercial rim lighting",
      headline: "BUILT FOR THE STREETS",
      subline: "CLASSIC CANVAS. UNBEATABLE GRIP.",
      cta: "SHOP NOW IN BIO",
      cutout: shoesCutout,
      palette: shoesPalette,
    },
    {
      group: "shoes",
      slideNumber: 2,
      category: "product-highlight" as const,
      sceneBrief: "Suspended above a shattered obsidian rock surface, time-frozen motion dust, soft rim light, clean uniform matte dark grey backdrop",
      headline: "",
      subline: "",
      cta: "",
      cutout: shoesCutout,
      palette: shoesPalette,
    },
    {
      group: "shoes",
      slideNumber: 3,
      category: "product-with-name" as const,
      sceneBrief: "Clean architectural warm travertine stone podium, soft diffused daylight, elegant negative space",
      headline: "VANS OLD SKOOL CLASSIC",
      subline: "",
      cta: "",
      cutout: shoesCutout,
      palette: shoesPalette,
    },

    // === PIZZA PEPPERONI CAROUSEL ===
    {
      group: "pizza",
      slideNumber: 1,
      category: "product-poster" as const,
      sceneBrief: "Artisan stone pizza oven background, glowing fire embers blurred behind, rustic dark wooden table surface with scattered flour dust",
      headline: "CRAVING REAL CRUST?",
      subline: "HOT, CRISPY AND LOADED WITH TOPPINGS",
      cta: "ORDER FRESH TODAY",
      cutout: pizzaCutout,
      palette: pizzaPalette,
    },
    {
      group: "pizza",
      slideNumber: 2,
      category: "product-highlight" as const,
      sceneBrief: "Warm sunbeam hitting a circular dark slate serving plate, fresh oregano sprigs, photorealism 8K, commercial food studio",
      headline: "",
      subline: "",
      cta: "",
      cutout: pizzaCutout,
      palette: pizzaPalette,
    },
    {
      group: "pizza",
      slideNumber: 3,
      category: "product-with-name" as const,
      sceneBrief: "Minimalist warm wooden counter, soft directional window light, clean uniform warm cream backdrop",
      headline: "ARTISAN MEAT LOVERS PIZZA",
      subline: "",
      cta: "",
      cutout: pizzaCutout,
      palette: pizzaPalette,
    },
  ];

  const renderedBuffers: Record<string, Buffer[]> = {
    shoes: [],
    pizza: [],
  };

  for (const t of tasks) {
    console.log(`\nRendering ${t.group.toUpperCase()} - Slide ${t.slideNumber} (${t.category})...`);

    // 1. Generate scene via Meta Model API
    const sceneResult = await generateSlideScene({
      sceneBrief: t.sceneBrief,
      slideText: "",
      step: "render_image",
    });

    // 2. Apply template layout (ensure no em-dash or hyphen in strings)
    const layers = applyTemplateLayout({
      templateId: t.category,
      sceneBrief: t.sceneBrief,
      headline: t.headline,
      subline: t.subline,
      cta: t.cta,
      palette: t.palette,
    });

    const backgroundShapes = buildTemplateBackgroundShapes(t.category, t.palette);

    // 3. Layered composition (cutout + contact shadow + text)
    const rendered = await renderLayeredSlide({
      scene: sceneResult.sceneBuffer,
      cutout: t.cutout,
      layers,
      backgroundShapes,
      shadow: { enabled: true, blurSigma: 16, opacity: 0.38, offsetY: 20 },
    });

    const filename = `${t.group}_slide_${t.slideNumber}.png`;
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, rendered.slideBuffer);
    console.log(`Saved: ${filepath}`);
    renderedBuffers[t.group].push(rendered.slideBuffer);
  }

  // Create composite contact sheets for both products
  const H = 675;
  const W = 540;

  for (const group of ["shoes", "pizza"]) {
    const thumbs = await Promise.all(
      renderedBuffers[group].map((b) => sharp(b).resize(W, H).toBuffer())
    );

    const sheetPath = path.join(outDir, `${group}_carousel_sheet.png`);
    await sharp({
      create: {
        width: W * 3 + 40,
        height: H + 30,
        channels: 3,
        background: "#121214",
      },
    })
      .composite([
        { input: thumbs[0], left: 10, top: 15 },
        { input: thumbs[1], left: W + 20, top: 15 },
        { input: thumbs[2], left: W * 2 + 30, top: 15 },
      ])
      .png()
      .toFile(sheetPath);

    console.log(`Created carousel sheet: ${sheetPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


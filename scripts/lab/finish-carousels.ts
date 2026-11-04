// AI Lab: Complete pizza slide 3 and generate carousel sheets
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { generateSlideScene } from "../../src/lib/studio/scene";
import { extractProductPalette } from "../../src/lib/studio/palette";
import { renderLayeredSlide } from "../../src/lib/studio/render";
import { applyTemplateLayout, buildTemplateBackgroundShapes } from "../../src/lib/studio/templates";

async function main() {
  const latestDir = "scratch/lab/user-carousels-1793788971572";
  const pizzaCutout = fs.readFileSync("scratch/lab/inputs/pizza_cutout.png");
  const pizzaPalette = await extractProductPalette(pizzaCutout);

  console.log("Retrying Pizza Slide 3...");
  const sceneBrief = "Minimalist warm wooden counter, soft directional window light, clean uniform warm cream backdrop";
  const headline = "ARTISAN MEAT LOVERS PIZZA";

  const sceneResult = await generateSlideScene({
    sceneBrief,
    slideText: "",
    step: "render_image",
  });

  const layers = applyTemplateLayout({
    templateId: "product-with-name",
    sceneBrief,
    headline,
    subline: "",
    cta: "",
    palette: pizzaPalette,
  });

  const backgroundShapes = buildTemplateBackgroundShapes("product-with-name", pizzaPalette);

  const rendered = await renderLayeredSlide({
    scene: sceneResult.sceneBuffer,
    cutout: pizzaCutout,
    layers,
    backgroundShapes,
    shadow: { enabled: true, blurSigma: 16, opacity: 0.38, offsetY: 20 },
  });

  const pizza3Path = path.join(latestDir, "pizza_slide_3.png");
  fs.writeFileSync(pizza3Path, rendered.slideBuffer);
  console.log("Saved:", pizza3Path);

  // Generate comparison sheets
  const H = 675;
  const W = 540;

  for (const group of ["shoes", "pizza"]) {
    const slide1 = fs.readFileSync(path.join(latestDir, `${group}_slide_1.png`));
    const slide2 = fs.readFileSync(path.join(latestDir, `${group}_slide_2.png`));
    const slide3 = fs.readFileSync(path.join(latestDir, `${group}_slide_3.png`));

    const thumbs = await Promise.all([
      sharp(slide1).resize(W, H).toBuffer(),
      sharp(slide2).resize(W, H).toBuffer(),
      sharp(slide3).resize(W, H).toBuffer(),
    ]);

    const sheetPath = path.join(latestDir, `${group}_carousel_sheet.png`);
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

main().catch(console.error);


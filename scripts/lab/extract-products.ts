// AI Lab: Extract product metadata and cutouts for uploaded photos, mimicking the website onboarding flow.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { extractProductsAndCutouts } from "../../src/lib/agents/extract";

async function main() {
  const photos = [
    {
      sourcePhotoId: "shoes_upload",
      photo: fs.readFileSync("scratch/lab/inputs/shoes.jpg"),
      labelHint: "pair of black skate sneakers shoes",
    },
    {
      sourcePhotoId: "pizza_upload",
      photo: fs.readFileSync("scratch/lab/inputs/pizza.jpg"),
      labelHint: "whole pizza pie",
    },
  ];

  console.log("Extracting products and cutting out backgrounds with Meta AI (SAM 3.1 & Muse Spark)...");
  const res = await extractProductsAndCutouts({
    photos,
    contentLanguage: "en",
  });

  const outDir = path.join("scratch/lab", `extracted-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\nSuccessfully extracted: ${res.items.length} products. Failures: ${res.failures.length}`);

  for (const item of res.items) {
    const name = item.product.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cutPath = path.join(outDir, `${name}_cutout.png`);
    fs.writeFileSync(cutPath, item.cutout.cutoutBuffer);

    // Save cutout preview on dark and light backgrounds
    const w = item.cutout.width;
    const h = item.cutout.height;
    const onChecker = await sharp({
      create: { width: w, height: h, channels: 3, background: "#222222" },
    })
      .composite([{ input: item.cutout.cutoutBuffer }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(outDir, `${name}_preview.png`), onChecker);

    console.log(`\n=== PRODUCT: ${name.toUpperCase()} ===`);
    console.log(`Name: ${item.product.name}`);
    console.log(`Category: ${item.product.category}`);
    console.log(`Description: ${item.product.description}`);
    console.log(`Attributes:`, item.product.attributes);
    console.log(`Cutout dimensions: ${w}x${h}`);
    console.log(`Cutout saved to: ${cutPath}`);
  }

  if (res.failures.length > 0) {
    console.log("\nFailures:", res.failures);
  }

  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(res, null, 2));
}

main().catch(console.error);

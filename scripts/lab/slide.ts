// AI Lab: cutout -> scene -> composite -> fidelity for one slide, from a local photo.
// Usage: pnpm lab:slide <photo> "<scene brief>" "<slide text>" [--role hook|product|cta]
import fs from "node:fs";
import path from "node:path";
import { cutoutProduct, renderAndVerifySlide } from "../../src/lib/studio";
import type { TemplateId } from "../../src/lib/studio/templates";

async function main() {
  const args = process.argv.slice(2);
  const getOpt = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args.splice(idx, 2)[1] : undefined;
  };
  const role = (getOpt("--role") || "hook") as "hook" | "product" | "cta";
  const template = getOpt("--template") as TemplateId | undefined;
  const bigWord = getOpt("--bigword");
  const subline = getOpt("--subline");
  const [photo, sceneBrief, slideText] = args;
  if (!photo || !sceneBrief) {
    console.error('Usage: pnpm lab:slide <photo> "<scene brief>" "<slide text>" [--role hook]');
    process.exit(1);
  }
  const out = path.join("scratch/lab", `${new Date().toISOString().replace(/[:.]/g, "-")}-slide-${path.parse(photo).name}`);
  fs.mkdirSync(out, { recursive: true });

  const cut = await cutoutProduct({ photo: fs.readFileSync(photo) });
  fs.writeFileSync(path.join(out, "cutout.png"), cut.cutoutBuffer);
  const r = await renderAndVerifySlide({
    sceneBrief,
    slideText: slideText ?? "",
    slideRole: role,
    templateId: template,
    headline: slideText,
    subline,
    bigWord,
    cutout: cut.cutoutBuffer,
  });
  fs.writeFileSync(path.join(out, "scene.png"), r.sceneBuffer);
  fs.writeFileSync(path.join(out, "slide.png"), r.slideBuffer);
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        sceneBrief,
        slideText,
        fidelityPassed: r.fidelityPassed,
        fidelityScore: r.fidelityScore,
        attempts: r.attempts,
        issues: r.fidelity.issues,
        totalCostUsd: r.totalCostUsd,
        totalLatencyMs: r.totalLatencyMs,
        telemetry: r.telemetry.map((t) => ({ step: t.step, model: t.model, latencyMs: t.latencyMs, costUsd: t.costUsd, fallback: t.fallback })),
      },
      null,
      2,
    ),
  );
  console.log(out);
  console.log(fs.readFileSync(path.join(out, "report.json"), "utf8"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

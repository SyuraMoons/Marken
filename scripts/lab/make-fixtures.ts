// AI Lab: generate realistic "owner phone snapshot" product photos as test fixtures.
// These are test inputs only; they never enter the product pipeline.
// Usage: pnpm lab:fixtures
import fs from "node:fs";
import { callModelWithTelemetry } from "../../src/lib/gateway";

type ImgOut = { imageBase64?: string | null; imageUrl?: string | null };

const FIXTURES: Record<string, string> = {
  mug: "Casual smartphone snapshot of a single glossy sage-green ceramic coffee mug standing on a cluttered wooden desk near a window, natural light, slightly imperfect framing, a small plant blurred behind, no text",
  sneaker: "Casual smartphone snapshot of a single white leather sneaker with a gum sole on a grey concrete floor, indoor lighting, slightly imperfect framing, no text",
  honey: "Casual smartphone snapshot of a single clear glass jar of golden honey with a plain wooden lid on a kitchen counter, tiles behind, warm light, no label text",
  perfume: "Casual smartphone snapshot of a single transparent glass perfume bottle with a silver cap on a bedroom shelf, soft window light, slightly imperfect framing, no text",
};

async function main() {
  fs.mkdirSync("scratch/lab/inputs", { recursive: true });
  for (const [name, prompt] of Object.entries(FIXTURES)) {
    const file = `scratch/lab/inputs/${name}.png`;
    if (fs.existsSync(file)) continue;
    const { data } = await callModelWithTelemetry<{ prompt: string; size: string; reservedBox?: unknown; slideText: string }, ImgOut>({
      step: "render_image",
      model: "muse-image",
      input: { prompt, size: "1024x1024", slideText: "" },
    });
    let buf: Buffer;
    if (data.imageBase64) buf = Buffer.from(data.imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""), "base64");
    else if (data.imageUrl) buf = Buffer.from(await (await fetch(data.imageUrl)).arrayBuffer());
    else throw new Error(`no image for ${name}`);
    fs.writeFileSync(file, buf);
    console.log("wrote", file);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

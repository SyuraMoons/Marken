// Turns SAM 3.1 output text into one product segmentation using `@meta-sam/parser`,
// the owner of the wire grammar. Reports no detection instead of inventing a box.

import {
  parseImageStream,
  recordsOfKind,
  type SegmentationMask,
} from "@meta-sam/parser";

export type SamPixelBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
};

export type ParsedSamOutput = {
  mask: SegmentationMask | null;
  /** `x2` and `y2` are inclusive, as on the wire. `w` and `h` are the frame SAM saw. */
  pixelBox: SamPixelBox | null;
  bbox: { x: number; y: number; width: number; height: number } | null;
  /** From SAM's optional `c` field. `null` means SAM did not report one. */
  confidence: number | null;
  /** Why there is no segmentation, when `mask` is `null`. */
  issue: string | null;
};

const OUTPUT_LANE = { item_id: "sam", output_index: 0, content_index: 0 };

// The grammar requires a `<Nf>` frame header and an object id. Add them when an image
// response leaves them out, so a valid box and mask are not read as plain text.
function withFrameHeader(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("<|")) return `<0f>0${trimmed}`;
  if (/^\d+<\|/.test(trimmed)) return `<0f>${trimmed}`;
  return trimmed;
}

async function* toResponseEvents(text: string) {
  yield { type: "response.output_text.done", ...OUTPUT_LANE, text };
  yield { type: "response.completed" };
}

// The parser keeps the box but drops its `w` and `h`. Every box in a frame shares them.
function readFrameSize(text: string): { w: number; h: number } | null {
  const body = text.match(/<\|box;([^|]*)\|>/)?.[1];
  if (!body) return null;
  const fields = new Map(
    body.split(";").map((field) => {
      const [key, value] = field.split("=");
      return [key.trim(), Number(value)] as const;
    }),
  );
  const w = fields.get("w");
  const h = fields.get("h");
  return w && h ? { w, h } : null;
}

export async function parseSamOutput(text: string): Promise<ParsedSamOutput> {
  const framed = withFrameHeader(text);
  const result = await parseImageStream(toResponseEvents(framed)).finalResult;

  const noDetection = (issue: string): ParsedSamOutput => ({
    mask: null,
    pixelBox: null,
    bbox: null,
    confidence: null,
    issue,
  });

  const masks = recordsOfKind(result.records, "mask");
  const size = readFrameSize(framed);
  if (masks.length === 0 || !size) {
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    return noDetection(
      errors.length > 0
        ? errors.map((d) => d.code).join(", ")
        : "SAM 3.1 found no product in the photo",
    );
  }

  // Several matches: the main product is large and near the centre of the frame. Area alone
  // picks a big background object over a smaller product held in the middle.
  const score = ({ bounds, confidence }: (typeof masks)[number]) => {
    const area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
    const dx = (bounds.left + bounds.right) / 2 / size.w - 0.5;
    const dy = (bounds.top + bounds.bottom) / 2 / size.h - 0.5;
    const centrality = 1 - Math.min(1, Math.hypot(dx, dy) / Math.SQRT1_2);
    return area * (0.5 + 0.5 * centrality) * (confidence ?? 1);
  };
  const chosen = masks.reduce((best, m) => (score(m) > score(best) ? m : best));
  const { left, top, right, bottom } = chosen.bounds;

  const box = recordsOfKind(result.records, "box").find(
    (record) => record.objectId === chosen.objectId,
  );

  return {
    mask: chosen.mask,
    pixelBox: {
      x1: left,
      y1: top,
      x2: right - 1,
      y2: bottom - 1,
      w: size.w,
      h: size.h,
    },
    bbox: {
      x: Number((left / size.w).toFixed(4)),
      y: Number((top / size.h).toFixed(4)),
      width: Number(((right - left) / size.w).toFixed(4)),
      height: Number(((bottom - top) / size.h).toFixed(4)),
    },
    confidence: chosen.confidence ?? box?.confidence ?? null,
    issue: null,
  };
}

import type { Json } from "@/lib/supabase/database.types";
import type { SlideLayers } from "@/lib/studio/layers";

// Shape of one item in posts.slides (SRD §9).
export type Slide = {
  order: number;
  text: string;
  alt: string;
  scene_path: string;
  slide_path: string;
  fidelity_score: number;
  fidelity_passed: boolean;
  /** Editable layers (SRD A-09). Slides made before A-09 have none and cannot be edited. */
  layers?: SlideLayers;
};

export const asSlides = (json: Json) => (Array.isArray(json) ? (json as unknown as Slide[]) : []);

// Real product badge only when all 3 slides passed (FR-FD-03, FD-15).
export const allSlidesPassed = (slides: Slide[]) => slides.length === 3 && slides.every((s) => s.fidelity_passed);

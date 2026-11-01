// Inngest functions served by /api/inngest. Jobs must be idempotent and isolate failures
// per shop (NFR-15).
import { trendsDaily } from "./trends";

export const functions = [trendsDaily];

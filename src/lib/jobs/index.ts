// Inngest functions served by /api/inngest. Jobs must be idempotent and isolate failures
// per shop (NFR-15).
<<<<<<< HEAD
import { generatePost, postsDaily, regeneratePost } from "./posts";
import { publishPost, refreshInstagramTokens } from "./publish";
import { trendsDaily } from "./trends";

export const functions = [
  trendsDaily,
  postsDaily,
  generatePost,
  regeneratePost,
  publishPost,
  refreshInstagramTokens,
];
=======
import { generatePost, postsDaily, postsSweep, regeneratePost } from "./posts";
import { trendsDaily } from "./trends";

export const functions = [trendsDaily, postsDaily, postsSweep, generatePost, regeneratePost];
>>>>>>> origin/development

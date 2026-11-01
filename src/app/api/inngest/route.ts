import { serve } from "inngest/next";
import { inngest } from "@/lib/jobs/client";
import { functions } from "@/lib/jobs";

// Inngest calls this route to run job steps. It is signed (INNGEST_SIGNING_KEY), and the
// proxy skips /api, so no session is involved.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });

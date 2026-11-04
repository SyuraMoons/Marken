import "server-only";

// "Your post for today is ready" email via Resend (F-13). Plain REST call: no SDK needed.
// Without RESEND_API_KEY it logs and returns false, so local dev and previews still run.
export async function sendPostReadyEmail(input: {
  to: string;
  shopName: string | null;
  postId: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("notify: RESEND_API_KEY not set, skipping email");
    return false;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Resend dedupes on this key, so a retried job never sends two emails.
      "Idempotency-Key": `post-ready/${input.postId}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "MARKEN <onboarding@resend.dev>",
      to: input.to,
      subject: "Your post for today is ready",
      html: `<p>Your post${input.shopName ? ` for ${input.shopName}` : ""} is ready to review.</p><p><a href="${base}/today?post=${encodeURIComponent(input.postId)}">Open the post and review it</a></p>`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
  return true;
}

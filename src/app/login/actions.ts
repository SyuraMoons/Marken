"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function oauth(provider: "google" | "facebook", fail: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect(`/login?error=${fail}`);
  redirect(data.url);
}

export async function signInWithGoogle() {
  await oauth("google", "generic");
}

// Meta sign-in (SRD A-03). The cookie lets /auth/callback show the Meta retry screen if the provider fails or is cancelled.
export async function signInWithMeta() {
  (await cookies()).set("marken-oauth", "meta", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/auth/callback", maxAge: 600 });
  await oauth("facebook", "meta");
}

// The address stays in a short-lived httpOnly cookie so "Resend link" works without putting it in the URL.
const EMAIL_COOKIE = "marken-login-email";

async function sendLink(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) redirect("/login?error=generic");
  (await cookies()).set(EMAIL_COOKIE, email, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/login", maxAge: 600 });
  redirect("/login?sent=1");
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/login?error=email");
  await sendLink(email);
}

export async function resendMagicLink() {
  const email = (await cookies()).get(EMAIL_COOKIE)?.value;
  if (!email) redirect("/login");
  await sendLink(email);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signOutToWelcome() {
  await (await createClient()).auth.signOut();
  redirect("/");
}

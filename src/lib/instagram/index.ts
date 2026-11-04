import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./crypto";

// Instagram API with Instagram Login (F-12, FR-PB-01..05). Tokens are encrypted at rest
// in shop_secrets and only ever handled inside server code and job steps.

const GRAPH = "https://graph.instagram.com/v26.0";
const AUTHORIZE = "https://www.instagram.com/oauth/authorize";
const SHORT_TOKEN = "https://api.instagram.com/oauth/access_token";
const SCOPES = "instagram_business_basic,instagram_business_content_publish";
const DAY_MS = 86_400_000;
const REFRESH_WITHIN_DAYS = 30;

/** Graph failure with the token stripped. `auth` means the owner must reconnect. */
export class InstagramError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly auth = false,
  ) {
    super(message);
    this.name = "InstagramError";
  }
  /** 4xx other than rate limits will fail again the same way. */
  get retriable() {
    return !this.auth && (this.status >= 500 || this.status === 429 || this.status === 0);
  }
}

function appCredentials() {
  const id = process.env.INSTAGRAM_APP_ID;
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!id || !secret) throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are not set");
  return { id, secret };
}

export function redirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return `${base.replace(/\/$/, "")}/api/auth/instagram/callback`;
}

async function call<T>(url: string, init: RequestInit & { token?: string; form?: Record<string, string> } = {}): Promise<T> {
  const { token, form, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (form) headers.set("Content-Type", "application/x-www-form-urlencoded");

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers,
      body: form ? new URLSearchParams(form) : rest.body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new InstagramError(`network: ${e instanceof Error ? e.name : "error"}`, 0);
  }

  const json = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number; error_message?: string } })
    | null;
  if (!res.ok || json?.error) {
    const err = json?.error;
    const code = err?.code;
    // 190: token invalid or expired. 102: session invalid. 10 / 200-299: permission revoked.
    const auth = res.status === 401 || code === 190 || code === 102 || code === 10 || (code !== undefined && code >= 200 && code < 300);
    throw new InstagramError(err?.message ?? err?.error_message ?? `HTTP ${res.status}`, res.status, code, auth);
  }
  return json as T;
}

// ---- OAuth ----------------------------------------------------------------------

export function authorizeUrl(state: string) {
  const u = new URL(AUTHORIZE);
  u.search = new URLSearchParams({
    client_id: appCredentials().id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    state,
  }).toString();
  return u.toString();
}

type Exchange = { access_token: string; user_id?: number | string };

async function exchangeCode(code: string): Promise<string> {
  const { id, secret } = appCredentials();
  const res = await call<Exchange & { data?: Exchange[] }>(SHORT_TOKEN, {
    method: "POST",
    form: { client_id: id, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirectUri(), code },
  });
  const token = res.data?.[0]?.access_token ?? res.access_token;
  if (!token) throw new InstagramError("no access token returned", 400);
  return token;
}

async function toLongLived(shortToken: string) {
  const u = new URL(`${GRAPH}/access_token`);
  u.search = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appCredentials().secret,
    access_token: shortToken,
  }).toString();
  return call<{ access_token: string; expires_in: number }>(u.toString());
}

async function getProfile(token: string) {
  return call<{ user_id: string; username?: string }>(`${GRAPH}/me?fields=user_id,username`, { token });
}

/** Finishes OAuth: code → long-lived token → stored encrypted. Returns the connected account id. */
export async function connectShop(shopId: string, code: string): Promise<string> {
  const long = await toLongLived(await exchangeCode(code));
  const profile = await getProfile(long.access_token);
  const igAccountId = String(profile.user_id);
  const admin = createAdminClient();

  const { error: secretError } = await admin.from("shop_secrets").upsert({
    shop_id: shopId,
    ig_token_encrypted: encryptToken(long.access_token),
    ig_token_expires_at: new Date(Date.now() + long.expires_in * 1000).toISOString(),
  });
  if (secretError) throw new Error(`store token: ${secretError.message}`);
  const { error } = await admin.from("shops").update({ ig_account_id: igAccountId }).eq("id", shopId);
  if (error) throw new Error(`store account: ${error.message}`);
  return igAccountId;
}

/** Forgets the token and account. Approve then falls back to download + copy (FR-PB-04). */
export async function disconnectShop(shopId: string) {
  const admin = createAdminClient();
  await admin.from("shop_secrets").update({ ig_token_encrypted: null, ig_token_expires_at: null }).eq("shop_id", shopId);
  await admin.from("shops").update({ ig_account_id: null }).eq("id", shopId);
}

// ---- Token lifecycle (FR-PB-05) -------------------------------------------------

async function refresh(shopId: string, token: string) {
  const u = new URL(`${GRAPH}/refresh_access_token`);
  u.search = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token }).toString();
  const res = await call<{ access_token: string; expires_in: number }>(u.toString());
  const { error } = await createAdminClient()
    .from("shop_secrets")
    .update({
      ig_token_encrypted: encryptToken(res.access_token),
      ig_token_expires_at: new Date(Date.now() + res.expires_in * 1000).toISOString(),
    })
    .eq("shop_id", shopId);
  if (error) throw new Error(`store refreshed token: ${error.message}`);
  return res.access_token;
}

/**
 * Returns a usable token, refreshing it first when less than 30 days remain.
 * Throws an `auth` InstagramError when the shop has no token or it has expired, so the
 * caller can stop retrying and the owner is sent back to download + copy.
 */
export async function getValidToken(shopId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from("shop_secrets")
    .select("ig_token_encrypted, ig_token_expires_at")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!data?.ig_token_encrypted || !data.ig_token_expires_at) {
    throw new InstagramError("instagram not connected", 401, undefined, true);
  }
  const msLeft = Date.parse(data.ig_token_expires_at) - Date.now();
  if (msLeft <= 0) throw new InstagramError("instagram token expired", 401, 190, true);

  const token = decryptToken(data.ig_token_encrypted);
  if (msLeft > REFRESH_WITHIN_DAYS * DAY_MS) return token;
  try {
    return await refresh(shopId, token);
  } catch (e) {
    // A token under 24 h old cannot be refreshed yet; it is still valid, so keep using it.
    if (e instanceof InstagramError && e.auth) throw e;
    return token;
  }
}

/** Daily cron body for one shop. Disconnects the shop when its token can no longer be saved. */
export async function refreshShopToken(shopId: string): Promise<"refreshed" | "skipped" | "disconnected"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shop_secrets")
    .select("ig_token_encrypted, ig_token_expires_at")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!data?.ig_token_encrypted || !data.ig_token_expires_at) return "skipped";
  if (Date.parse(data.ig_token_expires_at) <= Date.now()) {
    await disconnectShop(shopId);
    return "disconnected";
  }
  try {
    await refresh(shopId, decryptToken(data.ig_token_encrypted));
    return "refreshed";
  } catch (e) {
    if (e instanceof InstagramError && e.auth) {
      await disconnectShop(shopId);
      return "disconnected";
    }
    return "skipped";
  }
}

// ---- Publishing (FR-PB-01..03) --------------------------------------------------

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function createImageContainer(token: string, p: { imageUrl: string; alt: string }) {
  const form: Record<string, string> = { image_url: p.imageUrl, is_carousel_item: "true" };
  if (p.alt.trim()) form.alt_text = p.alt.trim().slice(0, 1000);
  const res = await call<{ id: string }>(`${GRAPH}/me/media`, { method: "POST", token, form });
  return res.id;
}

export async function createCarouselContainer(token: string, p: { children: string[]; caption: string }) {
  const res = await call<{ id: string }>(`${GRAPH}/me/media`, {
    method: "POST",
    token,
    form: { media_type: "CAROUSEL", children: p.children.join(","), caption: p.caption },
  });
  return res.id;
}

export async function containerStatus(token: string, containerId: string): Promise<ContainerStatus> {
  const res = await call<{ status_code: ContainerStatus }>(`${GRAPH}/${containerId}?fields=status_code`, { token });
  return res.status_code;
}

export async function publishContainer(token: string, containerId: string) {
  const res = await call<{ id: string }>(`${GRAPH}/me/media_publish`, {
    method: "POST",
    token,
    form: { creation_id: containerId },
  });
  return res.id;
}

export async function getPermalink(token: string, mediaId: string) {
  const res = await call<{ permalink?: string }>(`${GRAPH}/${mediaId}?fields=permalink`, { token });
  return res.permalink ?? null;
}

/** Finds a media published a moment ago by its caption, to recover from a lost publish response. */
export async function findRecentMedia(token: string, caption: string) {
  const res = await call<{ data?: { id: string; caption?: string }[] }>(`${GRAPH}/me/media?fields=id,caption&limit=10`, { token });
  return res.data?.find((m) => m.caption === caption)?.id ?? null;
}

/** Caption + hashtags in the same shape as the download flow, within Instagram's limits. */
export function buildCaption(caption: string, hashtags: string[]) {
  const tags = hashtags.slice(0, 30).join(" ");
  const full = tags ? `${caption}\n\n${tags}` : caption;
  if (full.length <= 2200) return full;
  return caption.slice(0, 2200);
}

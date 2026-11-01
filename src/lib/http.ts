import type { z } from "zod";

export function notImplemented(feature: string) {
  return Response.json({ error: "not_implemented", feature }, { status: 501 });
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export function apiError(code: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: code, ...extra }, { status });
}

export const notFound = () => apiError("not_found", 404);
export const conflict = (code = "conflict", extra?: Record<string, unknown>) =>
  apiError(code, 409, extra);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

/** Parses and validates a JSON body. Returns a 400 Response on any failure. */
export async function parseJson<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: apiError("invalid_json", 400) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: apiError("invalid_body", 400, {
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      }),
    };
  }
  return { data: result.data };
}

// Attributes are stored as a list of tags, or an object when every entry is "key: value".
export type Attributes = string[] | Record<string, string>;

export function attributesText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value && typeof value === "object") return Object.entries(value).map(([k, v]) => `${k}: ${String(v)}`).join(", ");
  return "";
}

export function parseAttributes(raw: string): Attributes {
  const parts = raw.split(",").map((a) => a.trim()).filter(Boolean);
  if (!parts.length || !parts.every((x) => x.includes(":"))) return parts;
  return Object.fromEntries(parts.map((x) => { const [k, ...rest] = x.split(":"); return [k.trim(), rest.join(":").trim()]; }));
}

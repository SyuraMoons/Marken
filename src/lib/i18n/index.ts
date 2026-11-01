import en from "../../../messages/en.json";

export type MessageKey = keyof typeof en;

export const hasKey = (key: string): key is MessageKey => key in en;

// UI strings are externalised (NFR-11). English only at demo.
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return en[key].replace(/\{(\w+)\}/g, (m, k: string) => String(vars?.[k] ?? m));
}

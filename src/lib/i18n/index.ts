import en from "../../../messages/en.json";

export type MessageKey = keyof typeof en;

// UI strings are externalised (NFR-11). English only at demo.
export function t(key: MessageKey): string {
  return en[key];
}

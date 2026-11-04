// Accept existing job records and older string-only captions without rendering JSON objects.
export function asCaptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const text = typeof item === "string"
      ? item
      : item !== null && typeof item === "object" && "text" in item && typeof item.text === "string"
        ? item.text
        : "";
    return text.trim() ? [text] : [];
  });
}

// ?from= remembers where the owner started (e.g. the create page) so Today, Compare and Edit can lead back there.
// Only in-app paths are honoured (never "//host" or absolute URLs), so it cannot become an open redirect.
export function backTarget(from: string | string[] | undefined): string | null {
  return typeof from === "string" && /^\/(?![/\\])/.test(from) ? from : null;
}

// "&from=..." to append to a link that already has a query string, or "" when there is no origin.
export function fromParam(from: string | null | undefined): string {
  return from ? `&from=${encodeURIComponent(from)}` : "";
}

export function notImplemented(feature: string) {
  return Response.json({ error: "not_implemented", feature }, { status: 501 });
}

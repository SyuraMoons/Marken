export function notImplemented(feature: string) {
  return Response.json({ error: "not_implemented", feature }, { status: 501 });
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

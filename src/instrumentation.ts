export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerTelemetryLogger } = await import("@/lib/gateway");
  const { writeModelCall } = await import("@/lib/supabase/model-calls");
  registerTelemetryLogger(writeModelCall);
}

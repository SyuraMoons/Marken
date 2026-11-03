import type { NextConfig } from "next";

// Signed Storage URLs (NFR-13) come from the project's Supabase host.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" }]
      : [],
  },
  /* config options here */
  // Keep the dev badge off the sidebar's product switcher (bottom-left).
  devIndicators: { position: "bottom-right" },
  // The layered slide renderer reads its bundled fonts from disk (SRD A-09), so serverless builds must ship them.
  outputFileTracingIncludes: { "/api/**/*": ["./src/lib/studio/fonts/**"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

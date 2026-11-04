import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MARKEN",
    short_name: "MARKEN",
    description: "Your AI marketing team. One ready post every day.",
    start_url: "/today",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2456db",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

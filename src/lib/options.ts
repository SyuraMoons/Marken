// Pick lists shared by onboarding, products and settings (any country, not one region).
export const CATEGORIES = ["Food & drinks", "Fashion", "Beauty", "Crafts", "Home", "Accessories", "Other"] as const;

export const COUNTRIES = [
  "Indonesia", "Malaysia", "Singapore", "Philippines", "Thailand", "Vietnam", "India", "Japan", "Australia",
  "United Kingdom", "United States", "Canada", "Germany", "France", "Netherlands", "Brazil", "Mexico",
  "Nigeria", "South Africa", "United Arab Emirates", "Other",
] as const;

export const TIME_ZONES = [
  "Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Manila",
  "Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Kolkata", "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Africa/Lagos", "Africa/Johannesburg",
  "America/Sao_Paulo", "America/Mexico_City", "America/New_York", "America/Chicago", "America/Los_Angeles", "UTC",
] as const;

export const TONES = ["Warm", "Playful", "Elegant", "Casual"] as const;
export type Tone = (typeof TONES)[number];
export const asTone = (v: string | null): Tone => (TONES.find((x) => x === v) ?? "Warm");

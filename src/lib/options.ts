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

// Step 4 question cards: "What should I never do?" presets become style rules (FR-SP-05).
export const NEVER_PRESETS = {
  prices: "Never show prices",
  slang: "Never use slang",
  emojis: "Never use emojis",
} as const;
export type NeverKey = keyof typeof NEVER_PRESETS;
export const NEVER_KEYS = Object.keys(NEVER_PRESETS) as NeverKey[];

// "What look do you want?" is saved as the brand kit photo style, which every scene brief already carries.
export const LOOK_PHRASE = {
  clean: "Clean, minimal product focus on a soft plain background.",
  lifestyle: "Lifestyle scene showing the product in real everyday use.",
  bold: "Bold promotional look with strong colour blocks and high contrast.",
} as const;
export type Look = keyof typeof LOOK_PHRASE;
export const LOOKS = Object.keys(LOOK_PHRASE) as Look[];
export const lookOf = (photoStyle: string): Look | null => LOOKS.find((k) => LOOK_PHRASE[k] === photoStyle.trim()) ?? null;

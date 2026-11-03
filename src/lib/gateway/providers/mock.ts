import sharp from "sharp";
import type { ProviderRawResponse, ProviderRequest } from "../types";

async function createMockCutoutPngBase64(): Promise<string> {
  const svg = `<svg width="480" height="480" viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
    <rect x="90" y="60" width="300" height="360" rx="36" fill="#D97706" />
    <rect x="120" y="130" width="240" height="160" rx="16" fill="#FEF3C7" />
    <text x="240" y="205" font-family="sans-serif" font-size="28" font-weight="bold" fill="#78350F" text-anchor="middle">SAMBAL ROA</text>
    <text x="240" y="245" font-family="sans-serif" font-size="18" fill="#92400E" text-anchor="middle">ARTISAN JAR 250G</text>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return buf.toString("base64");
}

async function createMockScenePngBase64(): Promise<string> {
  // 1080x1350 (4:5) scene with a clean reserved empty product area in the center
  const svg = `<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFBEB"/>
        <stop offset="100%" stop-color="#FDE68A"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)"/>
    <text x="540" y="180" font-family="sans-serif" font-size="54" font-weight="bold" fill="#451A03" text-anchor="middle">Small-Batch Smoky Heat</text>
    <text x="540" y="1220" font-family="sans-serif" font-size="36" fill="#78350F" text-anchor="middle">Tap link in bio to order fresh today</text>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return buf.toString("base64");
}

/**
 * Deterministic mock provider for offline development, CI tests, and demo smoke testing
 * when live Meta Model API / Baseten credentials are not set.
 */
export async function callMockProvider(
  req: ProviderRequest,
): Promise<ProviderRawResponse> {
  console.warn(
    `[Gateway] Step "${req.step}" running with MOCK provider. Configure META_MODEL_API_KEY in .env.local to invoke live Meta models (SAM 3.1, Muse Spark, Muse Wonder, Muse Image).`,
  );
  switch (req.step) {
    case "extract_products":
      return {
        rawOutput: {
          name: "Smoky Sambal Roa Artisan Jar",
          category: "Food & Beverage",
          price_visible_in_photo: false,
          price: null,
          currency: null,
          attributes: ["smoked fish", "spicy condiment", "glass jar", "no preservatives"],
          description:
            "Slow-cooked Manadonese smoked roa chili condiment in a sealed glass jar.",
        },
        tokensIn: 420,
        tokensOut: 190,
        images: 1,
        provider: "mock",
      };

    case "cutout": {
      const cutoutBase64 = await createMockCutoutPngBase64();
      return {
        rawOutput: {
          cutoutBase64,
          bbox: { x: 0.18, y: 0.12, width: 0.64, height: 0.76 },
          confidence: 0.99,
        },
        tokensIn: 0,
        tokensOut: 0,
        images: 1,
        provider: "mock",
      };
    }

    case "research_trends":
      return {
        rawOutput: {
          candidates: [
            {
              source: "tiktok_creative_center",
              type: "format",
              title: "3-Second Texture & Pour Close-Up Hook",
              url: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en",
              source_rank: 1,
            },
            {
              source: "google_trends",
              type: "topic",
              title: "Quick High-Flavor Home Meals & Artisanal Condiments",
              url: "https://trends.google.com/trends/",
              source_rank: 2,
            },
          ],
          pagesVisited: [
            "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en",
            "https://trends.google.com/trends/",
          ],
        },
        tokensIn: 510,
        tokensOut: 240,
        images: 0,
        provider: "mock",
      };

    case "score_trend":
      return {
        rawOutput: {
          fitScore: 88,
          momentumScore: 84,
          rationale:
            "High visual appetite appeal for physical packaged food products with strong short-form carousel save rates.",
        },
        tokensIn: 240,
        tokensOut: 95,
        images: 0,
        provider: "mock",
      };

    case "analyse_trend":
      return {
        rawOutput: {
          hook: "Stop scrolling if your warm rice feels boring tonight",
          structure: "Slide 1 bold sensory hook -> Slide 2 hero product spotlight -> Slide 3 direct order CTA",
          visual_style:
            "Warm morning kitchen table light, rustic wooden surface, clean negative space in center",
          scene_brief:
            "Warm sunlit wooden dining table with subtle chili and lime props on the outer edges and a completely empty central product zone.",
          why_it_works:
            "Contrasts an everyday meal problem with an immediate visual hero product without clutter.",
          from_video: true,
        },
        tokensIn: 480,
        tokensOut: 210,
        images: 0,
        provider: "mock",
      };

    case "plan_post":
      return {
        rawOutput: {
          product_id: "prod_default",
          trend_id: "trend_default",
          fit_reason:
            "Pairs the trending 3-second sensory food hook with your real jar photo on a warm tabletop scene.",
          slides: [
            {
              order: 1,
              role: "hook",
              text: "Warm rice deserves real smoky heat",
              alt: "Smoky Sambal Roa jar on a sunlit wooden table with headline Warm rice deserves real smoky heat",
              scene_brief:
                "Warm morning kitchen table with soft linen napkin on the edge, leaving the center 50% completely empty for the product.",
            },
            {
              order: 2,
              role: "product",
              text: "Slow-smoked roa fish & fresh chilies in every spoonful",
              alt: "Close-up of Smoky Sambal Roa jar showing authentic label and texture",
              scene_brief:
                "Clean terracotta and cream studio backdrop with soft rim lighting and an empty central pedestal area for the product.",
            },
            {
              order: 3,
              role: "cta",
              text: "Fresh batch ready — tap link in bio to order",
              alt: "Smoky Sambal Roa jar with call to action to order from link in bio",
              scene_brief:
                "Warm minimalist tabletop with subtle botanical shadow and empty center reserved for the product.",
            },
          ],
          caption_options: [
            "One spoonful changes your whole plate. Made in small batches with real smoked roa fish and fresh chilies. Tap the link in bio to grab a jar from today's batch.",
            "No shortcuts, just slow-smoked roa fish and bold heat that pairs with warm rice, noodles, or eggs. Order yours via the link in bio.",
          ],
          hashtags: [
            "#sambalroa",
            "#artisanalcondiments",
            "#smallbatchfood",
            "#homemadeflavor",
            "#spicyfoodlover",
            "#dailyfoodfeed",
          ],
        },
        tokensIn: 620,
        tokensOut: 380,
        images: 0,
        provider: "mock",
      };

    case "check_rules":
      return {
        rawOutput: {
          passed: true,
          violations: [],
          checkedTextCount: 5,
        },
        tokensIn: 310,
        tokensOut: 85,
        images: 0,
        provider: "mock",
      };

    case "render_image":
    case "regenerate_image": {
      const imageBase64 = await createMockScenePngBase64();
      return {
        rawOutput: {
          imageBase64,
          imageUrl: null,
          width: 1080,
          height: 1350,
          reservedBox: { x: 270, y: 320, width: 540, height: 680 },
        },
        tokensIn: 0,
        tokensOut: 0,
        images: 1,
        provider: "mock",
      };
    }

    case "verify_slide":
      return {
        rawOutput: {
          spellingPassed: true,
          rulesPassed: true,
          issues: [],
        },
        tokensIn: 260,
        tokensOut: 70,
        images: 1,
        provider: "mock",
      };

    case "regenerate_caption":
      return {
        rawOutput: {
          caption:
            "Freshly packed smoky roa chili condiment for your daily meals — tap the link in bio to reserve your jar today.",
          passedRules: true,
        },
        tokensIn: 290,
        tokensOut: 90,
        images: 0,
        provider: "mock",
      };

    case "weekly_learning":
      return {
        rawOutput: {
          summary:
            "Warm tabletop scenes with concise 6-word sensory hooks drove the highest approval and save rate this week.",
          recommendedHooks: ["Sensory meal contrast", "Small-batch freshness"],
        },
        tokensIn: 450,
        tokensOut: 160,
        images: 0,
        provider: "mock",
      };
  }
}


# MARKEN — AI Engine, Single Model Gateway & Pillar 1 Studio Architecture

**Workstream Owner:** Altaf (`workstream:ai-altaf`)  
**Hackathon:** Meta Global AI Developer Hackathon  
**Headline Promise:** *"Your real product, never redrawn."*

---

## High-Resolution Exportable Diagrams (LinkedIn / Deck Ready)

Ready-to-share PNG and SVG visuals are stored in `docs/images/`:
- **End-to-End AI Pipeline:** [`docs/images/ai-pipeline-flow.png`](./images/ai-pipeline-flow.png) · [`docs/images/ai-pipeline-flow.svg`](./images/ai-pipeline-flow.svg)
- **Single Model Gateway (`FR-CL-01`):** [`docs/images/ai-gateway-flow.png`](./images/ai-gateway-flow.png) · [`docs/images/ai-gateway-flow.svg`](./images/ai-gateway-flow.svg)

![MARKEN End-to-End AI Pipeline](./images/ai-pipeline-flow.png)

![MARKEN Single Model Gateway](./images/ai-gateway-flow.png)

---

## 1. Why MARKEN Uses a Hybrid AI + Deterministic Pixel Pipeline

Standard text-to-image models redraw physical products, warping logos, packaging labels, and textures. MARKEN's AI architecture separates **creative world-building** (handled by Meta generative models) from **product pixel preservation** (handled by `SAM 3.1` + deterministic `sharp` compositing):

| Stage | Module | Meta Model / Engine | Role in Pipeline |
| :--- | :--- | :--- | :--- |
| **0. Model Gateway** | `src/lib/gateway/` | `Muse Spark`, `Muse Wonder`, `Muse Spark Open`, `Muse Image`, `SAM 3.1` | Single entry point (`callModel`). Enforces Zod JSON validation (1x retry), falls back to `Muse Spark Open` on text errors, and logs latency & USD cost (`< $0.10` per carousel). |
| **1. Onboarding Cutout & Catalog** | `src/lib/studio/cutout.ts`<br>`src/lib/agents/extract.ts` | `SAM 3.1` + `Muse Spark` | Segments each uploaded product photo into a confirmed transparent PNG cutout (`SAM 3.1`) and extracts structured catalog metadata (`price = null` when not visible). |
| **2. Daily Trend Engine** | `src/lib/agents/trends.ts` | `Muse Wonder` + `Muse Spark Open` + `Muse Spark` | Browses TikTok Creative Center & Google Trends (`Muse Wonder`), scores candidates 0–100 (`Muse Spark Open`), and caches multimodal scene briefs for 7 days (`Muse Spark`). |
| **3. Carousel Planner & Guardrails** | `src/lib/agents/planner.ts`<br>`src/lib/agents/rules.ts` | `Muse Spark` | Plans a 3-slide carousel (`hook`, `product`, `cta`), 2 captions, and 5–15 hashtags in the shop's language, then verifies compliance against up to 10 shop style rules. |
| **4. Pillar 1 Studio & Fidelity** | `src/lib/studio/composite.ts`<br>`src/lib/studio/fidelity.ts` | `Muse Image` + `sharp` + `Muse Spark` | Generates a 1080×1350 (4:5) scene with a **reserved empty product zone** (`Muse Image`), deterministically composites the real `SAM 3.1` cutout (`sharp`), and verifies pixel fidelity + slide spelling (`Code + Muse Spark`). |

---

## 2. Mermaid Diagrams (Interactive GitHub View)

### 2A. End-to-End AI Pipeline Flow

```mermaid
flowchart TD
    subgraph OB["1. Onboarding Upload (Issue #3)"]
        P["Owner Uploads 3-10 Product Photos"] --> EX["extractProductsAndCutouts()"]
        EX -->|Vision JSON| MS1["Muse Spark: Extract Name, Attributes, Price (null if unseen)"]
        EX -->|Segmentation| SAM["SAM 3.1: Cutout Product -> Transparent PNG"]
        SAM --> CONF["Owner Confirms Cutout in Step 3"]
    end

    subgraph TR["2. Daily Trend Engine (Issue #4)"]
        CRON1["Inngest: trends.daily"] --> MW["Muse Wonder: Browse TikTok & Google Trends"]
        MW --> MSO["Muse Spark Open: Score Candidates 0-100"]
        MSO -->|Score >= Threshold| MSA["Muse Spark: Multimodal Analysis & Scene Brief"]
        MSA --> CACHE[("7-Day Shared Cache (trend_analyses)")]
    end

    subgraph CG["3. Daily Carousel Planner & Rules (Issue #5)"]
        CRON2["Inngest: posts.daily"] --> PLAN["planDailyCarousel()"]
        CONF --> PLAN
        CACHE --> PLAN
        PLAN -->|3-Slide Plan + 2 Captions + Hashtags| MSR["Muse Spark: Style Rule & Truth Guardrail Check"]
        MSR -->|Fail Once| PLAN
    end

    subgraph ST["4. Pillar 1: Product Studio & Fidelity (Issue #6)"]
        MSR -->|Pass| MI["Muse Image: 1080x1350 Scene + Text (Reserved Empty Product Box)"]
        MI --> COMP["sharp Code: Deterministic Composite (Scale + Shadow of Cutout)"]
        CONF --> COMP
        COMP --> FID["verifySlideFidelity(): Pixel Diff vs Cutout + Muse Spark Spelling Check"]
        FID -->|Fail Once| MI
        FID -->|Pass| READY["Post Ready on /today ('Real Product' Badge + Activity Telemetry)"]
    end

    subgraph GW["Single Model Gateway (Issue #2 - Wraps Every AI Step)"]
        CALL["callModel({ step, model, input, schema })"]
    end
```

### 2B. Single Model Gateway Sequence (`src/lib/gateway/index.ts`)

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Agent / Studio Step
    participant GW as callModel() Gateway
    participant Meta as Meta Model API (Spark / Wonder / Image / SAM 3.1)
    participant Open as Muse Spark Open (Baseten / Modal)
    participant DB as Telemetry Logger (model_calls)

    Agent->>GW: callModel({ step, model, shopId, postId, input, schema })
    GW->>Meta: Dispatch primary model request
    alt Primary API succeeds
        Meta-->>GW: Raw output + token/image usage
    else Primary API fails on Text step (NFR-18)
        Meta--xGW: Error / Timeout
        GW->>Open: Automatic Fallback to Muse Spark Open (fallback = true)
        Open-->>GW: Raw output + token usage
    end
    GW->>GW: Validate JSON output with Zod schema (NFR-16)
    alt Schema validation fails (Attempt 1)
        GW->>Meta: Retry once with validation error feedback
        Meta-->>GW: Corrected JSON output
    end
    GW->>GW: Calculate latencyMs & costUsd (< $0.10 / carousel target)
    GW->>DB: Emit ModelCallTelemetry row
    GW-->>Agent: Return { data, telemetry }
```

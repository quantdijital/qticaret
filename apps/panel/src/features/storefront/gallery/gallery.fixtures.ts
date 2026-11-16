import type { DesignCard, DesignGallery, DesignSummary, PresetCard } from "./api"

/** A look's summary as the server draws its card (backend `lib/storefront/designs/summary.ts`). */
export function summary(overrides: Partial<DesignSummary> = {}): DesignSummary {
  return {
    source: "preset",
    source_name: "Grafit",
    preset: { pack: "general", code: "grafit", version: 1 },
    colors: { primary: "#1f2933", accent: "#c2410c", background: "#ffffff" },
    fonts: { heading: "Inter", body: "Inter" },
    sections: { header: 2, home: 6, footer: 1, product: 3, category: 2 },
    home_types: ["hero", "product-grid", "rich-text"],
    edited: false,
    reason: null,
    ...overrides,
  }
}

export function preset(code: string, overrides: Partial<PresetCard> = {}): PresetCard {
  return {
    pack: "general",
    code,
    version: 1,
    theme: "atolye",
    name: code === "grafit" ? "Grafit" : code,
    description: `${code} görünümü`,
    tone: "light",
    family: code,
    swatch: null,
    summary: summary({ preset: { pack: "general", code, version: 1 } }),
    has_menus: false,
    has_demo: false,
    has_preview: false,
    has_header: true,
    has_footer: true,
    preview_url: null,
    in_draft: null,
    live: null,
    ...overrides,
  }
}

export function design(id: string, overrides: Partial<DesignCard> = {}): DesignCard {
  return {
    id,
    kind: "saved",
    name: "Bayram vitrini",
    summary: summary({ reason: "manual" }),
    created_at: "2026-11-17T11:20:00.000Z",
    updated_at: "2026-11-17T11:20:00.000Z",
    created_by: "user_1",
    applied_at: null,
    in_draft: false,
    live: false,
    edited: false,
    ...overrides,
  }
}

export function gallery(designs: DesignCard[], overrides: Partial<DesignGallery> = {}) {
  return {
    designs,
    limits: { saved: 10, auto: 5 },
    current: {
      draft: {
        preset: { pack: "general", code: "grafit", version: 1 },
        design_id: null,
        edited: false,
        has_changes: false,
      },
      live: {
        preset: { pack: "general", code: "grafit", version: 1 },
        design_id: null,
        revision: 1,
        published_at: "2026-11-01T09:00:00.000Z",
      },
    },
    ...overrides,
  } satisfies DesignGallery
}

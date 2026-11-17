import type { StorefrontPreset } from "@qticaret/sector-packs"
import { allPresets } from "./presets"

/**
 * Designs the preset lock draws beside the presets though no pack ships
 * them (test fixtures, not presets): a drawing no preset reaches yet is
 * locked too. Each is a preset with its layout changed, its snapshot in
 * `preset-lock/<key>/frame.html`.
 */

const ALWAYS = { visible: true, starts_at: null, ends_at: null }

/**
 * The footer group with a rich text, trust badges and a scrolling strip
 * above the footer bar (adr/0070 §4), beside the newsletter box the
 * ledger footer draws inside itself.
 */
function footerGroup(base: StorefrontPreset): StorefrontPreset {
  const footer = [
    { id: "altkayanyazi", type: "marquee", ...ALWAYS, items: [{ text: "Aynı gün kargo" }] },
    ...(base.layout.footer ?? []),
    {
      id: "altzenginmetin",
      type: "rich_text",
      ...ALWAYS,
      title: "Neden biz",
      html: "<p>Her ürün elden geçer, özenle paketlenir.</p>",
    },
    { id: "altguvence", type: "trust_badges", ...ALWAYS, variant: "lined" },
  ]
  return { ...base, layout: { ...base.layout, footer } }
}

/** Every fixture by its key (`fixture-<name>`), on the first preset found (packs and codes sorted). */
export function lockFixtures(): { key: string; preset: StorefrontPreset }[] {
  const base = allPresets()[0]?.preset
  return base ? [{ key: "fixture-footer-group", preset: footerGroup(base) }] : []
}

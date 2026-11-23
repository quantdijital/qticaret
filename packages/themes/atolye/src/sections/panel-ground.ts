import { drawnVariant } from "@qticaret/ui"
import type { SectionLookView } from "@qticaret/ui"
import { BANNER_VARIANTS } from "./CampaignSplit"
import { GUIDE_VARIANTS } from "./GuidesPanel"
import type { Block } from "./plan"

export type PanelGround = NonNullable<SectionLookView["ground"]>

/**
 * The variants that draw their section's ground on a panel of their own
 * (adr/0077 Ek): the posts' intro panel (a light tint unless the shop set
 * one) and the split band (the dark stage unless it set one). The ground
 * is still the section's look (one concept, one setting); only where it
 * is painted differs. Null for every other block: its box takes the ground.
 */
export function panelGround(block: Block): PanelGround | null {
  if (block.kind !== "one") {
    return null
  }
  const { section } = block
  if (
    section.type === "posts" &&
    drawnVariant("posts", section.variant, GUIDE_VARIANTS) === "intro_panel"
  ) {
    return section.look?.ground ?? "well"
  }
  if (
    section.type === "banner" &&
    drawnVariant("banner", section.variant, BANNER_VARIANTS) === "split"
  ) {
    return section.look?.ground ?? "stage"
  }
  return null
}

/** The box's look: without the ground when the block paints it on its own panel. */
export function boxLook(block: Block, look: SectionLookView | undefined) {
  if (look?.ground === undefined || panelGround(block) === null) {
    return look
  }
  return Object.fromEntries(
    Object.entries(look).filter(([field]) => field !== "ground")
  ) as SectionLookView
}

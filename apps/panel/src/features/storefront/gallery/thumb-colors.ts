import { isHexColor } from "@/features/settings/storefront"
import { ATOLYE_COLORS } from "@/theme/atolye"
import { STOREFRONT_BACKGROUNDS, STOREFRONT_WELLS } from "@/theme/storefront"
import type { StorefrontBackground } from "@/theme/storefront"
import type { DesignSummary } from "./api"

export interface ThumbColors {
  page: string
  well: string
  primary: string
  accent: string
  ink: string
  stage: string
}

/**
 * The colours the storefront paints for a look's choices (`DesignThumb`,
 * the colour set's dots): its page colour and well, its main colour and
 * accent, else the Atölye theme's own (`@/theme/atolye`).
 */
export function thumbColors(colors: DesignSummary["colors"]): ThumbColors {
  const background = colors.background ?? "steel"
  const known = background in STOREFRONT_BACKGROUNDS
  const key = (known ? background : "steel") as StorefrontBackground
  return {
    page: STOREFRONT_BACKGROUNDS[key],
    well: STOREFRONT_WELLS[key],
    primary: colors.primary && isHexColor(colors.primary) ? colors.primary : ATOLYE_COLORS.wine,
    accent: colors.accent && isHexColor(colors.accent) ? colors.accent : ATOLYE_COLORS.text,
    ink: ATOLYE_COLORS.text,
    stage: ATOLYE_COLORS.stage,
  }
}

import type { FooterColumnsSetting, FooterColumnsStep, StoreFooterColumns } from "@qticaret/types"
import {
  FOOTER_COLUMNS_DEFAULTS,
  FOOTER_COLUMNS_LIMITS,
  FOOTER_COLUMNS_SETTINGS,
} from "@qticaret/types/section-footer"
import type { FooterColumnsView } from "@qticaret/ui"

const step = <S extends FooterColumnsSetting>(setting: S, value: unknown): FooterColumnsStep<S> => {
  const listed: readonly unknown[] = FOOTER_COLUMNS_SETTINGS[setting]
  return listed.includes(value) ? (value as FooterColumnsStep<S>) : FOOTER_COLUMNS_DEFAULTS[setting]
}

/**
 * The brand columns footer's own settings (adr/0049 Ek 2026-11-17), read
 * forgivingly: a step this build does not know is the default, a missing
 * object (a backend before them) all the defaults, a line about the shop
 * only while it is words of the contract's length.
 */
export function footerColumnsOf(
  columns: Partial<StoreFooterColumns> | null | undefined
): FooterColumnsView {
  const about = typeof columns?.about === "string" ? columns.about.trim() : ""
  return {
    topStrip: columns?.top_strip !== false,
    about: about.length > 0 ? about.slice(0, FOOTER_COLUMNS_LIMITS.about) : null,
    ground: step("ground", columns?.ground),
    badgeStyle: step("badge_style", columns?.badge_style),
    ...(step("news_place", columns?.news_place) === "column" ? { newsPlace: "column" } : {}),
    ...(step("brand_contact", columns?.brand_contact) === "hide" ? { brandContact: "hide" } : {}),
    ...(step("bottom_align", columns?.bottom_align) === "center" ? { bottomAlign: "center" } : {}),
    ...(step("wordmark", columns?.wordmark) === "on" ? { wordmark: "on" } : {}),
  }
}

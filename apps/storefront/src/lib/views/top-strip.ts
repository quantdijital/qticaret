import type { StoreAnnouncementBar } from "@qticaret/types"
import type { TopStripView } from "@qticaret/ui"

/**
 * The top strip's design and parts as the theme draws them (owner's
 * decision 2026-11-27): a design this build does not know, or none (a
 * backend before it), the dark bar; a part not switched off, shown;
 * "Hesabım" only once switched on.
 */
export const topStripOf = (bar: StoreAnnouncementBar): TopStripView => ({
  variant: bar.variant === "light" ? "light" : "graphite",
  links: bar.links !== false,
  phone: bar.phone !== false,
  account: bar.account === true,
})

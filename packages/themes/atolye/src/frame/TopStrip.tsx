import type { ReactNode } from "react"
import type { ShopView, Translate } from "@qticaret/ui"
import { Announcement } from "./Announcement"
import { HeaderCatalogStrip } from "./HeaderCatalogStrip"
import { accountOf } from "./header-words"

/**
 * The shop's top strip (owner's decision 2026-11-27, adr/0066 Ek): its own
 * section, never the header's. `graphite`, the dark bar above the header:
 * the lines, their button and from 1024 px the top links and the phone,
 * each as the shop left it on. `light`, the thin light strip at the top of
 * the header (it folds with it, `data-gf-strip`): the first line as a note,
 * a link when the shop gave one, the top links and "Hesabım" when asked;
 * nothing to show, not drawn. No strip section: nothing above the header,
 * whatever the header's variant.
 */
export function topStripOf(
  shop: ShopView,
  t: Translate
): { above: ReactNode; inHeader: ReactNode } {
  const strip = shop.topStrip
  if (!strip) {
    return { above: null, inHeader: null }
  }
  if (strip.variant === "light") {
    const [line] = shop.announcements.filter((each) => each.length > 0)
    const note = line ? { text: line, path: shop.announcementLink?.path ?? null } : null
    const links = strip.links ? shop.topLinks : []
    const account = strip.account ? accountOf(shop, t) : null
    const shown = note !== null || links.length > 0 || account !== null
    return {
      above: null,
      inHeader: shown ? (
        <HeaderCatalogStrip
          note={note}
          links={links}
          account={account}
          mark={shop.announcementMark}
          words={{ links: t("nav.top_links") }}
        />
      ) : null,
    }
  }
  const count = shop.announcements.filter((each) => each.length > 0).length
  return {
    above: (
      <Announcement
        lines={shop.announcements}
        settings={shop.announcementSettings}
        button={shop.announcementLink}
        lineLinks={shop.announcementLineLinks}
        mark={shop.announcementMark}
        links={strip.links ? shop.topLinks : []}
        contact={strip.phone ? shop.contact : { ...shop.contact, phone: null, phoneHref: null }}
        words={{
          announcements: t("nav.announcements"),
          links: t("nav.top_links"),
          pause: t("nav.announcements_pause"),
          play: t("nav.announcements_play"),
          // The slider's arrows and each line's place, read only where drawn
          previous: t("nav.announcements_previous"),
          next: t("nav.announcements_next"),
          slides: Array.from({ length: count }, (_, index) =>
            t("nav.announcements_slide", { n: index + 1, total: count })
          ),
        }}
      />
    ),
    inHeader: null,
  }
}

import type { LinkView, Translate } from "@qticaret/ui"

/**
 * The carriers' own public tracking pages (adr/0046 Ek 2026-11-05), where
 * a shopper holding a tracking number asks without an order link. Only
 * the carriers whose account the shop connected (`/store/storefront`
 * `marks.carriers`); an unknown key has no page and is left out. The
 * addresses are the carriers' own, as the backend links a parcel's.
 */
const PAGES: Record<string, string> = {
  aras: "https://kargotakip.araskargo.com.tr/",
  yurtici: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula",
  // Formerly MNG Kargo; the page takes the 12-digit shipment number
  dhlecommerce: "https://www.dhlecommerce.com.tr/gonderitakip",
  // Sürat's public tracking page (the owner's plugin; to confirm)
  surat: "https://suratkargo.com.tr/KargoTakip/",
}

export function carrierPages(keys: readonly string[] | undefined, t: Translate): LinkView[] {
  return (keys ?? []).flatMap((key) => {
    const path = PAGES[key]
    return path ? [{ label: t(`marks.${key}`), path }] : []
  })
}

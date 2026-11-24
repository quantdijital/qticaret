import type { MedusaContainer } from "@medusajs/framework/types"
import { byPriority, popupState, promotionState } from "../../lib/popups/eligibility"
import type { PopupRecord } from "../../lib/popups/eligibility"
import { storePopupOf } from "../../lib/popups/store"
import type { StorePopup, StorePopupImage } from "../../lib/popups/store"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { POPUPS_MODULE } from "../../modules/popups"
import type PopupsModuleService from "../../modules/popups/service"
import { promotionsById } from "./promotions"

type Container = Pick<MedusaContainer, "resolve">

/** More than a shop runs at once; the storefront shows one per page view anyway. */
export const STORE_POPUPS_MAX = 20

/** The pictures' sizes and versions, by address, from the media library. */
async function imagesByUrl(
  container: Container,
  rows: readonly PopupRecord[]
): Promise<Map<string, Omit<StorePopupImage, "alt">>> {
  const urls = [...new Set(rows.flatMap((row) => (row.image_url ? [row.image_url] : [])))]
  if (urls.length === 0) {
    return new Map()
  }
  const assets = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url: urls }, { select: ["url", "width", "height", "derivatives"] })
  return new Map(
    assets.map((asset) => [
      asset.url,
      {
        url: asset.url,
        width: asset.width ?? null,
        height: asset.height ?? null,
        derivatives: asset.derivatives ?? null,
      },
    ])
  )
}

/**
 * The pop-ups live now (adr/0080 §5), highest priority first: switched
 * on, within their dates and, for a campaign, with a promotion that takes
 * orders now. A picture the library no longer has is dropped, not the
 * pop-up.
 */
export async function storePopups(
  container: Container,
  now: Date = new Date()
): Promise<StorePopup[]> {
  const rows = (await container
    .resolve<PopupsModuleService>(POPUPS_MODULE)
    .listPopups({ is_active: true }, { take: null })) as unknown as PopupRecord[]
  const dated = rows.filter((row) => popupState(row, "live", now) === "live")
  const promotions = await promotionsById(
    container,
    dated.flatMap((row) => (row.type === "campaign" && row.promotion_id ? [row.promotion_id] : []))
  )
  const live = dated.filter(
    (row) =>
      row.type !== "campaign" ||
      promotionState(promotions.get(row.promotion_id ?? "") ?? null, now) === "live"
  )
  const ordered = byPriority(live).slice(0, STORE_POPUPS_MAX)
  const images = await imagesByUrl(container, ordered)
  return ordered.map((row) => {
    const image = row.image_url ? images.get(row.image_url) : undefined
    return storePopupOf(row, {
      image: image ? { ...image, alt: row.image_alt } : null,
      promotion: row.promotion_id ? (promotions.get(row.promotion_id) ?? null) : null,
    })
  })
}

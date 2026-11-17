import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_VIDEOS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { fieldTokens } from "../validation/attribute-fields"

interface ProductRow {
  media_videos?: unknown
  [field: string]: unknown
}

const isRow = (value: unknown): value is ProductRow =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isReady = (video: unknown): boolean => isRow(video) && video["status"] === "ready"

/**
 * A product's videos as a shopper may see them (adr/0069 §6, §12): with
 * `catalog.product_videos` off none at all (the records and files stay,
 * back once it is on); on, only the ready ones (a clip still in the queue
 * or failed has nothing to play). Asked without `status`, none is known to
 * be ready, so none is shown.
 */
export function shopperVideos(product: unknown, on: boolean): void {
  if (!isRow(product) || !("media_videos" in product)) {
    return
  }
  if (!on) {
    delete product.media_videos
    return
  }
  const videos = product.media_videos
  product.media_videos = Array.isArray(videos) ? videos.filter(isReady) : []
}

/** The products an answer carries: one product's page, or a list. */
function productsOf(body: unknown): unknown[] {
  if (!isRow(body)) {
    return []
  }
  const listed = Array.isArray(body["products"]) ? (body["products"] as unknown[]) : []
  return [body["product"], ...listed]
}

const asksForVideos = (req: MedusaRequest) =>
  fieldTokens(req).some((token) => token.startsWith("media_videos."))

/**
 * On the Store product routes: an answer that asked for the videos'
 * leaves (the guard on `/store/*` has refused every other spelling) loses
 * them while the flag is off, and the ones not ready otherwise. The flag
 * is read before the route runs, so the answer itself is cut down at once.
 */
export async function storeProductVideos(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  // A HEAD runs the GET route and sizes its answer: cut down alike (review S1)
  if (!["GET", "HEAD"].includes(req.method) || !asksForVideos(req)) {
    next()
    return
  }
  let on: boolean
  try {
    on = await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(PRODUCT_VIDEOS)
  } catch (error) {
    next(error)
    return
  }
  const send = res.json.bind(res)
  res.json = (body: unknown) => {
    for (const product of productsOf(body)) {
      shopperVideos(product, on)
    }
    return send(body)
  }
  next()
}

import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { MEDIA_MODULE } from "../../modules/media"
import { attachMediaStep } from "./steps/attach-media"
import { deriveMediaStep, removeMediaFilesStep } from "./steps/derive-media"
import { planProductMediaStep } from "./steps/plan-product-media"
import { registerMediaStep } from "./steps/register-media"
import { removeAbandonedMediaStep } from "./steps/remove-abandoned-media"
import type { RegisterMediaInput } from "./steps/register-media"
import { saveMediaStep } from "./steps/save-media"
import type { SaveMediaInput } from "./steps/save-media"
import { setMediaAltsStep } from "./steps/set-media-alts"
import type { MediaAlt } from "./steps/set-media-alts"

/** Emitted after an image's alt text is saved: `{ id }` of its product, for its assessment. */
export const MEDIA_SAVED = "media.saved"

/** Images just uploaded become media assets (F3.3), in the library when asked. */
export const registerMediaWorkflow = createWorkflow(
  "media-register",
  (input: RegisterMediaInput) => {
    const assets = registerMediaStep(input)
    return new WorkflowResponse(assets)
  }
)

/**
 * Brings a product's images in line (F3.3, adr/0016): records of its images
 * linked to it (one made for an image added by URL), records of images it
 * dropped unlinked, and versions made again where its slug or an image's
 * place changed, the old ones removed.
 * One run per product at a time; a later save waits for it.
 */
export const deriveProductMediaWorkflow = createWorkflow(
  "media-derive-product",
  (input: { product_id: string }) => {
    const key = transform({ input }, ({ input }) => `media:${input.product_id}`)
    acquireLockStep({ key, timeout: 120, ttl: 600 })
    const plan = planProductMediaStep(transform({ input }, ({ input }) => input.product_id))
    const attached = attachMediaStep(
      transform({ plan }, ({ plan }) => ({ link: plan.link, record: plan.record }))
    )
    const links = transform({ plan, attached }, ({ plan, attached }) => ({
      add: attached.map((id) => ({
        [Modules.PRODUCT]: { product_id: plan.productId },
        [MEDIA_MODULE]: { media_asset_id: id },
      })),
      remove: plan.unlink.map((id) => ({
        [Modules.PRODUCT]: { product_id: plan.productId },
        [MEDIA_MODULE]: { media_asset_id: id },
      })),
    }))
    when({ links }, ({ links }) => links.add.length > 0).then(() => {
      createRemoteLinkStep(transform({ links }, ({ links }) => links.add))
    })
    when({ links }, ({ links }) => links.remove.length > 0).then(() => {
      dismissRemoteLinkStep(transform({ links }, ({ links }) => links.remove))
    })
    const derived = deriveMediaStep(transform({ plan }, ({ plan }) => plan.derive))
    releaseLockStep({ key })
    removeMediaFilesStep(transform({ derived }, ({ derived }) => derived.obsolete))
    return new WorkflowResponse(plan)
  }
)

/** An image's alt text and library name; a product image's alt text is assessed again. */
export const saveMediaWorkflow = createWorkflow("media-set-alt", (input: SaveMediaInput) => {
  const saved = saveMediaStep(input)
  when({ saved }, ({ saved }) => saved.product_id !== null && saved.alt_changed).then(() => {
    emitEventStep({
      eventName: MEDIA_SAVED,
      data: transform({ saved }, ({ saved }) => ({ id: saved.product_id })),
    })
  })
  return new WorkflowResponse(saved)
})

/** A product's images' alt texts at once (bulk edit, F3.10); its assessment once. */
export const setProductAltsWorkflow = createWorkflow(
  "media-set-product-alts",
  (input: { product_id: string; alts: MediaAlt[] }) => {
    const saved = setMediaAltsStep(transform({ input }, ({ input }) => ({ alts: input.alts })))
    emitEventStep({
      eventName: MEDIA_SAVED,
      data: transform({ input }, ({ input }) => ({ id: input.product_id })),
    })
    return new WorkflowResponse(saved)
  }
)

/** The nightly removal of uploads no product took; one run at a time across servers. */
export const removeAbandonedMediaWorkflow = createWorkflow(
  "media-sweep-abandoned",
  (input: { ids: string[] }) => {
    acquireLockStep({ key: "media:sweep", timeout: 5, ttl: 900 })
    const removed = removeAbandonedMediaStep(transform({ input }, ({ input }) => input.ids))
    releaseLockStep({ key: "media:sweep" })
    return new WorkflowResponse(removed)
  }
)

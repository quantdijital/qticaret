import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { STOCK_PREORDER } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/** What a write asks to sell past stock: new variants, and existing ones by id. */
export interface BackorderClaims {
  created: boolean
  updated: string[]
}

type Params = Record<string, string | undefined>

const NONE: BackorderClaims = { created: false, updated: [] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const merge = (claims: BackorderClaims[]): BackorderClaims => ({
  created: claims.some((claim) => claim.created),
  updated: claims.flatMap((claim) => claim.updated),
})

/** Any of the variants made sells past stock. */
const anyBackorder = (value: unknown): boolean =>
  records(value).some((variant) => variant["allow_backorder"] === true)

/** Variants a product update or batch sends: one with an id is changed, one without made. */
function ofVariants(value: unknown): BackorderClaims {
  const claimed = records(value).filter((variant) => variant["allow_backorder"] === true)
  return {
    created: claimed.some((variant) => typeof variant["id"] !== "string"),
    updated: claimed.flatMap((variant) =>
      typeof variant["id"] === "string" ? [variant["id"]] : []
    ),
  }
}

const asBody = (body: unknown): Record<string, unknown> => (isRecord(body) ? body : {})

// Express matches `:id` to "batch" too (without regard to case); the batch routes have their own rule
const isBatch = (segment: string | undefined) => segment?.toLowerCase() === "batch"

/**
 * Medusa's routes that set `allow_backorder` (2.21.2), each read for what
 * it asks. The batch routes are listed on their own: Medusa answers them
 * before a `:id` middleware runs. The CSV import is left to F3.9, whose own
 * import replaces it.
 */
export const BACKORDER_CLAIMS: Readonly<
  Record<string, (body: unknown, params: Params) => BackorderClaims>
> = {
  "/admin/products": (body) => ({ created: anyBackorder(asBody(body)["variants"]), updated: [] }),
  "/admin/products/batch": (body) => {
    const batch = asBody(body)
    return merge([
      {
        created: records(batch["create"]).some((each) => anyBackorder(each["variants"])),
        updated: [],
      },
      ...records(batch["update"]).map((each) => ofVariants(each["variants"])),
    ])
  },
  "/admin/products/:id": (body, params) =>
    isBatch(params["id"]) ? NONE : ofVariants(asBody(body)["variants"]),
  "/admin/products/:id/variants": (body) => ({
    created: asBody(body)["allow_backorder"] === true,
    updated: [],
  }),
  // A batch's updates all carry their id; its creates never do
  "/admin/products/:id/variants/batch": (body) => {
    const batch = asBody(body)
    return merge([
      { created: anyBackorder(batch["create"]), updated: [] },
      ofVariants(records(batch["update"]).filter((each) => typeof each["id"] === "string")),
    ])
  },
  "/admin/products/:id/variants/:variant_id": (body, params) => {
    const id = params["variant_id"]
    return asBody(body)["allow_backorder"] === true && id && !isBatch(id)
      ? { created: false, updated: [id] }
      : NONE
  },
}

/**
 * Whether these variants start selling past stock: one that does not sell
 * past stock yet, or an id that names no variant (Medusa would make it).
 */
async function turnsOn(req: MedusaRequest, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)]
  const variants = await req.scope
    .resolve(Modules.PRODUCT)
    .listProductVariants({ id: unique }, { select: ["id", "allow_backorder"], take: unique.length })
  return variants.length < unique.length || variants.some((variant) => !variant.allow_backorder)
}

/**
 * Selling past stock needs the `stock.preorder` flag (F3.8, adr/0020): a
 * write that makes a variant do so is refused while it is off. A variant
 * already selling past stock may stay so, as a digital product may stay
 * digital, so turning the flag off never fails an unrelated save.
 */
export function backorderGate(claimsOf: (body: unknown, params: Params) => BackorderClaims) {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const claims = claimsOf(req.body, req.params)
      if (!claims.created && claims.updated.length === 0) {
        next()
        return
      }
      const settings = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      if (await settings.isFeatureEnabled(STOCK_PREORDER)) {
        next()
        return
      }
      if (claims.created || (await turnsOn(req, claims.updated))) {
        throw new ValidationError("stock.preorder_disabled", { field: "allow_backorder" })
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

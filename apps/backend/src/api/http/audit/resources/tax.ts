import { Modules } from "@medusajs/framework/utils"
import type { ITaxModuleService, MedusaContainer } from "@medusajs/framework/types"
import { findVatRegion } from "../../../../workflows/tax/region"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * The KDV rates (adr/0007 Ek 2026-11-04, adr/0011): a rate's name, code,
 * percentage, whether it is in use and the default; a default moved, which
 * rate was the default before and after. A new rate has no before.
 */

const taxOf = (scope: Resolver) => scope.resolve(Modules.TAX) as ITaxModuleService

async function rateSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const [rate] = await taxOf(scope).listTaxRates({ id }, { withDeleted: true, take: 1 })
  return rate
    ? {
        name: rate.name,
        code: rate.code,
        rate: rate.rate,
        is_default: rate.is_default,
        active: !rate.deleted_at,
      }
    : {}
}

async function defaultSnapshot(scope: Resolver): Promise<Snapshot> {
  const region = await findVatRegion(scope as unknown as MedusaContainer)
  if (!region) {
    return {}
  }
  const rates = await taxOf(scope).listTaxRates({ tax_region_id: region.id }, { take: 500 })
  const rate = rates.find((candidate) => candidate.is_default)
  return rate ? { default_rate_id: rate.id, default_code: rate.code, default_rate: rate.rate } : {}
}

export const TAX_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/vat-rates",
    pattern: /^\/admin\/vat-rates$/i,
    resourceType: "vat_rate",
    resourceId: () => null,
    snapshot: () => Promise.resolve({}),
  },
  {
    method: "POST",
    route: "POST /admin/vat-rates/default",
    pattern: /^\/admin\/vat-rates\/default$/i,
    resourceType: "vat_rate",
    resourceId: () => null,
    snapshot: ({ scope }) => defaultSnapshot(scope),
  },
  {
    method: "POST",
    route: "POST /admin/vat-rates/:id",
    pattern: new RegExp(`^/admin/vat-rates/(?<id>${ID})$`, "i"),
    resourceType: "vat_rate",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => rateSnapshot(scope, params["id"] ?? ""),
  },
]

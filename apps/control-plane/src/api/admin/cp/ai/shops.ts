import type { MedusaRequest } from "@medusajs/framework/http"
import { tenantsOf } from "../tenants/params"

/**
 * A request's shop as the staff screens name it (P3d): its name, its slug
 * and its primary address, as the shops' list shows them
 * (GET /admin/cp/tenants), so the requests' screen reads no other route.
 */
export interface OrderShop {
  name: string
  slug: string
  primary_hostname: string | null
}

interface ShopRow {
  id: string
  name: string
  slug: string
  domains?: { hostname: string; is_primary: boolean }[]
}

/** The shops of `ids` by id; one no longer on the list (removed) is left out. */
export async function shopsOf(
  req: MedusaRequest,
  ids: readonly string[]
): Promise<Map<string, OrderShop>> {
  const wanted = [...new Set(ids)]
  if (wanted.length === 0) {
    return new Map()
  }
  const rows = (await tenantsOf(req).listTenants(
    { id: wanted },
    {
      select: ["id", "name", "slug", "domains.hostname", "domains.is_primary"],
      relations: ["domains"],
      take: wanted.length,
    }
  )) as unknown as ShopRow[]
  return new Map(
    rows.map((row) => [
      row.id,
      {
        name: row.name,
        slug: row.slug,
        primary_hostname: row.domains?.find((each) => each.is_primary)?.hostname ?? null,
      },
    ])
  )
}

/** One request's shop, or null. */
export async function shopOf(req: MedusaRequest, id: string): Promise<OrderShop | null> {
  return (await shopsOf(req, [id])).get(id) ?? null
}

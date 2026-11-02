import type { MedusaContainer } from "@medusajs/framework/types"
import { isHttpsUrl } from "../../lib/security/https-url"
import type { MenuLinkInput, RecordLinkKind, SystemLink } from "../../lib/storefront/menus"
import { isShopPath } from "../../lib/storefront/menus"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"

type Container = Pick<MedusaContainer, "resolve">

/** The storefront's own pages by their addresses (adr/0046 §3). */
const SYSTEM_PATHS: Readonly<Record<string, SystemLink>> = {
  "/": "home",
  "/magaza": "shop",
  "/blog": "blog",
  "/yorumlar": "reviews",
  "/sepet": "cart",
  "/hesap": "account",
  "/siparis": "order_lookup",
}

const KIND_OF_TYPE: Readonly<Record<string, RecordLinkKind>> = {
  [CATALOG_ENTITY_TYPES.category]: "category",
  [CATALOG_ENTITY_TYPES.product]: "product",
  [CATALOG_ENTITY_TYPES.collection]: "collection",
  [CATALOG_ENTITY_TYPES.brand]: "brand",
  [CATALOG_ENTITY_TYPES.page]: "page",
  [CATALOG_ENTITY_TYPES.post]: "post",
  [CATALOG_ENTITY_TYPES.landing]: "landing",
}

const normalized = (path: string): string => {
  const bare = path.split(/[?#]/)[0] ?? path
  return bare.length > 1 ? bare.replace(/\/+$/, "") : bare
}

/**
 * A link written as an address, as a record when the address is one
 * (adr/0049): a storefront page by its name, a record's live path by the
 * record, anything else kept as written. For moving the frame's typed
 * links into menus and for shop profiles. The wording is kept.
 */
export async function linkFromHref(
  container: Container,
  { label, href }: { label: string; href: string }
): Promise<MenuLinkInput> {
  const url = href.trim()
  if (isHttpsUrl(url) || !isShopPath(url)) {
    return { kind: "url", url, label }
  }
  const path = normalized(url)
  const system = SYSTEM_PATHS[path]
  if (system) {
    return { kind: "system", target: system, label }
  }
  const [entry] = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      { locale: CATALOG_LOCALE, path, status: "active" },
      { select: ["entity_type", "entity_id"], take: 1 }
    )
  const kind = entry ? KIND_OF_TYPE[entry.entity_type] : undefined
  return kind && entry ? { kind, target: entry.entity_id, label } : { kind: "url", url, label }
}

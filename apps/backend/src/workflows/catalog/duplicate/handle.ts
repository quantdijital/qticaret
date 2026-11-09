import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SLUG_MAX_LENGTH, isReservedPath, productPath, toSlug } from "../../../lib/seo"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../entity-paths"

// How far a copy's address counts up before it takes a random tail
const MAX_TRIES = 50

/**
 * A copy's address candidates: `sef-bicagi-kopya`, then `-kopya-2`, `-3`…,
 * each cut to a slug's length with its tail kept.
 */
export function copyHandles(handle: string, tries = MAX_TRIES): string[] {
  return Array.from({ length: tries }, (_, index) => {
    const tail = index === 0 ? "-kopya" : `-kopya-${String(index + 1)}`
    return `${toSlug(handle, SLUG_MAX_LENGTH - tail.length) || "urun"}${tail}`
  })
}

type Container = Pick<MedusaContainer, "resolve">

/**
 * Whether an address is free for a new product: no product has the handle,
 * and its path in neither URL style is held, reserved for a redirect, or
 * the shop's own (docs/13 §2). Any record's entry counts: the copy is new.
 */
async function isFree(container: Container, handle: string): Promise<boolean> {
  const paths = [productPath(handle, "prefixed"), productPath(handle, "flat")]
  if (paths.some(isReservedPath)) {
    return false
  }
  const [{ data: products }, entries] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: ["id"],
      filters: { handle },
    }),
    container
      .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
      .listUrlEntries({ locale: CATALOG_LOCALE, path: paths }, { select: ["id"], take: 1 }),
  ])
  return products.length === 0 && entries.length === 0
}

/** The first free copy address of `handle`; past the tries, one with a random tail. */
export async function freeCopyHandle(container: Container, handle: string): Promise<string> {
  for (const candidate of copyHandles(handle)) {
    if (await isFree(container, candidate)) {
      return candidate
    }
  }
  const tail = `-kopya-${Date.now().toString(36)}`
  return `${toSlug(handle, SLUG_MAX_LENGTH - tail.length) || "urun"}${tail}`
}

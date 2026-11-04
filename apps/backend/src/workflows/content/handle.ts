import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import {
  SLUG_MAX_LENGTH,
  isReservedPath,
  isValidSlug,
  pagePath,
  postPath,
  toSlug,
} from "../../lib/seo"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { ContentKind } from "../../modules/content/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"

/**
 * A content entry's handle (F3.16, adr/0019 Ek 2026-11-04): only a title is
 * asked for. An address typed in any form is made a slug; one made from the
 * title takes the first free `-2`, `-3`… when another record has it; one
 * typed and taken is refused, as the person chose it.
 */

/**
 * The handle a save gives: what was typed, made a slug as a title would be
 * (`Kargo Bilgisi` → `kargo-bilgisi`), else the title's. Refused only when
 * neither has a letter to make one from.
 */
export function handleOf(raw: string | undefined, title: string): string {
  const typed = raw?.trim() ?? ""
  const handle = isValidSlug(typed) ? typed : toSlug(typed) || toSlug(title)
  if (handle === "") {
    throw new ValidationError("catalog.handle_required", { field: "handle" })
  }
  return handle
}

/** A handle typed, or kept, that another entry of the kind has: `seo.path_taken`. */
export async function assertHandleFree(
  container: MedusaContainer,
  kind: ContentKind,
  handle: string,
  id: string | null
) {
  const taken = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ kind, handle }, { select: ["id"] })
  if (taken.some((entry) => entry.id !== id)) {
    throw new ValidationError("seo.path_taken", { field: "handle" })
  }
}

// How far a handle made from a title counts up before the save says it is taken
const MAX_SUFFIX = 50

/**
 * Whether the handle is the entry's to take: no other entry of its kind
 * has it, its path is not the shop's own, and no other record holds the
 * path in the URL registry (a deleted page's answers 410).
 */
async function isHandleFree(
  container: MedusaContainer,
  kind: ContentKind,
  handle: string,
  id: string | null
): Promise<boolean> {
  const path = kind === "post" ? postPath(handle) : pagePath(handle)
  if (isReservedPath(path)) {
    return false
  }
  const [entries, paths] = await Promise.all([
    container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listContentEntries({ kind, handle }, { select: ["id"] }),
    container
      .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
      .listUrlEntries({ locale: CATALOG_LOCALE, path }, { select: ["entity_type", "entity_id"] }),
  ])
  return (
    entries.every((entry) => entry.id === id) &&
    paths.every(
      (entry) => entry.entity_type === CATALOG_ENTITY_TYPES[kind] && entry.entity_id === id
    )
  )
}

/** A handle made from the title, or `-2`, `-3`… after it when another record has it. */
export async function freeHandleFrom(
  container: MedusaContainer,
  kind: ContentKind,
  base: string,
  id: string | null
): Promise<string> {
  for (let count = 1; count <= MAX_SUFFIX; count += 1) {
    const suffix = count === 1 ? "" : `-${String(count)}`
    const handle = `${toSlug(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`
    if (await isHandleFree(container, kind, handle, id)) {
      return handle
    }
  }
  // As many as that: the save says so, as for a handle typed
  return base
}

import { ValidationError } from "../../lib/errors"
import { SLUG_SEGMENT, isValidSlug } from "../../lib/seo"

export interface UrlKey {
  locale: string
  /** `/urun/sef-bicagi`: leading slash, slug segments, no trailing slash. */
  path: string
}

export interface UrlOwner {
  /** `product`, `product_category`, `page`, ...: any record that has a storefront URL. */
  entity_type: string
  entity_id: string
}

// One form until multi-language content (F19, docs/13 §11): "tr" and
// "tr-TR" must not become two keys for the same storefront
const LOCALE = /^[a-z]{2}$/
const PATH = new RegExp(`^(?:/${SLUG_SEGMENT})+$`)
const MAX_PATH_LENGTH = 512
const ENTITY_TYPE = /^[a-z][a-z0-9_]{0,63}$/
const MAX_ENTITY_ID_LENGTH = 128

const isLocale = (locale: string): boolean => LOCALE.test(locale)

// Every segment is a valid slug, so no digits-only (ID-like) URL is stored
const isPath = (path: string): boolean =>
  path.length <= MAX_PATH_LENGTH && PATH.test(path) && path.split("/").slice(1).every(isValidSlug)

export const isUrlKey = ({ locale, path }: UrlKey): boolean => isLocale(locale) && isPath(path)

/**
 * Paths are stored in their canonical form only; the storefront edge
 * normalises case and trailing slashes with a 301 (docs/13 §2.2).
 */
export function assertUrlKey({ locale, path }: UrlKey): void {
  if (!isLocale(locale)) {
    throw new ValidationError("seo.locale_invalid", { field: "locale" })
  }
  if (!isPath(path)) {
    throw new ValidationError("seo.path_invalid", { field: "path" })
  }
}

export function assertUrlOwner({ entity_type, entity_id }: UrlOwner): void {
  if (!ENTITY_TYPE.test(entity_type)) {
    throw new ValidationError("seo.entity_type_invalid", { field: "entity_type" })
  }
  if (entity_id === "" || entity_id.length > MAX_ENTITY_ID_LENGTH) {
    throw new ValidationError("seo.entity_id_invalid", { field: "entity_id" })
  }
}

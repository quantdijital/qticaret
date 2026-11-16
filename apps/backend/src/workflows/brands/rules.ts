import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError, ValidationError } from "../../lib/errors"
import { libraryImage } from "../../lib/media/library-image"
import { refuseSvgImages } from "../../lib/media/svg-use"
import { containsPattern, isCleanText } from "../../lib/security"
import { isValidSlug, toSlug } from "../../lib/seo"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import type { BrandRecord } from "../../modules/brands/service"
import { publicUploadUrl } from "../files/public-upload"
import { measureLogo } from "./logo-size"

/**
 * What a brand save may hold (F3.11): a name the shop has once, a slug
 * handle (made from the name when none is given), clean text, and a logo
 * that is an image in the media library (the shop's own uploads).
 */

export const BRAND_LIMITS = { name: 120, description: 5000 } as const

export interface BrandInput {
  name?: string | undefined
  handle?: string | undefined
  description?: string | null | undefined
  /** An upload's id; null removes the logo. */
  logo_file_id?: string | null | undefined
  is_active?: boolean | undefined
}

export interface BrandFields {
  name: string
  handle: string
  description: string | null
  logo_file_id: string | null
  logo_url: string | null
  /** The logo's size in pixels, read on the server; null when unknown. */
  logo_width: number | null
  logo_height: number | null
  is_active: boolean
}

// Several lines are fine in a description; each must be clean
const isCleanBlock = (text: string): boolean =>
  text.split("\n").every((line) => isCleanText(line, true))

function nameOf(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ")
  if (name === "" || name.length > BRAND_LIMITS.name || !isCleanText(name)) {
    throw new ValidationError("brands.name_invalid", { field: "name" })
  }
  return name
}

function handleOf(raw: string | undefined, name: string): string {
  const handle = raw === undefined || raw.trim() === "" ? toSlug(name) : raw.trim()
  if (handle === "") {
    throw new ValidationError("catalog.handle_required", { field: "handle" })
  }
  if (!isValidSlug(handle)) {
    throw new ValidationError("catalog.handle_invalid", { field: "handle" })
  }
  return handle
}

function descriptionOf(raw: string | null): string | null {
  const text = (raw ?? "").replace(/\r\n?/g, "\n").trim()
  if (text.length > BRAND_LIMITS.description || !isCleanBlock(text)) {
    throw new ValidationError("brands.description_invalid", { field: "description" })
  }
  return text === "" ? null : text
}

/** Another brand with this name (any case) or handle refuses the save. */
async function assertUnique(container: MedusaContainer, fields: BrandFields, id: string | null) {
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  // `containsPattern` escapes the wildcards; trimming its `%`s leaves an exact, any-case match
  const exactName = containsPattern(fields.name).slice(1, -1)
  const [byName, byHandle] = await Promise.all([
    service.listBrands({ name: { $ilike: exactName } }, { select: ["id"] }),
    service.listBrands({ handle: fields.handle }, { select: ["id"] }),
  ])
  if (byName.some((brand) => brand.id !== id)) {
    throw new ConflictError("brands.name_taken")
  }
  if (byHandle.some((brand) => brand.id !== id)) {
    throw new ValidationError("seo.path_taken", { field: "handle" })
  }
}

/**
 * A newly chosen logo's public address: an image in the media library
 * (`lib/media/library-image.ts`), as the shop's own logos are. Any other
 * stored file (an invoice, a label, a feed) is refused even when its key
 * is known, so the Store API never hands its address out.
 */
async function logoUrl(container: MedusaContainer, fileId: string): Promise<string> {
  const asset = await libraryImage(container, { file_id: fileId })
  const url = asset ? await publicUploadUrl(container, fileId) : null
  if (url === null) {
    throw new ValidationError("brands.logo_unknown", { field: "logo_file_id" })
  }
  return url
}

/** The brand as it will be stored: `current` filled in with what the save sends. */
export async function brandFields(
  container: MedusaContainer,
  input: BrandInput,
  current: BrandRecord | null
): Promise<BrandFields> {
  const name = nameOf(input.name ?? current?.name ?? "")
  const fields: BrandFields = {
    name,
    handle: input.handle === undefined && current ? current.handle : handleOf(input.handle, name),
    description:
      input.description === undefined
        ? (current?.description ?? null)
        : descriptionOf(input.description),
    logo_file_id: current?.logo_file_id ?? null,
    logo_url: current?.logo_url ?? null,
    logo_width: current?.logo_width ?? null,
    logo_height: current?.logo_height ?? null,
    is_active: input.is_active ?? current?.is_active ?? true,
  }
  // Only a newly chosen logo is checked: one kept from before this rule (any stored file) stays
  if (input.logo_file_id !== undefined && input.logo_file_id !== current?.logo_file_id) {
    const url = input.logo_file_id ? await logoUrl(container, input.logo_file_id) : null
    // A product brand's logo is a catalogue picture: no SVG (the shop's own logos only)
    await refuseSvgImages(container, [url], "logo_file_id")
    fields.logo_file_id = input.logo_file_id
    fields.logo_url = url
    // Its size from the file, never from the request; one that cannot be read stays unknown
    const size =
      input.logo_file_id && url ? await measureLogo(container, input.logo_file_id, url) : null
    fields.logo_width = size?.width ?? null
    fields.logo_height = size?.height ?? null
  }
  await assertUnique(container, fields, current?.id ?? null)
  return fields
}

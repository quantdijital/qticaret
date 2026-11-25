import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"

/**
 * Every place that may point at a library picture, read in bulk for the
 * library's "Kullanılmayan" view and its bulk delete (M1, docs/06 Ortam
 * kütüphanesi). Wider than `mediaUses` (which names each use for the
 * detail): a picture counts as used when its id, its storage key, its
 * file name or one of its versions' names appears anywhere in these
 * columns, inside an address, a `srcset`, a document or a setting alike.
 * A false "used" only keeps a file; a false "unused" would break a page,
 * so a column that cannot be read fails the whole check (unknown = used).
 */

type Container = Pick<MedusaContainer, "resolve">

interface Source {
  table: string
  columns: readonly string[]
}

/** Tables and columns that hold a picture's address, key or id, or a document that may. */
export const MEDIA_REFERENCE_SOURCES: readonly Source[] = [
  // Medusa's own: a product's pictures and thumbnail, a variant's, lines of orders and carts
  { table: "image", columns: ["url"] },
  { table: "product", columns: ["thumbnail"] },
  { table: "product_variant", columns: ["thumbnail"] },
  { table: "order_line_item", columns: ["thumbnail"] },
  { table: "cart_line_item", columns: ["thumbnail"] },
  // The catalog's own pictures and texts
  { table: "product_extension", columns: ["description_doc", "summary_doc", "addons"] },
  { table: "brand", columns: ["logo_url", "logo_file_id", "description_doc"] },
  { table: "category_image", columns: ["url"] },
  { table: "category_extension", columns: ["description_doc"] },
  { table: "collection_extension", columns: ["image_url", "description_doc"] },
  { table: "addon_template", columns: ["addons"] },
  { table: "attribute_definition", columns: ["options"] },
  { table: "attribute_value", columns: ["value_options"] },
  // Content, messages and legal texts
  { table: "content_entry", columns: ["image_url", "body"] },
  { table: "content_author", columns: ["image_url"] },
  { table: "content_term", columns: ["description_doc"] },
  { table: "landing_page", columns: ["body"] },
  { table: "bulk_message", columns: ["body"] },
  { table: "legal_document", columns: ["body"] },
  { table: "popup", columns: ["image_url", "body"] },
  { table: "payment_link", columns: ["lines"] },
  // A page's share image (its storage key), every setting, the storefront's design
  { table: "seo_meta", columns: ["og_image_override"] },
  { table: "platform_settings_section", columns: ["values"] },
  { table: "storefront_layout", columns: ["draft", "published"] },
  // Earlier versions and saved looks: putting one back must find its pictures
  { table: "storefront_layout_revision", columns: ["document"] },
  { table: "storefront_design", columns: ["document"] },
  // A video's poster, a migration's and a sector preset's own records of the picture
  { table: "media_video", columns: ["poster"] },
  { table: "migration_file", columns: ["media_id"] },
  { table: "sector_pack_item", columns: ["record_id"] },
]

// What a name, key or id is made of; anything else separates them (/, ", spaces, commas)
const SEPARATOR = /[^A-Za-z0-9._-]+/
// Shorter pieces ("1x", "webp", "https") are never a picture's name, key or id
const MIN_TOKEN = 6

/** Every piece of text in a value that could be a picture's name, key or id. */
export function tokensOf(text: string, into: Set<string>): void {
  for (const token of text.split(SEPARATOR)) {
    if (token.length >= MIN_TOKEN) {
      into.add(token)
    }
  }
}

/** The pieces every source holds, plus the pictures linked to a product. */
export interface MediaReferences {
  tokens: Set<string>
  /** Pictures linked to a product as its media records. */
  linked: Set<string>
}

async function columnTokens(knex: Knex, source: Source, column: string, into: Set<string>) {
  const rows = (await knex(source.table)
    .distinct(knex.raw("??::text as value", [column]))
    .whereNull("deleted_at")
    .whereNotNull(column)) as { value: string | null }[]
  for (const row of rows) {
    if (row.value) {
      tokensOf(row.value, into)
    }
  }
}

/** Reads every source; any failure fails the check rather than calling a picture unused. */
export async function readMediaReferences(
  container: Container,
  assetIds: readonly string[]
): Promise<MediaReferences> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const tokens = new Set<string>()
  for (const source of MEDIA_REFERENCE_SOURCES) {
    for (const column of source.columns) {
      await columnTokens(knex, source, column, tokens)
    }
  }
  const linked = new Set<string>()
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (const chunk of chunksOf(assetIds, 500)) {
    const { data } = await query.graph({
      entity: "media_asset",
      fields: ["id", "product.id"],
      filters: { id: [...chunk] },
    })
    for (const row of data as { id: string; product?: { id: string } | null }[]) {
      if (row.product) {
        linked.add(row.id)
      }
    }
  }
  return { tokens, linked }
}

/** A library picture as the check reads it. */
export interface ReferencedAsset {
  id: string
  url: string
  file_id: string | null
  derivatives?: unknown
  derivative_file_ids?: string[] | null
}

// Every string inside the versions' record (srcset addresses, the share crop's)
function strings(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    into.push(value)
  } else if (Array.isArray(value)) {
    for (const each of value) {
      strings(each, into)
    }
  } else if (value && typeof value === "object") {
    for (const each of Object.values(value)) {
      strings(each, into)
    }
  }
}

/** The names a picture can be found by: its id, key, file name and its versions'. */
export function keysOf(asset: ReferencedAsset): string[] {
  const texts = [asset.id, asset.url, asset.file_id ?? "", ...(asset.derivative_file_ids ?? [])]
  strings(asset.derivatives, texts)
  const keys = new Set<string>()
  for (const text of texts) {
    // An address's last piece is its file name; a key or id is one piece already
    const last = text.split("?")[0]?.split("/").pop() ?? ""
    if (last.length >= MIN_TOKEN) {
      keys.add(last)
    }
  }
  return [...keys]
}

/** Whether anything may show the picture: unknown counts as used. */
export const isReferenced = (asset: ReferencedAsset, references: MediaReferences): boolean =>
  references.linked.has(asset.id) || keysOf(asset).some((key) => references.tokens.has(key))

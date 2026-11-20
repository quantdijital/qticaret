/**
 * A collection's own fields beyond Medusa's (`collection_extension`,
 * linked one to one): how a query reads them, and the rule every reader
 * shares for whether its page is public. A collection without a row is.
 */

export interface CollectionExtensionRow {
  id?: string
  description?: string | null
  /** adr/0075: the text as a content document; `description` then holds its plain text. */
  description_doc?: unknown
  is_active?: boolean | null
  image_url?: string | null
  image_alt?: string | null
}

/** The fields a `product_collection` query asks for, through the link. */
export const COLLECTION_EXTENSION_FIELDS = [
  "collection_extension.id",
  "collection_extension.description",
  "collection_extension.description_doc",
  "collection_extension.is_active",
  "collection_extension.image_url",
  "collection_extension.image_alt",
] as const

/** Only the visibility, for the "is it live" checks. */
export const COLLECTION_LIVE_FIELDS = ["collection_extension.is_active"] as const

/** Whether the collection's page is public: shown unless the shop hid it. */
export const isCollectionShown = (row: {
  collection_extension?: CollectionExtensionRow | null
}): boolean => row.collection_extension?.is_active !== false

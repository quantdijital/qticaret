import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { ContentDoc } from "../../../lib/content/doc"
import { rewriteDocHrefs } from "../../../lib/content/links"
import { CATALOG_EXTENSION_MODULE } from "../../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../../modules/catalog-extension/service"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"

/**
 * The link rewrite's writes (adr/0042 Ek 2026-11-05): each document read
 * again as it is now (under the workflow's locks), its links given their
 * new addresses, written only when one changed. Undone, each document
 * gets back the body it had. Nothing but the links changes: the text, its
 * summary and word count, its dates stay.
 */

export interface RewriteEntriesInput {
  ids: string[]
  next: Record<string, string>
}

export interface RewriteProductsInput {
  products: { product_id: string; extension_id: string }[]
  next: Record<string, string>
}

/** Pages' and posts' bodies; how many were written. */
export const rewriteEntryLinksStep = createStep(
  "content-rewrite-entry-links",
  async (input: RewriteEntriesInput, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const next = new Map(Object.entries(input.next))
    const previous: { id: string; body: Record<string, unknown> }[] = []
    if (input.ids.length > 0) {
      const rows = await service.listContentEntries(
        { id: input.ids },
        { select: ["id", "body"], take: null }
      )
      for (const row of rows) {
        const { doc, changed } = rewriteDocHrefs(row.body as unknown as ContentDoc, next)
        if (changed > 0) {
          await service.updateContentEntries({
            id: row.id,
            body: doc as unknown as Record<string, unknown>,
          })
          previous.push({ id: row.id, body: row.body })
        }
      }
    }
    return new StepResponse(previous.length, previous)
  },
  async (previous, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    for (const row of previous ?? []) {
      await service.updateContentEntries(row)
    }
  }
)

/** Products' description documents (adr/0055); how many were written. */
export const rewriteProductLinksStep = createStep(
  "content-rewrite-product-links",
  async (input: RewriteProductsInput, { container }) => {
    const service = container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    const next = new Map(Object.entries(input.next))
    const previous: { id: string; description_doc: Record<string, unknown> }[] = []
    const ids = input.products.map((product) => product.extension_id)
    if (ids.length > 0) {
      const rows = await service.listProductExtensions(
        { id: ids },
        { select: ["id", "description_doc"], take: null }
      )
      for (const row of rows) {
        if (!row.description_doc) {
          continue
        }
        const { doc, changed } = rewriteDocHrefs(row.description_doc as unknown as ContentDoc, next)
        if (changed > 0) {
          await service.updateProductExtensions({
            id: row.id,
            description_doc: doc as unknown as Record<string, unknown>,
          })
          previous.push({
            id: row.id,
            description_doc: row.description_doc,
          })
        }
      }
    }
    return new StepResponse(previous.length, previous)
  },
  async (previous, { container }) => {
    const service = container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    for (const row of previous ?? []) {
      await service.updateProductExtensions(row)
    }
  }
)

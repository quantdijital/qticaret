import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import {
  deleteCategoryExtension,
  dropStaleCategoryDoc,
} from "../workflows/catalog/category-description-sync"

/**
 * A category's text document follows its plain text (adr/0075): a text
 * changed outside the document drops it, a deleted category takes its row.
 * A failure never touches the change: reads hide a stale document anyway.
 */
export default async function categoryDescriptionSync({
  event,
  container,
}: SubscriberArgs<{ id?: string | string[] }>) {
  const ids = [event.data.id ?? []].flat()
  for (const id of ids) {
    try {
      if (event.name === "product-category.deleted") {
        await deleteCategoryExtension(container, id)
      } else {
        await dropStaleCategoryDoc(container, id)
      }
    } catch (error) {
      logger.warn({
        event: "catalog.category_description_sync_failed",
        source: event.name,
        category_id: id,
        err: errorSummary(error),
      })
    }
  }
}

export const config: SubscriberConfig = {
  event: ["product-category.updated", "product-category.deleted"],
}

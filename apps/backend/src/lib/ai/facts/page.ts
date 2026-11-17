import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { plainText } from "../../seo/text"
import { aiValidationError } from "../errors"
import type { FactsContainer, RecordFacts } from "./types"

interface PageRow {
  title: string
  excerpt?: string | null
  body_summary?: string | null
}

/** The body's opening a description is written from; the summary is kept short already. */
export const PAGE_SUMMARY_LENGTH = 600

export const PAGE_FACT_FIELDS = ["title", "excerpt", "body_summary"] as const

/**
 * What may leave the shop of a content page (adr/0071 §10): its title,
 * its own summary and the body's opening as plain text. The writer's
 * name, the image and the record's dates stay in; a blog post is no page
 * here (its kind is part of the filter).
 */
export async function pageFacts(container: FactsContainer, id: string): Promise<RecordFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "content_entry",
    fields: [...PAGE_FACT_FIELDS],
    filters: { id, kind: "page" },
  })
  const page = data[0] as PageRow | undefined
  if (!page) {
    throw aiValidationError("ai.unknown_entity")
  }
  return {
    name: page.title,
    summary: page.excerpt ? plainText(page.excerpt) : null,
    body: page.body_summary ? plainText(page.body_summary) : null,
  }
}

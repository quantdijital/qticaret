import type { ExecArgs } from "@medusajs/framework/types"
import { convertFaqTexts } from "../workflows/storefront/faq-convert"

/**
 * Runs once per shop, on the `db:migrate` that brings the FAQ's own
 * questions (adr/0073 Ek 2026-11-24 (2)): each content page text drawn as
 * questions out of its words becomes an FAQ section, question by
 * question, in the draft design and, when one is live, in the live design
 * (a system revision, recorded), drawn as before; the text stays after
 * it, hidden. A text that would not come out the same is left and
 * counted. A second run writes nothing. Logged with counts only
 * (`storefront.faq_pages_converted`).
 */
export default async function faqPagesIntoSections({ container }: ExecArgs) {
  await convertFaqTexts(container)
}

import type { ExecArgs } from "@medusajs/framework/types"
import { movePageTexts } from "../workflows/storefront/page-convert"

/**
 * Runs once per shop, on the `db:migrate` that brings the pages into the
 * theme editor (adr/0073 Ek 2026-11-19 (2) K3): each content page's text
 * becomes its sections in the draft design and, when one is live, in the
 * live design (a system revision, recorded). A page past the design's room
 * or one that will not convert is left to its mirror (K1); counted, never
 * stopping the others. A second run writes nothing. Logged with counts
 * only (`storefront.pages_converted`, by `movePageTexts`).
 */
export default async function contentPagesIntoLayout({ container }: ExecArgs) {
  await movePageTexts(container)
}

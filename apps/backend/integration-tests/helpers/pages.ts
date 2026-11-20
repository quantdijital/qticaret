import type { MedusaContainer } from "@medusajs/framework/types"
import { replacePageTextWorkflow } from "../../src/workflows/storefront/page-text-replace"

/**
 * A content page's text written as the system writes it (adr/0073 Ek
 * 2026-11-19 (2) K4: an import, the shop profile): into its text section
 * in the theme editor's design where it has an entry (or one made where
 * there is room), and into its `body` mirror. Staff no longer send a
 * page's `body` to `/admin/content` (K2).
 */
export async function writePageText(
  container: MedusaContainer,
  pageId: string,
  doc: unknown
): Promise<{ page_id: string; mirrored: boolean; live: boolean }> {
  const { result } = await replacePageTextWorkflow(container).run({
    input: { page_id: pageId, doc },
  })
  return result
}

/** Why `writePageText` refused the text (the error's message), or null when it wrote it. */
export const pageTextRefusal = (
  container: MedusaContainer,
  pageId: string,
  doc: unknown
): Promise<string | null> =>
  writePageText(container, pageId, doc).then(
    () => null,
    (error: unknown) => (error as { message?: string } | null)?.message ?? String(error)
  )

import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { PageTextSource } from "../../lib/storefront/page-text"
import { isShopText } from "../../lib/storefront/presets/page-texts"
import { openDraftPage, removeDraftPages } from "../content/draft-page"
import { pageTextSources } from "./page-text-source"
import { recordsByHandle } from "./preset-lookups"

/**
 * A ready-made look's content pages (adr/0073 Ek 2026-11-19 (2) K6, which
 * changes §4's "a look never makes a page"): a page the look lays out and
 * the shop has not made is opened as a **draft** under the look's name for
 * it and the handle's address; the shop's own page text is kept on the
 * pages it lays out (`withShopTexts`).
 */

/** A page a preset opens as a draft: `page:hakkimizda`, its address and title. */
export interface PageToOpen {
  ref: string
  handle: string
  title: string
}

/** A page the apply opened (`made_pages`): the preset's reference, the page, its title. */
export interface MadePage {
  ref: string
  page_id: string
  name: string
}

/** The pages an apply opened, by reference, and the ones whose address another record held. */
export interface OpenedPages {
  /** `page:hakkimizda` → the page's id: opened now, or made by the shop since the lookup. */
  records: Record<string, string>
  made: MadePage[]
  /** References whose page could not be opened: their address another record's. */
  taken: string[]
}

/** A page whose own text a preset kept (K6): the preset's reference, and the look's name for it. */
export interface KeptText {
  ref: string
  name?: string
}

/** A preset's content pages by their references, with the look's names for them. */
export function presetPageRefs(
  layout: Record<string, unknown[] | undefined>
): { ref: string; name: string | null }[] {
  return (layout["pages"] ?? []).flatMap((page) => {
    const entry = page as { page_id?: { $handle?: unknown }; name?: unknown } | null
    const ref = entry?.page_id?.$handle
    // A content page's handle only: never a category or product opened as a page (security
    // review S9); the pack's loader refuses one already (`pageRef`)
    return typeof ref === "string" && ref.startsWith("page:")
      ? [{ ref, name: typeof entry?.name === "string" ? entry.name : null }]
      : []
  })
}

/** A page to open, held to the design's schema before it exists: a `cnt_` id no page has. */
export const placeholderOf = (index: number): string => `cnt_presetpage${String(index)}`

/**
 * The mirrors of the look's pages the draft lays out without a text
 * section of the shop's (or not at all): what K1's synthesis would show,
 * the shop's text to keep. Reads only.
 */
export async function shopTextSources(
  container: Pick<MedusaContainer, "resolve">,
  ids: readonly string[],
  shop: readonly { page_id: string; sections: readonly unknown[] }[]
): Promise<Map<string, PageTextSource>> {
  const texted = new Set(
    shop.filter((page) => page.sections.some(isShopText)).map((page) => page.page_id)
  )
  return pageTextSources(
    container,
    ids.filter((id) => !texted.has(id) && !id.startsWith("cnt_presetpage"))
  )
}

/**
 * The pages a look lays out that the shop has not made, opened as drafts
 * (K6): the title the look's name, the address the handle's
 * (`openDraftPage`, shared with a sector pack's pages). One the shop made
 * since the lookup is its own, used as it is; one whose address another
 * record holds is not opened (`taken`: its layout is left out, as before).
 * Undone if a later step fails: the pages it opened are deleted (never
 * live, their addresses freed).
 */
export const openPresetPagesStep = createStep(
  "storefront-preset-open-pages",
  async (pages: PageToOpen[], { container }) => {
    const opened: OpenedPages = { records: {}, made: [], taken: [] }
    if (pages.length === 0) {
      return new StepResponse(opened, [] as string[])
    }
    const found = await recordsByHandle(
      container,
      pages.map((page) => page.ref)
    )
    try {
      for (const page of pages) {
        const existing = found.get(page.ref)
        if (existing) {
          opened.records[page.ref] = existing
          continue
        }
        const id = await openDraftPage(container, { title: page.title, handle: page.handle })
        if (id === null) {
          opened.taken.push(page.ref)
          continue
        }
        opened.records[page.ref] = id
        opened.made.push({ ref: page.ref, page_id: id, name: page.title })
      }
    } catch (error) {
      await removeDraftPages(
        container,
        opened.made.map((page) => page.page_id)
      )
      throw error
    }
    return new StepResponse(
      opened,
      opened.made.map((page) => page.page_id)
    )
  },
  async (made, { container }) => {
    await removeDraftPages(container, made ?? [])
  }
)

import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { SEO_SITEMAPS_MODULE } from "../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../modules/seo-sitemaps/service"

interface PageState {
  id: string
  status: "draft" | "published"
  published_at: Date | null
}

/**
 * The content pages in draft that go live with the design (adr/0073 Ek
 * 2026-11-19 (2) K5, "Sayfayı da yayına al"): each made live as a content
 * save makes it (its first publishing dated now; its path is claimed from
 * its first save, draft or not), every process's resolve answers
 * forgotten and the sitemap marked for its refresh. A page already live
 * is left as it is. An id that is not one of the shop's pages (a post,
 * none such) is a stale or forged editor: refused, and the publication
 * with it. Run under the content lock. Undone, each page is in draft
 * again with the date it had. Answers the pages made live, `{ id, kind }`.
 */
export const pagesLiveStep = createStep(
  "storefront-pages-live",
  async (ids: string[], { container }) => {
    if (ids.length === 0) {
      return new StepResponse([] as { id: string; kind: "page" }[], [] as PageState[])
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const entries = await service.listContentEntries(
      { id: ids },
      { select: ["id", "kind", "status", "published_at"], take: null }
    )
    if (entries.length !== new Set(ids).size || entries.some((entry) => entry.kind !== "page")) {
      throw new ValidationError("storefront_layout.page_invalid", { field: "pages_live" })
    }
    const now = new Date()
    const previous: PageState[] = []
    try {
      for (const entry of entries.filter((each) => each.status !== "published")) {
        previous.push({ id: entry.id, status: entry.status, published_at: entry.published_at })
        await service.updateContentEntries({
          id: entry.id,
          status: "published",
          published_at: entry.published_at ?? now,
        })
      }
    } catch (error) {
      // The step did not finish, so the workflow will not undo it: put back what it wrote
      for (const page of previous) {
        await service.updateContentEntries(page)
      }
      throw error
    }
    if (previous.length > 0) {
      await forgetAnswers(container)
    }
    return new StepResponse(
      previous.map((each) => ({ id: each.id, kind: "page" as const })),
      previous
    )
  },
  async (previous, { container }) => {
    if (!previous || previous.length === 0) {
      return
    }
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    for (const page of previous) {
      await service.updateContentEntries(page)
    }
    await forgetAnswers(container)
  }
)

/** What a page going live (or back) changes: the resolve answers and the sitemap. */
async function forgetAnswers(container: Pick<MedusaContainer, "resolve">): Promise<void> {
  await Promise.all([
    container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions(),
    container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).markDirty(),
  ])
}

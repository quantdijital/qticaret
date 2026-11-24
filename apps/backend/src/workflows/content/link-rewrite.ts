import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import { planContentLinks } from "./link-plan"
import type { LinkPlan, LinkRow, LinkScope } from "./link-plan"
import { rewriteEntryLinksStep, rewriteProductLinksStep } from "./steps/rewrite-links"
import { LAYOUT_LOCK } from "../storefront/layout"
import { recordSystemLayoutStep } from "../storefront/layout-system"
import { rewriteLayoutLinksStep } from "./link-layout"
import { rewriteListingLinksStep } from "./link-listings"
import { rewriteTermLinksStep } from "./link-terms"
import { CONTENT_LOCK } from "./workflows"

/**
 * The shop's texts' links to itself pointed at the pages that answer today
 * (adr/0042 Ek 2026-11-05): a migrated post's `/el-yapimi-caki` or
 * `https://mylarte.com/urun/x/` becomes the category's or the product's
 * path here, through the URL registry and the redirect rules, as a
 * visitor following the link would be sent. Links elsewhere are never
 * touched; an address that answers nothing (or a 410) stays as written
 * and is reported. A dry run plans and writes nothing.
 */

export interface LinkRewriteInput {
  scope?: LinkScope
  /** Old sites' hosts beyond the shop's own and its migrations' (`eski-alan.com`). */
  hosts?: string[]
}

export interface LinkRewriteResult {
  documents: number
  /** Documents written (would be, in a dry run). */
  rewritten: number
  changed: LinkRow[]
  unresolved: LinkRow[]
}

const planContentLinksStep = createStep(
  "content-plan-links",
  async (input: LinkRewriteInput, { container }) =>
    new StepResponse(await planContentLinks(container, input))
)

/**
 * Every document written takes the lock its own saves take: content's, the
 * design's (a page's text is its sections', adr/0073 Ek 2026-11-19 (2)
 * K7), each product's. A category's, brand's or collection's save takes
 * its own lock itself (adr/0075), so none of theirs is held here. A blog
 * category's or tag's is content's (adr/0075 Ek 2026-11-24).
 */
const lockKeys = (plan: LinkPlan): string[] => [
  ...(plan.writes.entries.length > 0 ? [LAYOUT_LOCK.key, CONTENT_LOCK.key] : []),
  ...(plan.writes.terms.length > 0 && plan.writes.entries.length === 0 ? [CONTENT_LOCK.key] : []),
  ...plan.writes.products.map((product) => `catalog:${product.product_id}`),
]

export const rewriteContentLinksWorkflow = createWorkflow(
  "content-rewrite-links",
  (input: LinkRewriteInput) => {
    const plan = planContentLinksStep(input)
    const key = transform({ plan }, ({ plan }) => {
      const keys = lockKeys(plan)
      // A plan with nothing to write still takes one lock of its own, never none
      return keys.length > 0 ? keys : ["content-links"]
    })
    const held = acquireLocksStep({ key, timeout: 30, ttl: 300 })
    const layout = rewriteLayoutLinksStep(
      transform({ plan }, ({ plan }) => ({ ids: plan.writes.entries, next: plan.next }))
    )
    // A page's `body` is its text sections' mirror: its links rewritten alike
    const entries = rewriteEntryLinksStep(
      transform({ plan }, ({ plan }) => ({ ids: plan.writes.entries, next: plan.next }))
    )
    const products = rewriteProductLinksStep(
      transform({ plan }, ({ plan }) => ({ products: plan.writes.products, next: plan.next }))
    )
    // Categories', brands' and collections' descriptions, each through its own save (adr/0075)
    const listings = rewriteListingLinksStep(
      transform({ plan }, ({ plan }) => ({ listings: plan.writes.listings, next: plan.next }))
    )
    // Blog categories' and tags' descriptions, under the content lock (adr/0075 Ek 2026-11-24)
    const terms = rewriteTermLinksStep(
      transform({ plan }, ({ plan }) => ({ ids: plan.writes.terms, next: plan.next }))
    )
    // Recorded last: a failing record undoes the writes (ids and the revision only)
    recordSystemLayoutStep(
      transform({ layout }, ({ layout }) => ({
        reason: "link_rewrite" as const,
        ...layout.written,
        pages: layout.pages,
      }))
    )
    releaseLocksStep(held)
    // Pages and posts the storefront shows (its menus and lists); a product's text is read fresh
    refreshStorefrontStep(
      transform({ entries, terms, layout }, ({ entries, terms, layout }) => [
        ...(entries + terms > 0 ? ["content" as const] : []),
        ...(layout.changed ? ["layout" as const] : []),
      ])
    )
    return new WorkflowResponse(
      transform(
        { plan, entries, products, listings, terms },
        ({ plan, entries, products, listings, terms }) => ({
          documents: plan.documents,
          rewritten: entries + products + listings + terms,
          changed: plan.changed,
          unresolved: plan.unresolved,
        })
      )
    )
  }
)

/** The rewrite, or with `dry_run` its plan alone (nothing locked, nothing written). */
export async function rewriteContentLinks(
  container: MedusaContainer,
  input: LinkRewriteInput & { dry_run?: boolean }
): Promise<LinkRewriteResult> {
  if (input.dry_run) {
    const plan = await planContentLinks(container, input)
    return {
      documents: plan.documents,
      rewritten:
        plan.writes.entries.length +
        plan.writes.products.length +
        plan.writes.listings.length +
        plan.writes.terms.length,
      changed: plan.changed,
      unresolved: plan.unresolved,
    }
  }
  const { result } = await rewriteContentLinksWorkflow(container).run({
    input: { ...(input.scope ? { scope: input.scope } : {}), hosts: input.hosts ?? [] },
  })
  return result
}

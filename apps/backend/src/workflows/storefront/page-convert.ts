import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { releaseLockStep } from "@medusajs/medusa/core-flows"
import { acquireLocksStep } from "../locking/acquire-locks"
import { logger } from "../../lib/logging"
import { convertPages } from "../../lib/storefront/page-text-convert"
import type { ConversionCount } from "../../lib/storefront/page-text-convert"
import type { PageTextSource } from "../../lib/storefront/page-text"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { CONTENT_LOCK } from "../content/workflows"
import { LAYOUT_LOCK } from "./layout"
import { layoutRow } from "./layout-row"
import { undoSystemLayout, writeSystemLayout } from "./layout-system"
import { pageRoles, storedBody } from "./page-text-source"
import { refreshStorefrontStep } from "./steps/refresh-storefront"

type Container = Pick<MedusaContainer, "resolve">

/** What a conversion did: the draft's counts, and the size of the draft it left. */
export interface PagesConverted extends ConversionCount {
  bytes: number
  /** Whether the live design changed (a new revision). */
  live: boolean
}

const NOTHING: PagesConverted = {
  converted: 0,
  left: 0,
  dropped: 0,
  failed: 0,
  bytes: 0,
  live: false,
}

/**
 * Every content page (never a post, never a deleted one) with its text
 * and roles, in the order they take the design's room (K3): the live
 * pages by when they went live, then the drafts by when they were made.
 */
async function pageSources(container: Container): Promise<PageTextSource[]> {
  const [entries, rolesOf] = await Promise.all([
    container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listContentEntries(
        { kind: "page" },
        { select: ["id", "body", "status", "published_at", "created_at"], take: null }
      ),
    pageRoles(container),
  ])
  const time = (value: Date | string | null | undefined) => (value ? new Date(value).getTime() : 0)
  const live = entries
    .filter((entry) => entry.status === "published")
    .sort((a, b) => time(a.published_at) - time(b.published_at) || a.id.localeCompare(b.id))
  const drafts = entries
    .filter((entry) => entry.status !== "published")
    .sort((a, b) => time(a.created_at) - time(b.created_at) || a.id.localeCompare(b.id))
  return [...live, ...drafts].map((entry) => ({
    id: entry.id,
    body: storedBody(entry.body),
    roles: rolesOf(entry.id),
  }))
}

/**
 * The texts moved into the draft and, when one is live, the live design
 * (a new revision by the system); written only when something moved, so
 * a second run writes nothing. Undone, the design is as it was.
 */
const movePageTextsStep = createStep(
  "storefront-move-page-texts",
  async (_: undefined, { container }) => {
    const row = await layoutRow(container)
    if (!row) {
      // No design yet: every page is drawn from its mirror (K1)
      return new StepResponse(NOTHING, null)
    }
    const sources = await pageSources(container)
    const draft = convertPages(row.draft as Record<string, unknown>, sources)
    const live = row.published
      ? convertPages(row.published as Record<string, unknown>, sources)
      : null
    const draftMoved = draft.document !== row.draft
    const liveMoved = live !== null && live.document !== row.published
    const bytes = Buffer.byteLength(JSON.stringify(draft.document))
    if (!draftMoved && !liveMoved) {
      return new StepResponse({ ...draft.count, bytes, live: false }, null)
    }
    const undo = await writeSystemLayout(container, row, {
      draft: draft.document,
      published: liveMoved ? live.document : null,
    })
    try {
      await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
        kind: "system",
        action: "storefront.pages_converted",
        actor_type: "system",
        resource_type: "storefront_layout",
        resource_id: row.id,
        // Counts only: never a page's text or title
        changes: { converted: draft.count.converted, left: draft.count.left, live: liveMoved },
      })
    } catch (error) {
      // The step did not finish, so the workflow will not undo it: put the design back
      await undoSystemLayout(container, undo)
      throw error
    }
    return new StepResponse({ ...draft.count, bytes, live: undo.made !== null }, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await undoSystemLayout(container, undo)
    }
  }
)

/** The conversion under the design's and the content's locks, the storefront told after. */
export const movePageTextsWorkflow = createWorkflow("storefront-move-page-texts", () => {
  const keys = [LAYOUT_LOCK.key, CONTENT_LOCK.key]
  acquireLocksStep({ ...LAYOUT_LOCK, key: keys })
  const moved = movePageTextsStep()
  releaseLockStep({ key: keys })
  refreshStorefrontStep(["layout"])
  return new WorkflowResponse(moved)
})

/**
 * The content pages' texts moved into the theme editor's design, once
 * (adr/0073 Ek 2026-11-19 (2) K3; run by the `db:migrate` script
 * `migration-scripts/content-pages-into-layout.ts`). Logged with counts only.
 */
export async function movePageTexts(container: MedusaContainer): Promise<PagesConverted> {
  const { result } = await movePageTextsWorkflow(container).run()
  logger.info({
    event: "storefront.pages_converted",
    converted: result.converted,
    left: result.left,
    dropped: result.dropped,
    failed: result.failed,
    bytes: result.bytes,
  })
  return result
}

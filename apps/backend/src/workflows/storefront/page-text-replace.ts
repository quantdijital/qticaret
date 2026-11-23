import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { acquireLocksStep } from "../locking/acquire-locks"
import { docStats } from "../../lib/content"
import type { ContentDoc } from "../../lib/content"
import { readStoredLayout } from "../../lib/storefront/layout"
import { hasPageText, pageMirror } from "../../lib/storefront/page-text"
import { withPageText } from "../../lib/storefront/page-text-stored"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { attachMediaStep } from "../media/steps/attach-media"
import { assertCards, bodyOf, mediaOf } from "../content/rules"
import { CONTENT_LOCK, CONTENT_SAVED } from "../content/workflows"
import { LAYOUT_LOCK } from "./layout"
import { layoutRow } from "./layout-row"
import {
  recordSystemLayoutStep,
  systemWriteOf,
  undoSystemLayout,
  writeSystemLayout,
} from "./layout-system"
import type { SystemUndo } from "./layout-system"
import { writeMirrorsStep } from "./page-mirror"
import { pageRoles } from "./page-text-source"
import { refreshStorefrontStep } from "./steps/refresh-storefront"

export interface ReplacePageTextInput {
  /** The content page (`cnt_…`, `kind: page`). */
  page_id: string
  /** The page's new text, as the content document schema takes it. */
  doc: unknown
}

/**
 * The text checked as a content save checks a page's (adr/0019): the
 * document's schema and `{belirteç}`s, cards whose records exist, images
 * the shop uploaded. The page must be one of the shop's (never a post).
 */
const checkPageTextStep = createStep(
  "storefront-page-text-check",
  async (input: ReplacePageTextInput, { container }) => {
    const [page] = await container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listContentEntries({ id: input.page_id, kind: "page" }, { select: ["id"], take: 1 })
    if (!page) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
    }
    const doc = bodyOf(input.doc)
    await assertCards(container, doc)
    const media = await mediaOf(
      container,
      docStats(doc).images.map((image) => image.src),
      "body"
    )
    return new StepResponse({ page_id: page.id, doc, media })
  }
)

/**
 * The text written into the design (K4): the page's entry in the draft
 * and in the live design (a new revision, by the system), or an entry made
 * where there is room; the page's mirror as the live design then holds it
 * (else the text itself). Undone, the design is as it was.
 */
const replaceLayoutTextStep = createStep(
  "storefront-page-text-layout",
  async (input: { page_id: string; doc: ContentDoc }, { container }) => {
    const row = await layoutRow(container)
    const roles = (await pageRoles(container))(input.page_id)
    const source = { id: input.page_id, body: input.doc, roles }
    const draft = row ? withPageText(row.draft as Record<string, unknown>, source) : null
    // Each written where it changes: the live design may hold an older text than the draft
    const live = row?.published
      ? withPageText(row.published as Record<string, unknown>, source)
      : null
    let undo: SystemUndo | null = null
    if (row && (draft || live)) {
      undo = await writeSystemLayout(container, row, {
        draft: draft ?? (row.draft as Record<string, unknown>),
        published: live,
      })
    }
    let mirror: ContentDoc = input.doc
    // The mirror is the live text: the design as now written, else as it stood (unchanged)
    const liveNow = live ?? (row?.published as Record<string, unknown> | null | undefined) ?? null
    const shown = liveNow
      ? readStoredLayout(liveNow).pages.find((p) => p.page_id === input.page_id)
      : null
    if (shown && hasPageText(shown.sections)) {
      mirror = pageMirror(shown.sections)
    }
    return new StepResponse(
      {
        mirror: [{ id: input.page_id, doc: mirror }],
        live: (undo?.made ?? null) !== null,
        written: systemWriteOf(undo),
      },
      undo
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await undoSystemLayout(container, undo)
    }
  }
)

/**
 * A content page's text replaced by the system (adr/0073 Ek 2026-11-19 (2)
 * K4: an import from the old site, the shop profile): checked as a page's
 * text, written into its text section in the draft and the live design
 * (or an entry made for it where there is room), then its `body` mirror.
 * The page's title, address and status are `saveContentWorkflow`'s, which
 * takes no page text. Under the design's and the content's locks; any
 * step failing leaves the design and the page as they were.
 */
export const replacePageTextWorkflow = createWorkflow(
  "storefront-page-text-replace",
  (input: ReplacePageTextInput) => {
    const keys = [LAYOUT_LOCK.key, CONTENT_LOCK.key]
    acquireLocksStep({ ...LAYOUT_LOCK, key: keys })
    const checked = checkPageTextStep(input)
    const layout = replaceLayoutTextStep(
      transform({ checked }, ({ checked }) => ({ page_id: checked.page_id, doc: checked.doc }))
    )
    const mirrored = writeMirrorsStep(transform({ layout }, ({ layout }) => layout.mirror))
    attachMediaStep(transform({ checked }, ({ checked }) => ({ link: checked.media, record: [] })))
    // Recorded last: a failing record undoes the writes (ids and the revision only)
    recordSystemLayoutStep(
      transform({ checked, layout }, ({ checked, layout }) => ({
        reason: "import" as const,
        ...layout.written,
        pages: [checked.page_id],
      }))
    )
    emitEventStep({ eventName: CONTENT_SAVED, data: mirrored }).config({
      name: "storefront-page-text-content-saved",
    })
    releaseLockStep({ key: keys })
    // The live design changed in place: the storefront forgets it as on a publication
    refreshStorefrontStep(
      transform({ mirrored, layout }, ({ mirrored, layout }) => [
        ...(mirrored.length > 0 ? ["content" as const] : []),
        ...(layout.live ? ["layout" as const] : []),
      ])
    )
    return new WorkflowResponse(
      transform({ checked, mirrored, layout }, ({ checked, mirrored, layout }) => ({
        page_id: checked.page_id,
        mirrored: mirrored.length > 0,
        live: layout.live,
      }))
    )
  }
)

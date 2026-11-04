import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import type { ContentDoc } from "../../lib/content"
import { ConflictError, ValidationError } from "../../lib/errors"
import { checkLegalDoc, hasStarterNote, starterOf } from "../../lib/legal"
import type { LegalKind } from "../../lib/legal"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"

const legal = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<LegalModuleService>(LEGAL_MODULE)

/** The kind's lock: one save or publish at a time, so two never open two drafts. */
const lockKeyOf = (kind: LegalKind) => `legal:${kind}`

export interface SaveDraftInput {
  kind: LegalKind
  title: string
  body: ContentDoc
  actor_id: string | null
}

function assertTokens(kind: LegalKind, body: ContentDoc): void {
  const { unknownTokens, isMalformed } = checkLegalDoc(body, kind)
  if (isMalformed || unknownTokens.length > 0) {
    throw new ValidationError("legal.token_invalid", { field: "body" })
  }
}

/** The fingerprint of what was published: the body as stored, hashed. */
export const bodyHashOf = (body: unknown): string =>
  createHash("sha256").update(JSON.stringify(body)).digest("hex")

interface DraftUndo {
  id: string
  /** The draft's text before this save; null when the save opened it. */
  before: { title: string; body: Record<string, unknown> } | null
}

/** The kind's draft saved: the one there is changed, or a new one numbered after the last. */
const saveDraftStep = createStep(
  "legal-save-draft",
  async (input: SaveDraftInput, { container }) => {
    assertTokens(input.kind, input.body)
    const service = legal(container)
    const current = await service.versionOf(input.kind, "draft")
    if (current) {
      const updated = await service.updateLegalDocuments({
        id: current.id,
        title: input.title,
        body: input.body as unknown as Record<string, unknown>,
      })
      const undo: DraftUndo = {
        id: current.id,
        before: { title: current.title, body: current.body },
      }
      return new StepResponse(updated, undo)
    }
    const created = await service.createLegalDocuments({
      kind: input.kind,
      version: await service.nextVersion(input.kind),
      status: "draft",
      title: input.title,
      body: input.body as unknown as Record<string, unknown>,
      created_by: input.actor_id,
    })
    const undo: DraftUndo = { id: created.id, before: null }
    return new StepResponse(created, undo)
  },
  async (undo: DraftUndo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service = legal(container)
    if (undo.before) {
      await service.updateLegalDocuments({ id: undo.id, ...undo.before })
    } else {
      await service.deleteLegalDocuments([undo.id])
    }
  }
)

/**
 * The draft published (adr/0041 §1): checked again, fixed by its hash, and
 * the version published before it retired. Undone, both go back. A draft
 * still carrying its starter's note (have a lawyer check it, then delete
 * this) is kept a draft: a shopper never reads the platform's note.
 */
const publishDraftStep = createStep(
  "legal-publish-draft",
  async (input: { kind: LegalKind; actor_id: string | null }, { container }) => {
    const service = legal(container)
    const draft = await service.versionOf(input.kind, "draft")
    if (!draft) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.draft_missing")
    }
    const body = draft.body as unknown as ContentDoc
    assertTokens(input.kind, body)
    if (hasStarterNote(body)) {
      throw new ValidationError("legal.draft_note_present", { field: "body" })
    }
    const previous = await service.versionOf(input.kind, "published")
    const published = await service.publishDraft({
      draft_id: draft.id,
      previous_id: previous?.id ?? null,
      body_hash: bodyHashOf(draft.body),
      by: input.actor_id,
    })
    return new StepResponse(published, { draftId: draft.id, previousId: previous?.id ?? null })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = legal(container)
    await service.updateLegalDocuments({
      id: undo.draftId,
      status: "draft",
      body_hash: null,
      published_at: null,
      published_by: null,
    })
    if (undo.previousId) {
      await service.updateLegalDocuments({ id: undo.previousId, status: "published" })
    }
  }
)

/** Where a draft started again takes its text: the platform's starter, or the text in force. */
export const DRAFT_RESET_SOURCES = ["starter", "published"] as const
export type DraftResetSource = (typeof DRAFT_RESET_SOURCES)[number]

/**
 * The text a draft started again holds: the kind's starter as `GET starter`
 * gives it (its tokens, and its draft note, so it is not published before
 * a lawyer has read it), or a copy of the published text; 409 when nothing
 * is published to copy.
 */
export function resetTextOf(
  kind: LegalKind,
  source: DraftResetSource,
  published: { title: string; body: unknown } | null
): { title: string; body: ContentDoc } {
  if (source === "starter") {
    return starterOf(kind)
  }
  if (!published) {
    throw new ConflictError("legal.nothing_published")
  }
  return { title: published.title, body: published.body as ContentDoc }
}

export interface ResetDraftInput {
  kind: LegalKind
  source: DraftResetSource
  actor_id: string | null
}

/** Reads only, so nothing to undo: the save step after it writes the draft and undoes itself. */
const resetTextStep = createStep(
  "legal-reset-text",
  async (input: ResetDraftInput, { container }) => {
    const published =
      input.source === "published"
        ? await legal(container).versionOf(input.kind, "published")
        : null
    return new StepResponse(resetTextOf(input.kind, input.source, published))
  }
)

/** A draft dropped: it was never published, so nothing refers to it. */
const discardDraftStep = createStep(
  "legal-discard-draft",
  async (input: { kind: LegalKind }, { container }) => {
    const service = legal(container)
    const draft = await service.versionOf(input.kind, "draft")
    if (!draft) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.draft_missing")
    }
    await service.softDeleteLegalDocuments([draft.id])
    return new StepResponse({ id: draft.id }, draft.id)
  },
  async (id, { container }) => {
    if (id) {
      await legal(container).restoreLegalDocuments([id])
    }
  }
)

/** A legal text's draft saved (F13.1), its tokens checked. */
export const saveLegalDraftWorkflow = createWorkflow(
  "legal-save-draft",
  (input: SaveDraftInput) => {
    const key = transform({ input }, ({ input }) => lockKeyOf(input.kind))
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const draft = saveDraftStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(draft)
  }
)

/**
 * A legal text's draft published, the version before it retired (F13.1);
 * the storefront shows it at once (adr/0048 ek 2026-11-03).
 */
export const publishLegalDraftWorkflow = createWorkflow(
  "legal-publish-draft",
  (input: { kind: LegalKind; actor_id: string | null }) => {
    const key = transform({ input }, ({ input }) => lockKeyOf(input.kind))
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const published = publishDraftStep(input)
    releaseLockStep({ key })
    refreshStorefrontStep(["legal"])
    return new WorkflowResponse(published)
  }
)

/** A legal text's draft dropped (F13.1). */
export const discardLegalDraftWorkflow = createWorkflow(
  "legal-discard-draft",
  (input: { kind: LegalKind }) => {
    const key = transform({ input }, ({ input }) => lockKeyOf(input.kind))
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const dropped = discardDraftStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(dropped)
  }
)

/**
 * A legal text's draft started again (the owner, 2026-11-04): from the
 * platform's starter or a copy of the published text, in place of the
 * draft there is or as a new one. The published text stays in force.
 */
export const resetLegalDraftWorkflow = createWorkflow(
  "legal-reset-draft",
  (input: ResetDraftInput) => {
    const key = transform({ input }, ({ input }) => lockKeyOf(input.kind))
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const text = resetTextStep(input)
    const save = transform({ input, text }, ({ input, text }) => ({
      kind: input.kind,
      title: text.title,
      body: text.body,
      actor_id: input.actor_id,
    }))
    const draft = saveDraftStep(save)
    releaseLockStep({ key })
    return new WorkflowResponse(draft)
  }
)

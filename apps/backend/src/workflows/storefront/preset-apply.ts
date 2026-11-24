import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { recordAuditEntryStep } from "../audit-log/steps/record-audit-entry"
import { registerMediaStep } from "../media/steps/register-media"
import { askForVersions } from "../media/workflows"
import { autoSaveDraftStep } from "./design-steps"
import { LAYOUT_LOCK, saveDraftSteps } from "./layout"
import {
  planPresetImagesStep,
  recordPresetImagesStep,
  storePresetImagesStep,
} from "./preset-images"
import { openPresetPagesStep } from "./preset-pages"
import { composePresetDraftStep, loadPresetStep, resolvePresetStep } from "./preset-steps"
import type { ApplyPresetInput } from "./preset-steps"

export { GENERAL_PACK } from "./preset-steps"
export type { ApplyPresetInput } from "./preset-steps"

/** A pack's preset images, from the ledger's read to its write: one apply at a time. */
export const presetLockKey = (pack: string): string => `storefront-preset:${pack}`
// Uploads run under it: longer than the design's
const PRESET_LOCK = { timeout: 30, ttl: 120 }

/**
 * A ready-made look applied to the theme editor's draft (adr/0063 §4):
 * the preset read and its theme checked; every `$handle` and `$href`
 * resolved for this shop and the result held to the editor's schema; the
 * images the design still shows brought into the media library once
 * (recorded by path and digest, uploaded again only if the shop deleted
 * them or the preset changed them); the draft written with the editor's
 * checks; nothing goes live: the owner previews and publishes. Applying
 * the same preset again writes the same draft and uploads nothing.
 *
 * What the shop has no record for is left out and named in `skipped`,
 * never stood in for. A content page the preset lays out and the shop has
 * not made is opened as a draft (adr/0073 Ek 2026-11-19 (2) K6, named in
 * `made_pages`; its address another record's: left out, `skipped`), and a
 * page the preset lays out keeps the shop's own text (`texts_kept`). A
 * header or footer the preset leaves empty keeps the shop's sections, and
 * every content page the preset does not lay out keeps the shop's layout,
 * named in `kept`. The draft it replaces is kept first as
 * a saved look (adr/0064 Ek 2026-11-17 §1: `save_as` names it, else an
 * automatic one unless nothing new would be kept), named in `auto_saved`.
 * Any step failing undoes the uploads, their records, that save, the
 * pages opened and the draft. Two locks, always in this order: the pack's
 * (`presetLockKey`) from the ledger's read to the draft's write, so two
 * applies never both upload an image the shop deleted and one of them
 * leaves it unrecorded in the library; the
 * design's (`LAYOUT_LOCK`) from reading the shop's own settings it keeps
 * (trust badges, swatches, "Az kaldı") to writing the draft, so an
 * editor's save in between is not undone. Taken here, not by
 * `saveLayoutDraftWorkflow` as a step: a lock in a nested workflow is skipped.
 *
 * Audit: an apply through the panel is recorded once by the admin
 * mutation log (`resources/storefront-layout.ts`, with the request's
 * status and address); one with no staff member (the provisioner's
 * script) is recorded here.
 */
export const applyPresetWorkflow = createWorkflow(
  "storefront-preset-apply",
  (input: ApplyPresetInput) => {
    const preset = loadPresetStep(input)
    const resolution = resolvePresetStep(preset)
    const presetLock = transform({ preset }, ({ preset }) => ({
      key: presetLockKey(preset.pack),
      ...PRESET_LOCK,
    }))
    acquireLockStep(presetLock).config({ name: "storefront-preset-lock-images" })
    const plan = planPresetImagesStep(
      transform({ preset, resolution }, ({ preset, resolution }) => ({
        pack: preset.pack,
        code: preset.code,
        dir: preset.dir,
        images: resolution.images,
      }))
    )
    const fileIds = storePresetImagesStep(
      transform({ preset, plan }, ({ preset, plan }) => ({ dir: preset.dir, upload: plan.upload }))
    )
    const assets = registerMediaStep(
      transform({ input, fileIds }, ({ input, fileIds }) => ({
        file_ids: fileIds,
        library: true,
        uploaded_by: input.actor,
      }))
    )
    askForVersions(assets)
    const recorded = recordPresetImagesStep(
      transform({ preset, plan, assets }, ({ preset, plan, assets }) => ({
        pack: preset.pack,
        version: preset.pack_version,
        plan,
        assets,
      }))
    )
    acquireLockStep(LAYOUT_LOCK)
    // The draft kept before the look replaces it (adr/0064 Ek 2026-11-17 §1.2)
    const autoSaved = autoSaveDraftStep(
      transform({ input }, ({ input }) => ({
        actor: input.actor,
        save_as: input.save_as ?? null,
        reason: "preset_apply" as const,
      }))
    )
    // The pages it lays out that the shop has not made, opened as drafts (adr/0073 Ek 2026-11-19 (2) K6)
    const opened = openPresetPagesStep(
      transform({ resolution }, ({ resolution }) => resolution.open_pages)
    )
    const draft = composePresetDraftStep(
      transform(
        { preset, resolution, recorded, opened },
        ({ preset, resolution, recorded, opened }) => ({
          preset,
          resolution,
          images: recorded.images,
          opened,
        })
      )
    )
    const saved = saveDraftSteps(
      transform({ draft }, ({ draft }) => draft.document),
      // The shop's page text kept is its own, not the apply's new work (K2, K6)
      transform({ draft }, ({ draft }) => draft.carried)
    )
    releaseLockStep({ key: LAYOUT_LOCK.key })
    // Held until the draft names the images: an apply waiting on it then finds them recorded
    releaseLockStep(
      transform({ preset }, ({ preset }) => ({ key: presetLockKey(preset.pack) }))
    ).config({ name: "storefront-preset-unlock-images" })
    const entry = transform(
      { input, preset, draft, recorded, autoSaved },
      ({ input, preset, draft, recorded, autoSaved }) => ({
        actor: input.actor,
        audit: {
          action: "storefront_layout.preset_applied",
          actor_type: "system",
          actor_id: null,
          resource_type: "storefront_layout",
          resource_id: `${preset.pack}/${preset.code}`,
          // Reached only when every step before it succeeded
          outcome: 200,
          changes: {
            pack: preset.pack,
            code: preset.code,
            version: preset.version,
            skipped: draft.skipped.length,
            dropped: draft.dropped.length,
            kept: draft.kept.length,
            made_pages: draft.made_pages.map((page) => page.page_id),
            texts_kept: draft.texts_kept.map((page) => page.ref),
            images_added: recorded.added,
            auto_saved: autoSaved?.id ?? null,
          },
        },
      })
    )
    when("storefront-preset-audit-system", entry, ({ actor }) => actor === null).then(() => {
      recordAuditEntryStep(transform({ entry }, ({ entry }) => entry.audit))
    })
    // Through the panel the admin log records the apply; the pages it opened and the texts it
    // kept are the workflow's to say (security review S9): ids and references only
    const pagesEntry = transform({ input, preset, draft }, ({ input, preset, draft }) => ({
      actor: input.actor,
      touched: draft.made_pages.length + draft.texts_kept.length,
      audit: {
        kind: "mutation" as const,
        action: "storefront_layout.preset_pages",
        actor_type: "user",
        actor_id: input.actor,
        resource_type: "storefront_layout",
        resource_id: `${preset.pack}/${preset.code}`,
        outcome: 200,
        changes: {
          made_pages: draft.made_pages.map((page) => page.page_id),
          texts_kept: draft.texts_kept.map((page) => page.ref),
        },
      },
    }))
    when(
      "storefront-preset-audit-pages",
      pagesEntry,
      ({ actor, touched }) => actor !== null && touched > 0
    ).then(() => {
      recordAuditEntryStep(transform({ pagesEntry }, ({ pagesEntry }) => pagesEntry.audit)).config({
        name: "storefront-preset-audit-pages-record",
      })
    })
    return new WorkflowResponse(
      transform(
        { preset, draft, recorded, autoSaved, saved },
        ({ preset, draft, recorded, autoSaved, saved }) => ({
          pack: preset.pack,
          preset: preset.code,
          version: preset.version,
          skipped: draft.skipped,
          dropped: draft.dropped,
          /**
           * The shop's header or footer sections kept where the preset leaves the
           * group empty (`footer.<id>`), its content pages' layouts the preset
           * does not replace (`pages.<page id>`).
           */
          kept: draft.kept,
          images: { added: recorded.added, kept: recorded.kept },
          // Demo records come with work item 2.4 (adr/0063 §5)
          demo: { added: 0, kept: 0 },
          /**
           * The pages the look laid out that the shop had not made, opened as
           * drafts (adr/0073 Ek 2026-11-19 (2) K6): `{ ref, page_id, name }`.
           */
          made_pages: draft.made_pages,
          /** The pages the look laid out whose own text the shop kept (K6): `{ ref, name }`. */
          texts_kept: draft.texts_kept,
          /** The draft kept before (adr/0064 Ek 2026-11-17); null: nothing new to keep. */
          auto_saved: autoSaved,
          /** The shop's content page layouts left out for pages deleted since (adr/0073 §1). */
          dropped_pages: saved.dropped_pages,
        })
      )
    )
  }
)

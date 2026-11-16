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
 * never stood in for; a header or footer the preset leaves empty keeps the
 * shop's sections, named in `kept`. Any step failing undoes the uploads, their records
 * and the draft. Two locks, always in this order: the pack's
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
    const draft = composePresetDraftStep(
      transform({ preset, resolution, recorded }, ({ preset, resolution, recorded }) => ({
        preset,
        resolution,
        images: recorded.images,
      }))
    )
    saveDraftSteps(transform({ draft }, ({ draft }) => draft.document))
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
            images_added: recorded.added,
            auto_saved: autoSaved?.id ?? null,
          },
        },
      })
    )
    when("storefront-preset-audit-system", entry, ({ actor }) => actor === null).then(() => {
      recordAuditEntryStep(transform({ entry }, ({ entry }) => entry.audit))
    })
    return new WorkflowResponse(
      transform(
        { preset, draft, recorded, autoSaved },
        ({ preset, draft, recorded, autoSaved }) => ({
          pack: preset.pack,
          preset: preset.code,
          version: preset.version,
          skipped: draft.skipped,
          dropped: draft.dropped,
          /** The shop's header or footer sections kept where the preset leaves the group empty. */
          kept: draft.kept,
          images: { added: recorded.added, kept: recorded.kept },
          // Demo records come with work item 2.4 (adr/0063 §5)
          demo: { added: 0, kept: 0 },
          /** The draft kept before (adr/0064 Ek 2026-11-17); null: nothing new to keep. */
          auto_saved: autoSaved,
        })
      )
    )
  }
)

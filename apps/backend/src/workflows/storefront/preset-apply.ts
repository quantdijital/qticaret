import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { recordAuditEntryStep } from "../audit-log/steps/record-audit-entry"
import { registerMediaStep } from "../media/steps/register-media"
import { askForVersions } from "../media/workflows"
import { saveLayoutDraftWorkflow } from "./layout"
import {
  planPresetImagesStep,
  recordPresetImagesStep,
  storePresetImagesStep,
} from "./preset-images"
import { composePresetDraftStep, loadPresetStep, resolvePresetStep } from "./preset-steps"
import type { ApplyPresetInput } from "./preset-steps"

export { GENERAL_PACK } from "./preset-steps"
export type { ApplyPresetInput } from "./preset-steps"

/**
 * A ready-made look applied to the theme editor's draft (adr/0063 §4):
 * the preset read and its theme checked; every `$handle` and `$href`
 * resolved for this shop and the result held to the editor's schema; the
 * images the design still shows brought into the media library once
 * (recorded by path, uploaded again only if the shop deleted them); the
 * draft written by `saveLayoutDraftWorkflow` (its checks, its lock, the
 * images kept from the sweep); one audit entry. Nothing goes live: the
 * owner previews and publishes. Applying the same preset again writes the
 * same draft and uploads nothing.
 *
 * What the shop has no record for is left out and named in `skipped`,
 * never stood in for. Any step failing undoes the uploads, their records
 * and the draft. This workflow takes no lock of its own: the draft's
 * save takes the design's, and the ledger's unique key settles two
 * applies uploading at once (the second fails and undoes its uploads).
 */
export const applyPresetWorkflow = createWorkflow(
  "storefront-preset-apply",
  (input: ApplyPresetInput) => {
    const preset = loadPresetStep(input)
    const resolution = resolvePresetStep(preset)
    const plan = planPresetImagesStep(
      transform({ preset, resolution }, ({ preset, resolution }) => ({
        pack: preset.pack,
        code: preset.code,
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
        code: preset.code,
        version: preset.pack_version,
        plan,
        assets,
      }))
    )
    const draft = composePresetDraftStep(
      transform({ preset, resolution, recorded }, ({ preset, resolution, recorded }) => ({
        preset,
        resolution,
        images: recorded.images,
      }))
    )
    saveLayoutDraftWorkflow.runAsStep({
      input: transform({ draft }, ({ draft }) => draft.document),
    })
    recordAuditEntryStep(
      transform({ input, preset, draft, recorded }, ({ input, preset, draft, recorded }) => ({
        kind: "mutation" as const,
        action: "storefront_layout.preset_applied",
        actor_type: input.actor ? "user" : "system",
        actor_id: input.actor,
        resource_type: "storefront_layout",
        resource_id: `${preset.pack}/${preset.code}`,
        outcome: 200,
        changes: {
          pack: preset.pack,
          code: preset.code,
          version: preset.version,
          skipped: draft.skipped.length,
          dropped: draft.dropped.length,
          images_added: recorded.added,
        },
      }))
    )
    return new WorkflowResponse(
      transform({ preset, draft, recorded }, ({ preset, draft, recorded }) => ({
        pack: preset.pack,
        preset: preset.code,
        version: preset.version,
        skipped: draft.skipped,
        dropped: draft.dropped,
        images: { added: recorded.added, kept: recorded.kept },
        // Demo records come with work item 2.4 (adr/0063 §5)
        demo: { added: 0, kept: 0 },
      }))
    )
  }
)

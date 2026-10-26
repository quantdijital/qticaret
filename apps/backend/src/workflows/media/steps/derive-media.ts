import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { derivativeName, deriveImages } from "../../../lib/media"
import type { Derivative } from "../../../lib/media"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles, storePublicFile } from "../files"
import type { StoredFile } from "../files"
import type { DeriveTarget } from "./plan-product-media"

const MIME_TYPES = { webp: "image/webp", avif: "image/avif", jpeg: "image/jpeg" } as const

/** Where an image's versions are, as the Store API and the SEO payload read them. */
export interface MediaDerivatives {
  srcset: Record<"webp" | "avif", { width: number; url: string }[]>
  og: { url: string; width: number; height: number } | null
}

interface Previous {
  id: string
  derivatives: Record<string, unknown> | null
  derivative_file_ids: string[] | null
  derived_for: string | null
  derived_at: Date | null
}

function describe(stored: { derivative: Derivative; file: StoredFile }[]): MediaDerivatives {
  const described: MediaDerivatives = { srcset: { webp: [], avif: [] }, og: null }
  for (const { derivative, file } of stored) {
    if (derivative.kind === "og") {
      described.og = { url: file.url, width: derivative.width, height: derivative.height }
    } else if (derivative.format !== "jpeg") {
      described.srcset[derivative.format].push({ width: derivative.width, url: file.url })
    }
  }
  return described
}

/** One image's versions, stored; on a failure the ones already stored are removed again. */
async function storeVersions(
  container: MedusaContainer,
  target: DeriveTarget
): Promise<{ derivative: Derivative; file: StoredFile }[]> {
  const made: { derivative: Derivative; file: StoredFile }[] = []
  try {
    const master = await container.resolve(Modules.FILE).getAsBuffer(target.fileId)
    for (const derivative of await deriveImages(master)) {
      const file = await storePublicFile(
        container,
        derivativeName(target.handle, target.position, derivative),
        MIME_TYPES[derivative.format],
        derivative.buffer
      )
      made.push({ derivative, file })
    }
    return made
  } catch (error) {
    await removeFiles(
      container,
      made.map(({ file }) => file.id)
    )
    throw error
  }
}

/**
 * Makes each image's versions from its master and stores them public under
 * names of the product's slug (adr/0016). An image that fails is logged and
 * left for the nightly sweep; the others go on. The versions they replace
 * are handed on for removal once the workflow has done everything else.
 */
export const deriveMediaStep = createStep(
  "media-derive",
  async (targets: DeriveTarget[], { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const created: string[] = []
    const previous: Previous[] = []
    const obsolete: string[] = []
    for (const target of targets) {
      const [asset] = await media.listMediaAssets({ id: target.assetId }, { take: 1 })
      if (!asset) {
        continue
      }
      let made: { derivative: Derivative; file: StoredFile }[]
      try {
        made = await storeVersions(container, target)
      } catch (error) {
        logger.warn({ event: "media.derive_failed", assetId: asset.id, err: errorSummary(error) })
        continue
      }
      created.push(...made.map(({ file }) => file.id))
      previous.push({
        id: asset.id,
        derivatives: asset.derivatives,
        derivative_file_ids: asset.derivative_file_ids,
        derived_for: asset.derived_for,
        derived_at: asset.derived_at,
      })
      await media.updateMediaAssets({
        id: asset.id,
        derivatives: describe(made) as unknown as Record<string, unknown>,
        derivative_file_ids: made.map(({ file }) => file.id),
        derived_for: target.derivedFor,
        derived_at: new Date(),
      })
      obsolete.push(...(asset.derivative_file_ids ?? []))
    }
    return new StepResponse({ obsolete }, { created, previous })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await removeFiles(container, undo.created)
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    for (const row of undo.previous) {
      await media.updateMediaAssets(row)
    }
  }
)

/** The replaced versions' files; last in the workflow, so nothing needs them back. */
export const removeMediaFilesStep = createStep(
  "media-remove-files",
  async (ids: string[], { container }) => {
    await removeFiles(container, ids)
    return new StepResponse(undefined)
  }
)

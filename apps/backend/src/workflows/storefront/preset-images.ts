import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename, resolve, sep } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { packItemKey } from "@qticaret/sector-packs"
import { ValidationError } from "../../lib/errors"
import { prepareImage } from "../../lib/media"
import { assertStorageFits } from "../../lib/plan-limits"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import type { MediaAssetRecord } from "../../modules/media/service"
import { SECTOR_PACKS_MODULE } from "../../modules/sector-packs"
import type SectorPacksModuleService from "../../modules/sector-packs/service"
import { removeFiles, storePublicFile } from "../media/files"

/**
 * A preset's images in the shop's media library (adr/0063 §4): each
 * offered once, recorded by its path and its bytes' digest
 * (`sector_pack_item`, kind `preset_image`), so applying the preset again
 * finds the image it uploaded before, and a new version that changed the
 * picture under the same name uploads the new one. One still in the
 * library is never uploaded again; one the shop deleted since is uploaded
 * anew and the record names the new one.
 * Every file goes through the upload line (its type read from its bytes,
 * cleaned, the package's storage counted); a preset is not trusted input.
 */

export interface PresetImagesPlan {
  /** Path → the address of the image uploaded before and still in the library. */
  known: Record<string, string>
  /** Paths to upload now. */
  upload: string[]
  /** Path → the record of an image uploaded before and deleted since. */
  stale: Record<string, string>
  /** Path → its record's key, its digest in it (`packItemKey.presetImage`). */
  keys: Record<string, string>
}

interface PlanInput {
  pack: string
  code: string
  /** The preset's folder: each image's digest is read from its bytes. */
  dir: string
  images: string[]
}

const ledger = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)

/** A preset's file read from its folder, never from outside it (the loader checked the path). */
async function presetFile(dir: string, path: string): Promise<Buffer> {
  const root = resolve(dir)
  const file = resolve(root, path)
  if (!file.startsWith(`${root}${sep}`)) {
    throw new ValidationError("storefront_preset.invalid", { field: "images" })
  }
  return await readFile(file)
}

/** Which of the images the design shows were uploaded before and are still there. Reads only. */
export const planPresetImagesStep = createStep(
  "storefront-preset-plan-images",
  async (input: PlanInput, { container }) => {
    const plan: PresetImagesPlan = { known: {}, upload: [], stale: {}, keys: {} }
    if (input.images.length === 0) {
      return new StepResponse(plan)
    }
    for (const path of input.images) {
      const digest = createHash("sha256")
        .update(await presetFile(input.dir, path))
        .digest("hex")
      plan.keys[path] = packItemKey.presetImage(input.code, path, digest)
    }
    const rows = await ledger(container).listSectorPackItems(
      { pack: input.pack, key: Object.values(plan.keys) },
      { select: ["id", "key", "record_id"], take: null }
    )
    const ids = rows.flatMap((row) => (row.record_id ? [row.record_id] : []))
    const assets =
      ids.length > 0
        ? await container
            .resolve<MediaModuleService>(MEDIA_MODULE)
            .listMediaAssets({ id: ids }, { select: ["id", "url"], take: null })
        : []
    const urls = new Map(assets.map((asset) => [asset.id, asset.url]))
    for (const path of input.images) {
      const row = rows.find((each) => each.key === plan.keys[path])
      const url = row?.record_id ? urls.get(row.record_id) : undefined
      if (url) {
        plan.known[path] = url
        continue
      }
      plan.upload.push(path)
      if (row) {
        plan.stale[path] = row.id
      }
    }
    return new StepResponse(plan)
  }
)

/**
 * The images to upload, cleaned and stored as an upload is; their storage
 * keys, in the order asked. A later step failing removes the files.
 */
export const storePresetImagesStep = createStep(
  "storefront-preset-store-images",
  async (input: { dir: string; upload: string[] }, { container }) => {
    const prepared = []
    for (const path of input.upload) {
      prepared.push(await prepareImage(await presetFile(input.dir, path), basename(path), "images"))
    }
    await assertStorageFits(
      container,
      prepared.reduce((sum, image) => sum + image.buffer.length, 0)
    )
    const fileIds: string[] = []
    try {
      for (const image of prepared) {
        const file = await storePublicFile(container, image.filename, image.mimeType, image.buffer)
        fileIds.push(file.id)
      }
    } catch (error) {
      // A step that throws is not compensated: what it stored goes here
      await removeFiles(container, fileIds)
      throw error
    }
    return new StepResponse(fileIds, fileIds)
  },
  async (fileIds, { container }) => {
    if (fileIds?.length) {
      await removeFiles(container, fileIds)
    }
  }
)

interface RecordInput {
  pack: string
  version: number
  plan: PresetImagesPlan
  assets: MediaAssetRecord[]
}

interface RecordUndo {
  created: string[]
  /** Records that named an image deleted since, as they were. */
  renamed: { id: string; record_id: string | null }[]
}

/**
 * The uploaded images recorded by their path; every image's address the
 * design is given. Undone, the records are as they were.
 */
export const recordPresetImagesStep = createStep(
  "storefront-preset-record-images",
  async (input: RecordInput, { container }) => {
    const service = ledger(container)
    const undo: RecordUndo = { created: [], renamed: [] }
    const images: Record<string, string> = { ...input.plan.known }
    try {
      for (const [index, path] of input.plan.upload.entries()) {
        const asset = input.assets[index]
        const key = input.plan.keys[path]
        if (!asset || !key) {
          throw new Error(`preset image ${path} was not registered`)
        }
        images[path] = asset.url
        const stale = input.plan.stale[path]
        if (stale) {
          const [before] = await service.listSectorPackItems({ id: stale }, { take: 1 })
          await service.updateSectorPackItems({ id: stale, record_id: asset.id })
          undo.renamed.push({ id: stale, record_id: before?.record_id ?? null })
          continue
        }
        const made = await service.createSectorPackItems({
          pack: input.pack,
          key,
          kind: "preset_image",
          outcome: "added",
          version: input.version,
          record_id: asset.id,
        })
        undo.created.push(made.id)
      }
    } catch (error) {
      await putBack(service, undo)
      throw error
    }
    return new StepResponse(
      { images, added: input.plan.upload.length, kept: Object.keys(input.plan.known).length },
      undo
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await putBack(ledger(container), undo)
    }
  }
)

async function putBack(service: SectorPacksModuleService, undo: RecordUndo): Promise<void> {
  if (undo.created.length > 0) {
    await service.deleteSectorPackItems(undo.created)
  }
  for (const row of undo.renamed) {
    await service.updateSectorPackItems(row)
  }
}

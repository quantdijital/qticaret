import { readFile } from "node:fs/promises"
import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { prepareImage } from "../../lib/media"
import type { MediaAssetRecord } from "../../modules/media/service"
import { storePublicFile } from "../../workflows/media/files"
import { registerMediaWorkflow } from "../../workflows/media/workflows"

/**
 * A picture from the data file's `images` folder, brought in as an upload
 * is (F3.3): checked by its bytes and cleaned (`prepareImage`), stored
 * under `name` and recorded as a media asset. Every call stores a file of
 * its own, so one photo can serve several products (an asset belongs to
 * one product, adr/0016).
 */
export async function uploadDemoImage(
  container: MedusaContainer,
  source: { dir: string; file: string },
  name: string,
  library: boolean
): Promise<MediaAssetRecord> {
  const bytes = await readFile(path.join(source.dir, path.basename(source.file)))
  const image = await prepareImage(bytes, `${name}${path.extname(source.file)}`, "image")
  const stored = await storePublicFile(container, image.filename, image.mimeType, image.buffer)
  const { result } = await registerMediaWorkflow(container).run({
    input: { file_ids: [stored.id], library, uploaded_by: null },
  })
  const asset = result[0]
  if (!asset) {
    throw new Error(`demo-catalog: ${source.file} was not registered`)
  }
  return asset
}

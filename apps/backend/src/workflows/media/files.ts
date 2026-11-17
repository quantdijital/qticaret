import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"

export interface StoredFile {
  id: string
  url: string
}

/**
 * A public file written whole: an image version the storefront serves, a
 * video's poster. Storage refusing it, whatever it kept of it under its
 * key is removed before the error goes on (adr/0069 re-review 4).
 */
export async function storePublicFile(
  container: MedusaContainer,
  filename: string,
  mimeType: string,
  content: Buffer
): Promise<StoredFile> {
  const upload = await container
    .resolve(Modules.FILE)
    .getUploadStream({ filename, mimeType, access: "public" })
  try {
    upload.writeStream.end(content)
    // The key and URL come with the stream; what the promise resolves to varies by provider
    await upload.promise
  } catch (error) {
    await removeFiles(container, [upload.fileKey])
    throw error
  }
  return { id: upload.fileKey, url: upload.url }
}

/**
 * Removes files that are no longer served; true when storage took them all.
 * A refusal is logged: the caller keeps its record so a later run tries again.
 */
export async function removeFiles(
  container: MedusaContainer,
  ids: readonly string[]
): Promise<boolean> {
  if (ids.length === 0) {
    return true
  }
  try {
    await container.resolve(Modules.FILE).deleteFiles([...ids])
    return true
  } catch (error) {
    logger.warn({ event: "media.files_not_removed", count: ids.length, err: errorSummary(error) })
    return false
  }
}

/** Storage's own "no such file" (local disk, S3), as opposed to storage failing. */
export function isMissingFile(error: unknown): boolean {
  const { code, name, $metadata } = (error ?? {}) as {
    code?: unknown
    name?: unknown
    $metadata?: { httpStatusCode?: unknown }
  }
  return (
    code === "ENOENT" ||
    name === "NoSuchKey" ||
    name === "NotFound" ||
    $metadata?.httpStatusCode === 404
  )
}

import { ValidationError } from "../../../errors"
import { readZipSafely } from "../../../security/zip"

/**
 * A WordPress export as the owner uploads it (Tools > Export > All
 * content): its XML, or a zip holding it, up to the upload's cap.
 */

// A shop's export, its media library and blog included
export const MAX_WXR_BYTES = 50 * 1024 * 1024
export const NAMESPACE = /xmlns:wp\s*=\s*["']http:\/\/wordpress\.org\/export\/1\.[0-2]\/["']/
// The namespace is declared on `<rss>`, after the export's comment header
export const HEAD_BYTES = 64 * 1024

const isZip = (bytes: Buffer) => bytes.subarray(0, 4).toString("latin1") === "PK\u0003\u0004"

/** Whether the bytes look like a WordPress export (or a zip that may hold one): a quick check at upload. */
export function looksLikeWxr(bytes: Buffer): boolean {
  return isZip(bytes) || NAMESPACE.test(bytes.subarray(0, HEAD_BYTES).toString("utf8"))
}

/** The export's text: a zip holding it is opened within the zip reader's limits. */
export async function wxrText(bytes: Buffer): Promise<string> {
  let plain = bytes
  if (isZip(bytes)) {
    const entries = await readZipSafely(bytes)
    const xml = entries.find((entry) => /\.xml$/i.test(entry.name))
    if (!xml) {
      throw new ValidationError("migration.wordpress_invalid")
    }
    plain = xml.data
  }
  return plain.toString("utf8").replace(/^\uFEFF/, "")
}

import type { MedusaRequest } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"

/**
 * A route's body as bytes, for a route Medusa parses nothing for (a file
 * sent as it is, F3.9). Longer than `maxBytes`, by its header or as it
 * comes, it is refused and the rest is not read.
 */
export async function readRawBody(req: MedusaRequest, maxBytes: number): Promise<Buffer> {
  if (Number(req.headers["content-length"] ?? 0) > maxBytes) {
    throw new ValidationError("upload.file_too_large")
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > maxBytes) {
      throw new ValidationError("upload.file_too_large")
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

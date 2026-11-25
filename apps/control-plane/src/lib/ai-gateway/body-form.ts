import type { AiCreditTask } from "@qticaret/types/control-plane"
import { AI_IMAGE_EDIT_TEXT_MAX_BYTES } from "./limits"

/**
 * A Photoroom form's parts checked by name (security review of P3b D1):
 * only the fields the shop's connector sends today (apps/backend
 * lib/ai/connectors/photoroom.ts) and exactly one file, so no field a
 * provider would fetch from an address (`imageUrl`) or bill more for
 * passes. A small strict scanner, no parser: each part's headers are read
 * (its `Content-Disposition` name and filename, a `Content-Type`), its
 * bytes are found by the next boundary and never looked into, and a form
 * not exactly in this shape is refused. The bytes sent are the shop's.
 */

const FIELDS: Readonly<Partial<Record<AiCreditTask, { fields: readonly string[]; file: string }>>> =
  {
    // Segment: a cut-out, or white behind it
    image_background: { fields: ["format", "bg_color"], file: "image_file" },
    // Edit: a product set in a scene the sector pack describes
    image_scene: { fields: ["background.prompt", "referenceBox"], file: "imageFile" },
  }

const MAX_PARTS = 8
const MAX_HEADER_BYTES = 1024
const DISPOSITION =
  /^content-disposition:[ \t]*form-data;[ \t]*name="([^"\r\n]{1,64})"(?:;[ \t]*filename="([^"\r\n]{0,200})")?[ \t]*$/i
const TYPE = /^content-type:[ \t]*[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+[ \t]*$/i
const BOUNDARY = /;\s*boundary=(?:"([^"]{1,70})"|([^\s;"]{1,70}))/i

/** The form's boundary as its type names it, or null. */
export const boundaryOf = (contentType: string): string | null => {
  const match = BOUNDARY.exec(contentType)
  return match ? (match[1] ?? match[2] ?? null) : null
}

interface Part {
  name: string
  file: boolean
  size: number
}

/** Each part's name, whether it is a file and its size; null for a form not in shape. */
function partsOf(raw: Buffer, boundary: string): Part[] | null {
  const delimiter = Buffer.from(`--${boundary}`)
  const between = Buffer.from(`\r\n--${boundary}`)
  if (raw.indexOf(delimiter) !== 0) {
    return null
  }
  const parts: Part[] = []
  let at = delimiter.length
  for (;;) {
    const next = raw.subarray(at, at + 2).toString("latin1")
    if (next === "--") {
      // The closing delimiter: at most a line break after it
      const rest = raw.subarray(at + 2).toString("latin1")
      return rest === "" || rest === "\r\n" ? parts : null
    }
    if (next !== "\r\n" || parts.length >= MAX_PARTS) {
      return null
    }
    const start = at + 2
    const headersEnd = raw.indexOf("\r\n\r\n", start, "latin1")
    if (headersEnd < 0 || headersEnd - start > MAX_HEADER_BYTES) {
      return null
    }
    const lines = raw.subarray(start, headersEnd).toString("latin1").split("\r\n")
    const disposition = lines.map((line) => DISPOSITION.exec(line)).find((found) => found !== null)
    const known = lines.every((line) => DISPOSITION.test(line) || TYPE.test(line))
    if (!disposition || !known || lines.filter((line) => DISPOSITION.test(line)).length !== 1) {
      return null
    }
    const bodyStart = headersEnd + 4
    const end = raw.indexOf(between, bodyStart)
    if (end < 0) {
      return null
    }
    parts.push({
      name: disposition[1] ?? "",
      file: disposition[2] !== undefined,
      size: end - bodyStart,
    })
    at = end + between.length
  }
}

/** Null when the form is one the task's connector sends; else why it is refused. */
export function formRefusal(raw: Buffer, contentType: string, task: AiCreditTask): string | null {
  const allowed = FIELDS[task]
  const boundary = boundaryOf(contentType)
  if (allowed === undefined || boundary === null) {
    return "form_refused"
  }
  const parts = partsOf(raw, boundary)
  if (parts === null) {
    return "form_unreadable"
  }
  const files = parts.filter((part) => part.file)
  const fields = parts.filter((part) => !part.file)
  if (files.length !== 1 || files[0]?.name !== allowed.file) {
    return "form_file_refused"
  }
  const names = new Set(fields.map((field) => field.name))
  if (
    names.size !== fields.length ||
    fields.some((field) => !allowed.fields.includes(field.name))
  ) {
    return "form_field_refused"
  }
  const text = fields.reduce((sum, field) => sum + field.size, 0)
  return text > AI_IMAGE_EDIT_TEXT_MAX_BYTES ? "over_task_text" : null
}

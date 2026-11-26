import { z } from "@medusajs/framework/zod"
import { parseXml } from "../../clients/xml"
import type { XmlNode } from "../../clients/xml"
import { invalid, refused, trackingRefusal } from "./answers"

/**
 * Sürat's tracking answer (`KargoTakipHareketDetayi`; docs/entegrasyonlar/
 * surat.md): a string holding JSON (`{"IsError", "errorMessage",
 * "Gonderiler": [...]}`, the owner's plugin) or XML (the community SDK),
 * read here into rows of named values. JSON through a schema; XML only
 * through our own reader (no DOCTYPE, no entity: XXE). An empty string is
 * a code Sürat does not know yet (not handed to the branch). The column
 * names are not documented: the readers in `./status` look for them by
 * name, and only in Sürat's own columns (never a name or an address).
 */

/** One movement: Sürat's columns by name, upper-cased without Turkish letters. */
export type SuratRow = Readonly<Record<string, string>>

export interface SuratTracking {
  /** Sürat knows the code. */
  found: boolean
  rows: SuratRow[]
}

const NOT_FOUND: SuratTracking = { found: false, rows: [] }

// A row's column as the readers look it up: `IslemTarihi`, `ISLEM_TARIHI` and `İşlemTarihi` alike
export const columnOf = (name: string): string =>
  name
    .toLocaleUpperCase("tr")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Scalar = z.infer<typeof scalar>
type JsonRow = Record<string, unknown>

const answer = z.object({
  IsError: z.boolean().optional(),
  errorMessage: z.string().nullish(),
  Gonderiler: z.array(z.record(z.string(), z.unknown())).nullish(),
})

const textOfScalar = (value: Scalar): string => (value === null ? "" : String(value).trim())

/** A JSON row's own values; a list in it (a parcel's movements) becomes rows of their own. */
function rowsOfJson(row: JsonRow, inherited: Record<string, string> = {}): SuratRow[] {
  const own: Record<string, string> = { ...inherited }
  const nested: JsonRow[] = []
  for (const [name, value] of Object.entries(row)) {
    const parsed = scalar.safeParse(value)
    if (parsed.success) {
      own[columnOf(name)] = textOfScalar(parsed.data)
    } else if (Array.isArray(value)) {
      nested.push(...value.filter((each): each is JsonRow => typeof each === "object" && !!each))
    }
  }
  return nested.length > 0 ? nested.flatMap((each) => rowsOfJson(each, own)) : [own]
}

/** XML rows: every element whose children are all plain values (a DataSet's `Table`). */
function rowsOfXml(tree: XmlNode): SuratRow[] {
  const rows: SuratRow[] = []
  const visit = (node: XmlNode) => {
    const leaves = node.children.length > 0 && node.children.every((c) => c.children.length === 0)
    if (leaves) {
      rows.push(
        Object.fromEntries(node.children.map((child) => [columnOf(child.name), child.text.trim()]))
      )
      return
    }
    node.children.forEach(visit)
  }
  visit(tree)
  return rows
}

/** Sürat's refusal of a tracking call: no parcel under the code, a refused login, or else. */
function refusalOf(said: string | null, secrets: readonly string[]): SuratTracking {
  const kind = trackingRefusal(said)
  if (kind === "not_found") {
    return NOT_FOUND
  }
  throw refused(said, secrets, kind === "login" ? "login_refused" : "rejected")
}

function fromJson(text: string, secrets: readonly string[]): SuratTracking {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw invalid()
  }
  const parsed = answer.safeParse(value)
  if (!parsed.success) {
    // A bare list of movements
    if (Array.isArray(value)) {
      const rows = value
        .filter((each): each is JsonRow => typeof each === "object" && !!each)
        .flatMap((each) => rowsOfJson(each))
      return rows.length > 0 ? { found: true, rows } : NOT_FOUND
    }
    throw invalid()
  }
  if (parsed.data.IsError) {
    const said = parsed.data.errorMessage ?? null
    return refusalOf(said, secrets)
  }
  const rows = (parsed.data.Gonderiler ?? []).flatMap((each) => rowsOfJson(each))
  return rows.length > 0 ? { found: true, rows } : NOT_FOUND
}

/** The parcel's movements in a tracking answer's string; refused when Sürat refused the call. */
export function suratTrackingOf(
  text: string | null,
  secrets: readonly string[] = []
): SuratTracking {
  const body = (text ?? "").trim()
  if (body === "") {
    return NOT_FOUND
  }
  if (body.startsWith("{") || body.startsWith("[")) {
    return fromJson(body, secrets)
  }
  if (body.startsWith("<")) {
    let tree: XmlNode
    try {
      tree = parseXml(body)
    } catch {
      throw invalid()
    }
    const rows = rowsOfXml(tree)
    return rows.length > 0 ? { found: true, rows } : NOT_FOUND
  }
  // A sentence: Sürat's words for a code it does not know, a login it refuses, or else
  return refusalOf(body, secrets)
}

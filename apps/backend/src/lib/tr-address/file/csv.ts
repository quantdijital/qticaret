const BOM = "\uFEFF"

/**
 * Minimal RFC 4180 reader for the normalized address file: comma separated,
 * first line is the header, fields may be double-quoted with "" escapes.
 * Returns one object per data row keyed by header names.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const records = splitRecords(text.startsWith(BOM) ? text.slice(1) : text)
  const header = records.shift()
  if (!header) {
    return []
  }
  return records
    .filter((fields) => fields.some((field) => field !== ""))
    .map((fields) => Object.fromEntries(header.map((name, i) => [name.trim(), fields[i] ?? ""])))
}

function splitRecords(text: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i)
    if (inQuotes) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      fields.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(i + 1) === "\n") {
        i++
      }
      fields.push(field)
      records.push(fields)
      fields = []
      field = ""
    } else {
      field += char
    }
  }
  if (field !== "" || fields.length > 0) {
    fields.push(field)
    records.push(fields)
  }
  return records
}

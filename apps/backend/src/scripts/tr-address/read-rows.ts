import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { parseCsv } from "./csv"

/**
 * Reads a normalized address file (adr/0008): CSV with a header row, or a
 * JSON array of row objects. Columns: province_code, province_name,
 * district_name, neighborhood_name, postal_code. Source-specific formats get
 * an adapter that writes this shape.
 */
export async function readAddressRows(filePath: string): Promise<unknown[]> {
  const text = await readFile(filePath, "utf8")
  switch (extname(filePath).toLowerCase()) {
    case ".csv":
      return parseCsv(text)
    case ".json": {
      const data: unknown = JSON.parse(text)
      if (!Array.isArray(data)) {
        throw new Error("tr-address import: JSON file must contain an array of rows")
      }
      return data as unknown[]
    }
    default:
      throw new Error("tr-address import: expected a .csv or .json file")
  }
}

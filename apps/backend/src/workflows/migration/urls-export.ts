import type { MedusaContainer } from "@medusajs/framework/types"
import { CSV_BOM, toCsv } from "../../lib/security"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { inTurns } from "./images"
import { askedAs, stateOf } from "./urls"
import type { AddressState } from "./urls"

type Container = Pick<MedusaContainer, "resolve">

const PAGE = 200
/** The most addresses one export lists (the most clicked first); a larger inventory is cut. */
export const URL_EXPORT_CAP = 20_000

export const URL_EXPORT_HEADER = ["Eski adres", "Yeni adres", "Yanıt", "Tıklama", "Kayıt türü"]

// What the address answers here today, as a status code the owner's next host understands
const ANSWER: Readonly<Record<AddressState["state"], string>> = {
  live: "200",
  redirected: "301",
  gone: "410",
  not_found: "404",
}

interface ExportRow {
  address: string
  path: string
  query: string | null
  entity_id: string | null
  entity_type: string | null
  decision: string
  clicks: number | null
}

/** A page's rows as CSV lines, their answers resolved side by side (a few at a time). */
export async function exportLines(container: Container, rows: readonly ExportRow[]) {
  const states = await inTurns(rows, (row) => stateOf(container, ...askedAs(row)))
  return rows.map((row, index) => {
    const state = states[index] ?? { state: "not_found" as const }
    return [
      row.address,
      state.state === "redirected" ? state.location : "",
      ANSWER[state.state],
      String(row.clicks ?? 0),
      row.entity_type ?? "",
    ]
  })
}

/**
 * The old site's addresses as a list to keep (adr/0042 Ek 2026-11-27):
 * each with where it goes now (its 301's target), what it answers and how
 * often Search Console saw it clicked, the most clicked first, at most
 * `URL_EXPORT_CAP`. `;` separated and formula-safe (F2.9), with the BOM
 * Excel reads as UTF-8. Written page by page; `stopped` ends it early (the
 * client went). Old addresses and paths only. How many rows, and whether
 * the inventory was cut.
 */
export async function writeUrlExport(
  container: Container,
  write: (chunk: string) => Promise<void> | void,
  stopped: () => boolean = () => false,
  cap: number = URL_EXPORT_CAP
): Promise<{ written: number; cut: boolean }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  await write(CSV_BOM + toCsv([URL_EXPORT_HEADER], ";"))
  let written = 0
  while (!stopped() && written < cap) {
    const take = Math.min(PAGE, cap - written)
    const rows = (await migration.listMigrationUrls(
      {},
      {
        select: ["address", "path", "query", "entity_id", "entity_type", "decision", "clicks"],
        skip: written,
        take,
        order: { clicks: "DESC", address: "ASC" },
      }
    )) as ExportRow[]
    if (rows.length > 0) {
      await write(toCsv(await exportLines(container, rows), ";"))
    }
    written += rows.length
    if (rows.length < take) {
      return { written, cut: false }
    }
  }
  const [, total] = await migration.listAndCountMigrationUrls({}, { take: 1, select: ["id"] })
  return { written, cut: total > written }
}

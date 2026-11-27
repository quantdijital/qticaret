import type { MedusaContainer } from "@medusajs/framework/types"
import { CSV_BOM, toCsv } from "../../lib/security"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { askedAs, stateOf } from "./urls"
import type { AddressState } from "./urls"

type Container = Pick<MedusaContainer, "resolve">

const PAGE = 200

export const URL_EXPORT_HEADER = ["Eski adres", "Yeni adres", "Yanıt", "Tıklama", "Kayıt türü"]

// What the address answers here today, as a status code the owner's next host understands
const ANSWER: Readonly<Record<AddressState["state"], string>> = {
  live: "200",
  redirected: "301",
  gone: "410",
  not_found: "404",
}

/**
 * The old site's addresses as a list to keep (adr/0042 Ek 2026-11-27):
 * each with where it goes now (its 301's target), what it answers and how
 * often Search Console saw it clicked, the most clicked first. `;`
 * separated and formula-safe (F2.9), with the BOM Excel reads as UTF-8.
 * Old addresses and paths only: no person's data. Written page by page.
 */
export async function writeUrlExport(
  container: Container,
  write: (chunk: string) => Promise<void> | void,
  stopped: () => boolean = () => false
): Promise<number> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  await write(CSV_BOM + toCsv([URL_EXPORT_HEADER], ";"))
  let written = 0
  for (let skip = 0; !stopped(); skip += PAGE) {
    const rows = await migration.listMigrationUrls(
      {},
      {
        select: ["address", "path", "query", "entity_id", "entity_type", "decision", "clicks"],
        skip,
        take: PAGE,
        order: { clicks: "DESC", address: "ASC" },
      }
    )
    const lines: string[][] = []
    for (const row of rows) {
      const state = await stateOf(container, ...askedAs(row))
      lines.push([
        row.address,
        state.state === "redirected" ? state.location : "",
        ANSWER[state.state],
        String(row.clicks ?? 0),
        row.entity_type ?? "",
      ])
    }
    if (lines.length > 0) {
      await write(toCsv(lines, ";"))
    }
    written += rows.length
    if (rows.length < PAGE) {
      return written
    }
  }
  return written
}

import { CSV_BOM } from "../../../lib/security"
import { MIGRATION_MODULE } from "../../../modules/migration"
import { writeUrlExport } from "../urls-export"

jest.mock("../urls", () => ({
  askedAs: (row: { path: string }) => [row.path, { legacy: false }],
  stateOf: jest.fn((_container: unknown, path: string) =>
    Promise.resolve(
      path === "/eski" ? { state: "redirected", location: "/yeni" } : { state: "not_found" }
    )
  ),
}))

const row = (index: number) => ({
  address: index === 0 ? "/eski" : `/a-${String(index)}`,
  path: index === 0 ? "/eski" : `/a-${String(index)}`,
  query: null,
  entity_id: null,
  entity_type: index === 0 ? "product" : null,
  decision: "auto",
  clicks: 10 - index,
})

const containerOf = (count: number) => {
  const rows = Array.from({ length: count }, (_, index) => row(index))
  const migration = {
    listMigrationUrls: jest.fn((_filter: unknown, { skip, take }: { skip: number; take: number }) =>
      Promise.resolve(rows.slice(skip, skip + take))
    ),
    listAndCountMigrationUrls: jest.fn(() => Promise.resolve([[], rows.length])),
  }
  return {
    container: {
      resolve: (key: string) => {
        if (key !== MIGRATION_MODULE) {
          throw new Error(key)
        }
        return migration
      },
    } as never,
    migration,
  }
}

describe("the old addresses' CSV", () => {
  it("writes each address with where it goes now, formula-safe", async () => {
    const { container } = containerOf(2)
    const chunks: string[] = []
    const outcome = await writeUrlExport(container, (chunk) => {
      chunks.push(chunk)
    })
    expect(outcome).toEqual({ written: 2, cut: false })
    const text = chunks.join("")
    expect(text.startsWith(CSV_BOM)).toBe(true)
    expect(text).toContain("/eski;/yeni;301;10;product")
    expect(text).toContain("/a-1;;404;9;")
  })

  it("stops at its cap, and when the client goes", async () => {
    const { container, migration } = containerOf(5)
    const capped = await writeUrlExport(
      container,
      () => undefined,
      () => false,
      3
    )
    expect(capped).toEqual({ written: 3, cut: true })
    migration.listMigrationUrls.mockClear()
    const stopped = await writeUrlExport(
      container,
      () => undefined,
      () => true
    )
    expect(stopped.written).toBe(0)
    expect(migration.listMigrationUrls).not.toHaveBeenCalled()
  })
})

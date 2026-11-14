import { Migration20261114134834 } from "../migrations/Migration20261114134834"

/** The statements a migration's step writes, in order, without a database. */
async function statements(step: "up" | "down"): Promise<string[]> {
  const sql: string[] = []
  const migration = Object.create(Migration20261114134834.prototype) as Migration20261114134834
  Object.assign(migration, { addSql: (query: string) => sql.push(query) })
  await migration[step]()
  return sql
}

describe("the ledger's preset kinds (adr/0063 §4)", () => {
  it("going back, removes the rows of the kinds it allowed before narrowing the check", async () => {
    const sql = await statements("down")
    expect(sql[0]).toBe(
      `delete from "sector_pack_item" where "kind" in ('preset_image', 'demo_record');`
    )
    expect(sql.at(-1)).toMatch(/check\("kind" in \('attribute_template'.*'seo_template'\)\)/)
    expect(sql.at(-1)).not.toMatch(/preset_image/)
  })
})

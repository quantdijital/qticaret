import { readdirSync, readFileSync, existsSync } from "fs"
import { join } from "path"

/**
 * Medusa records the migrations it has run by name in one shared
 * `mikro_orm_migrations` table, so two modules with a migration of the same
 * name make a database that ran one skip the other. Every migration name in
 * our modules (and links) must be unique.
 */

const SRC = join(__dirname, "..", "..")

function migrationDirs(): string[] {
  const dirs: string[] = []
  const modules = join(SRC, "modules")
  for (const entry of readdirSync(modules, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(modules, entry.name, "migrations")
    if (existsSync(dir)) dirs.push(dir)
  }
  const links = join(SRC, "links", "migrations")
  if (existsSync(links)) dirs.push(links)
  return dirs
}

function collect(): { file: string; base: string; className: string | null }[] {
  const out: { file: string; base: string; className: string | null }[] = []
  for (const dir of migrationDirs()) {
    for (const name of readdirSync(dir)) {
      if (!/^Migration.*\.ts$/.test(name)) continue
      const file = join(dir, name)
      const match = /export\s+class\s+(\w+)/.exec(readFileSync(file, "utf8"))
      out.push({
        file: file.slice(SRC.length + 1),
        base: name.replace(/\.ts$/, ""),
        className: match ? match[1] : null,
      })
    }
  }
  return out
}

function duplicates(items: { file: string; key: string | null }[]): Record<string, string[]> {
  const seen: Record<string, string[]> = {}
  for (const { file, key } of items) {
    if (!key) continue
    ;(seen[key] ??= []).push(file)
  }
  return Object.fromEntries(Object.entries(seen).filter(([, files]) => files.length > 1))
}

describe("migration names", () => {
  const migrations = collect()

  it("finds the migrations", () => {
    expect(migrations.length).toBeGreaterThan(0)
  })

  it("gives every migration file a name of its own", () => {
    expect(duplicates(migrations.map((m) => ({ file: m.file, key: m.base })))).toEqual({})
  })

  it("gives every migration class a name of its own", () => {
    expect(duplicates(migrations.map((m) => ({ file: m.file, key: m.className })))).toEqual({})
  })
})

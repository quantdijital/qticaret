import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * Medusa takes one handler per workflow hook, and a second one stops the
 * app at boot ("Cannot define multiple hook handlers"). The hooks this
 * folder registers are read from its files, and none may be registered
 * twice, nor one a plugin already holds.
 */

const FOLDER = join(__dirname, "..")

/** Hooks a plugin of medusa-config registers itself: not ours to take. */
const HELD_BY_PLUGINS: Readonly<Record<string, string>> = {
  // @medusajs/loyalty-plugin: its gift cards cloned onto the order
  "completeCartWorkflow.orderCreated": "@medusajs/loyalty-plugin",
}

// `someWorkflow.hooks.name(` or a cast of `someWorkflow.hooks` used as `.name(`
const DIRECT = /(\w+Workflow)\.hooks\.(\w+)\s*\(/g
const CAST = /(\w+Workflow)\.hooks\s+as\b[^\n]*\n?[\s\S]*?\b(\w+)\.(\w+)\s*\(/g

function registrations(): { hook: string; file: string }[] {
  const files = readdirSync(FOLDER).filter((name) => name.endsWith(".ts"))
  return files.flatMap((file) => {
    const source = readFileSync(join(FOLDER, file), "utf8")
    const direct = [...source.matchAll(DIRECT)].map(
      (match) => `${match[1] ?? ""}.${match[2] ?? ""}`
    )
    const cast = source.includes(".hooks as")
      ? [...source.matchAll(CAST)].map((match) => `${match[1] ?? ""}.${match[3] ?? ""}`)
      : []
    return [...direct, ...cast].map((hook) => ({ hook, file }))
  })
}

describe("workflow hooks have one handler each", () => {
  it("finds the folder's hooks", () => {
    expect(registrations().map(({ hook }) => hook)).toContain("completeCartWorkflow.validate")
  })

  it("registers no hook twice, and none a plugin holds", () => {
    const seen = new Map<string, string>()
    const problems: string[] = []
    for (const { hook, file } of registrations()) {
      const before = seen.get(hook)
      if (before) {
        problems.push(`${hook}: ${before} and ${file}`)
      }
      const plugin = HELD_BY_PLUGINS[hook]
      if (plugin) {
        problems.push(`${hook}: ${file}, but ${plugin} holds it`)
      }
      seen.set(hook, file)
    }
    expect(problems).toEqual([])
  })
})

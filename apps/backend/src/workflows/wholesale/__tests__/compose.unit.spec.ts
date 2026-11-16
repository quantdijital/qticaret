import { readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * Every wholesale workflow file composed, as the app does at boot: a
 * workflow is built when its file is loaded, and a mistake in its
 * composition (a step name used twice, a hook taken twice) stops the
 * whole backend there. Loading each file here makes the unit run fail
 * first (two boot failures reached the HTTP run before this test).
 */

// A link is defined against the running app's modules; its query name is all the code reads
jest.mock("../../../links/wholesale-account-order", () => ({
  __esModule: true,
  default: { entryPoint: "order_wholesale_account" },
}))

const ROOT = join(__dirname, "..")

function workflowFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : workflowFiles(path)
    }
    return name.endsWith(".ts") ? [path] : []
  })
}

const files = [
  ...workflowFiles(ROOT),
  // The KVKK erasure's wholesale step, run by the erasure workflow
  join(ROOT, "..", "legal", "erasure", "wholesale.ts"),
]

describe("the wholesale workflows compose (as the app loads them at boot)", () => {
  it("finds the files", () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(files.map((file) => [relative(ROOT, file), file]))("loads %s", async (_name, file) => {
    await expect(import(file)).resolves.toBeDefined()
  })
})

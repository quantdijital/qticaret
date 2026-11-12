import { mkdtemp, readdir, rm } from "node:fs/promises"
import type * as FsPromises from "node:fs/promises"
import type { FileHandle } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type * as Files from "../local/private-files"

// Ek C19 L3: one call to `open` hands back a handle whose step fails
const failing: { step: "writeFile" | "sync" | "close" | null } = { step: null }

jest.mock("node:fs/promises", () => {
  const actual = jest.requireActual<typeof FsPromises>("node:fs/promises")
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle: FileHandle = await actual.open(...args)
      const step = failing.step
      if (step === null) {
        return handle
      }
      const original = handle[step].bind(handle) as () => Promise<void>
      handle[step] = (async () => {
        if (step === "close") {
          await original()
        }
        throw Object.assign(new Error("disk full"), { code: "ENOSPC" })
      }) as never
      return handle
    },
  }
})

// Imported after the mock is in place (a plain import would be hoisted above it)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { writePrivateFile, readPrivateFile } = require("../local/private-files") as typeof Files

describe("writePrivateFile (Ek C19 L3)", () => {
  let folder: string

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "qt-private-"))
    failing.step = null
  })

  afterEach(async () => {
    failing.step = null
    await rm(folder, { recursive: true, force: true })
  })

  it.each(["writeFile", "sync", "close"] as const)(
    "leaves no temporary file behind when %s fails",
    async (step) => {
      const path = join(folder, "shop", ".env")
      failing.step = step

      await expect(writePrivateFile(path, "JWT_SECRET=x\n")).rejects.toMatchObject({
        code: "ENOSPC",
      })
      expect(await readdir(join(folder, "shop"))).toEqual([])
    }
  )

  it("writes the file whole when nothing fails", async () => {
    const path = join(folder, "shop", ".env")

    await writePrivateFile(path, "JWT_SECRET=x\n")

    expect(await readPrivateFile(path)).toBe("JWT_SECRET=x\n")
    expect(await readdir(join(folder, "shop"))).toEqual([".env"])
  })
})

import { EventEmitter } from "node:events"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileClosed, sweepStaleVideoTempDirs } from ".."

const HOUR = 60 * 60 * 1000

describe("upload directories left behind (security review B-3)", () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "qt-test-sweep-"))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("removes only upload directories untouched for an hour", async () => {
    const now = Date.now()
    const old = join(root, "qt-video-eski01")
    const fresh = join(root, "qt-video-yeni01")
    const other = join(root, "baska-dizin")
    for (const dir of [old, fresh, other]) {
      mkdirSync(dir)
      writeFileSync(join(dir, "source"), "x")
    }
    const twoHoursAgo = new Date(now - 2 * HOUR)
    utimesSync(old, twoHoursAgo, twoHoursAgo)
    utimesSync(other, twoHoursAgo, twoHoursAgo)
    // A file of that name, not a directory, is left alone
    writeFileSync(join(root, "qt-video-dosya"), "x")

    expect(await sweepStaleVideoTempDirs(root, now)).toBe(1)
    expect(readdirSync(root).sort()).toEqual(["baska-dizin", "qt-video-dosya", "qt-video-yeni01"])
  })

  it("never throws, even on a root that is not there", async () => {
    await expect(sweepStaleVideoTempDirs(join(root, "yok"))).resolves.toBe(0)
  })
})

describe("waiting for a file to close (security review B-2)", () => {
  const writer = (isClosed: boolean) => Object.assign(new EventEmitter(), { closed: isClosed })

  it("answers at once for a closed file or none", async () => {
    await expect(fileClosed(null)).resolves.toBe(true)
    await expect(fileClosed(writer(true))).resolves.toBe(true)
  })

  it("answers when the file closes", async () => {
    const open = writer(false)
    const waiting = fileClosed(open, 1_000)
    open.emit("close")
    await expect(waiting).resolves.toBe(true)
  })

  it("gives up after its time on a file that never closes", async () => {
    const started = Date.now()
    await expect(fileClosed(writer(false), 50)).resolves.toBe(false)
    // Its own 50 ms, not the default 5 s: the bound leaves a loaded
    // CI runner seconds of slack (adr/0081)
    expect(Date.now() - started).toBeLessThan(3_000)
  })
})

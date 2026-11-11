import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RELEASE_FILE, UNKNOWN_COMMIT, readRelease } from "../release"

const COMMIT = "89abcdef0123456789abcdef0123456789abcdef"

describe("readRelease (adr/0061 §5.4, Ek C13)", () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "qt-release-"))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("takes the build's stamp first", () => {
    writeFileSync(join(dir, RELEASE_FILE), JSON.stringify({ version: "2.1.0", commit: COMMIT }))
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "9.9.9" }))
    expect(readRelease(dir, { NODE_ENV: "production" })).toEqual({
      version: "2.1.0",
      commit: COMMIT,
      known: true,
    })
  })

  it("ignores a stamp that is not one, and takes RELEASE's commit with package.json's version", () => {
    writeFileSync(join(dir, RELEASE_FILE), JSON.stringify({ version: "2.1.0", commit: "nope" }))
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "1.0.0" }))
    expect(readRelease(dir, { NODE_ENV: "production", RELEASE: COMMIT.toUpperCase() })).toEqual({
      version: "1.0.0",
      commit: COMMIT,
      known: true,
    })
  })

  it("says it does not know when deployed without a stamp: no git is run there", () => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "1.0.0" }))
    expect(readRelease(dir, { NODE_ENV: "production", RELEASE: "v1.0" })).toEqual({
      version: "1.0.0",
      commit: UNKNOWN_COMMIT,
      known: false,
    })
    expect(readRelease(dir, {})).toMatchObject({ commit: UNKNOWN_COMMIT, known: false })
  })

  it("asks git on a developer's machine, and falls back to 0.0.0 without a version", () => {
    // This repository's own checkout: a commit comes back
    const local = readRelease(process.cwd(), { NODE_ENV: "development" })
    expect(local.known).toBe(true)
    expect(local.commit).toMatch(/^[0-9a-f]{40}$/)
    // A folder outside any repository: no commit, no version
    expect(readRelease(dir, { NODE_ENV: "development" })).toEqual({
      version: "0.0.0",
      commit: UNKNOWN_COMMIT,
      known: false,
    })
  })
})

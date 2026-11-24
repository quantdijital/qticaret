import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  envFileMode,
  envTargetProblem,
  linkLocalProblem,
  mergeEnvText,
  parseShopEnv,
  readShopEnv,
  shopEnvPath,
  shopEnvProblem,
  writeShopEnv,
} from "../local-link"

const VALUES = {
  CONTROL_PLANE_URL: "http://localhost:9100",
  CONTROL_PLANE_PUBLIC_KEYS: "k1,k2",
  TENANT_ID: "ten_01",
  TENANT_SIGNING_KEY: "k3",
}

const DB = "postgres://postgres:pw@localhost:55432/qticaret_cp"

describe("cp:link-local runs on a developer's machine only", () => {
  it("takes development and test against a database here", () => {
    expect(linkLocalProblem({ NODE_ENV: "development", DATABASE_URL: DB })).toBeNull()
    expect(linkLocalProblem({ NODE_ENV: "test", DATABASE_URL: DB })).toBeNull()
  })

  it("refuses production, an unset NODE_ENV and a database elsewhere", () => {
    expect(linkLocalProblem({ NODE_ENV: "production", DATABASE_URL: DB })).toBe(
      "only in development or test"
    )
    expect(linkLocalProblem({ NODE_ENV: undefined, DATABASE_URL: DB })).toBe(
      "only in development or test"
    )
    expect(
      linkLocalProblem({ NODE_ENV: "development", DATABASE_URL: "postgres://u:p@10.0.0.5/cp" })
    ).toBe("only against a database on this machine")
  })
})

describe("the shop env file's own checks", () => {
  it("takes a development NODE_ENV, and an unset one only in apps/backend/.env", () => {
    expect(shopEnvProblem("NODE_ENV=development\n", false)).toBeNull()
    expect(shopEnvProblem("export NODE_ENV='test'\n", false)).toBeNull()
    expect(shopEnvProblem("A=1\n", true)).toBeNull()
    expect(shopEnvProblem("A=1\n# NODE_ENV=development\n", false)).toMatch(/sets no NODE_ENV/)
    expect(shopEnvProblem("NODE_ENV=production\n", true)).toMatch(/not a development one/)
  })

  it("refuses a file with a multi-line quoted value", () => {
    expect(shopEnvProblem('NODE_ENV=development\nKEY="line1\nline2"\n', false)).toMatch(
      /multi-line/
    )
    expect(shopEnvProblem("NODE_ENV=development\nKEY='a'\nB=\"x # y\"\n", false)).toBeNull()
  })

  it("reads values the way the shop's dotenv does", () => {
    expect(parseShopEnv("# NODE_ENV=production\nNODE_ENV='development'\nX=1 # c\n")).toEqual({
      NODE_ENV: "development",
      X: "1",
    })
  })

  it("refuses a provisioned shop's store and the control plane's own .env", () => {
    const paths = { tenantsDir: "/repo/infra/tenants", controlPlaneEnv: "/repo/cp/.env" }
    expect(envTargetProblem("/repo/infra/tenants/local/x/.env", paths)).toMatch(/provisioned/)
    expect(envTargetProblem("/repo/infra/tenants", paths)).toMatch(/provisioned/)
    expect(envTargetProblem("/repo/cp/.env", paths)).toMatch(/control plane's own/)
    expect(envTargetProblem("/repo/infra/tenants-other/.env", paths)).toBeNull()
    expect(envTargetProblem("/repo/apps/backend/.env", paths)).toBeNull()
    expect(
      envTargetProblem("/repo/apps/backend/.env", { ...paths, controlPlaneEnv: null })
    ).toBeNull()
  })
})

describe("the shop env merge", () => {
  it("appends the missing keys and keeps every other line as it was", () => {
    const text = "# shop\nNODE_ENV=development\n\nREDIS_URL=redis://localhost:6379\n"
    const merged = mergeEnvText(text, VALUES)
    expect(merged.text).toBe(
      `${text}CONTROL_PLANE_URL=http://localhost:9100\nCONTROL_PLANE_PUBLIC_KEYS=k1,k2\n` +
        "TENANT_ID=ten_01\nTENANT_SIGNING_KEY=k3\n"
    )
    expect(merged.changes.map((each) => each.change)).toEqual(["set", "set", "set", "set"])
  })

  it("replaces assignments in place, keeps an export prefix and leaves comments alone", () => {
    const text = [
      "A=1",
      'TENANT_ID="ten_old"',
      "# TENANT_SIGNING_KEY=k0",
      "export TENANT_SIGNING_KEY=k0",
      "CONTROL_PLANE_URL=http://localhost:9100",
      "CONTROL_PLANE_PUBLIC_KEYS=k1,k2 # keys",
      "B=2",
    ].join("\n")
    const merged = mergeEnvText(text, VALUES)
    expect(merged.text).toBe(
      [
        "A=1",
        "TENANT_ID=ten_01",
        "# TENANT_SIGNING_KEY=k0",
        "export TENANT_SIGNING_KEY=k3",
        "CONTROL_PLANE_URL=http://localhost:9100",
        "CONTROL_PLANE_PUBLIC_KEYS=k1,k2",
        "B=2",
      ].join("\n")
    )
    expect(Object.fromEntries(merged.changes.map((each) => [each.key, each.change]))).toEqual({
      CONTROL_PLANE_URL: "unchanged",
      CONTROL_PLANE_PUBLIC_KEYS: "unchanged",
      TENANT_ID: "updated",
      TENANT_SIGNING_KEY: "updated",
    })
  })

  it("replaces every duplicate of a key and is idempotent", () => {
    const once = mergeEnvText("TENANT_ID=ten_a\nX=1\nTENANT_ID=ten_b\n", VALUES)
    expect(once.text.match(/TENANT_ID=ten_01/g)).toHaveLength(2)
    const twice = mergeEnvText(once.text, VALUES)
    expect(twice.text).toBe(once.text)
    expect(twice.changes.every((each) => each.change === "unchanged")).toBe(true)
  })

  it("keeps CRLF line endings and an empty file works", () => {
    expect(mergeEnvText("A=1\r\n", VALUES).text).toMatch(/^A=1\r\nCONTROL_PLANE_URL=.*\r\n$/s)
    expect(mergeEnvText("", VALUES).text.split("\n")).toHaveLength(5)
  })

  it("refuses a value an unquoted line cannot hold, naming the key only", () => {
    expect(() => mergeEnvText("", { ...VALUES, TENANT_SIGNING_KEY: "k 3" })).toThrow(
      /TENANT_SIGNING_KEY cannot be written/
    )
    expect(() => mergeEnvText("", { ...VALUES, TENANT_ID: "" })).toThrow(/TENANT_ID/)
  })
})

describe("the shop env file on disk", () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cp-link-local-"))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("defaults to apps/backend/.env and resolves a relative path where it was typed", () => {
    expect(shopEnvPath(undefined, "/repo")).toBe("/repo/apps/backend/.env")
    expect(shopEnvPath("../x/.env", "/repo", "/repo/apps")).toBe("/repo/x/.env")
    expect(shopEnvPath("/abs/.env", "/repo", "/elsewhere")).toBe("/abs/.env")
  })

  it("keeps owner bits only in the new mode", () => {
    expect(envFileMode(0o100644)).toBe(0o600)
    expect(envFileMode(0o640)).toBe(0o600)
    expect(envFileMode(0o600)).toBe(0o600)
    expect(envFileMode(0o400)).toBe(0o400)
  })

  it("follows a symlink, rewrites its target in place, owner-only", async () => {
    const target = join(dir, "shared.env")
    const link = join(dir, ".env")
    await writeFile(target, "A=1\n", { mode: 0o640 })
    await symlink(target, link)
    const file = await readShopEnv(link)
    expect(file.target).toBe(target)
    await writeShopEnv(file.target, mergeEnvText(file.text, VALUES).text)
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect((await lstat(target)).mode & 0o777).toBe(0o600)
    expect(await readFile(link, "utf8")).toMatch(/^A=1\nCONTROL_PLANE_URL=/)
  })
})

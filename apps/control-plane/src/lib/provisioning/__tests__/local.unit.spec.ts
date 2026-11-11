import { chmod, lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FakeProvisioner } from "../fake-provisioner"
import { ownerInviteLinkProblem } from "../invite-link"
import { COMMAND_TIMEOUT_MS, argvOf, runCommand } from "../local/commands"
import { composeEnv, envText, parseEnvText, readEnvFile, writeEnvFile } from "../local/env-file"
import { databaseNameOf, layoutOf } from "../local/layout"
import { LocalProvisioner } from "../local/local-provisioner"
import { ProvisioningError } from "../provisioner"
import { generateRuntimeSecrets } from "../../vault/tenant-secrets"

const target = { tenant_id: "ten_01ABC", slug: "atolye-bicak", port: 9231, public_keys: "k1,k2" }
const settings = {
  pg_host: "localhost:55432",
  redis_url: "redis://localhost:56379",
  mailpit_url: "http://127.0.0.1:58025",
  control_plane_url: "http://localhost:9100",
}

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qt-c10-"))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return error instanceof ProvisioningError ? error.code : "other"
  }
  return "none"
}

describe("the local shop's env (Ek C10)", () => {
  it("makes the shop managed, on its own database and port, with its own secrets", () => {
    const secrets = generateRuntimeSecrets()
    const env = composeEnv(target, secrets.values, settings)

    expect(env).toMatchObject({
      NODE_ENV: "development",
      DATABASE_URL: `postgres://qt_tenant_atolye_bicak:${secrets.values.DATABASE_PASSWORD}@localhost:55432/qt_tenant_atolye_bicak`,
      ADMIN_CORS: "http://localhost:9231",
      CONTROL_PLANE_URL: "http://localhost:9100",
      CONTROL_PLANE_PUBLIC_KEYS: "k1,k2",
      TENANT_ID: "ten_01ABC",
      TENANT_SIGNING_KEY: secrets.values.TENANT_SIGNING_KEY,
      REDIS_URL: "redis://localhost:56379",
      EMAIL_TRANSPORT: "mailpit",
      PASSWORD_BREACH_CHECK: "off",
    })
    // The role's password reaches the shop inside its URL only
    expect(env["DATABASE_PASSWORD"]).toBeUndefined()
    expect(parseEnvText(envText(env))).toEqual(env)
  })

  it("refuses a value a plain env line would bend, naming no value", () => {
    expect(codeOf(() => envText({ NAME: "a b" }))).toBe("provisioning.env_value_invalid")
    expect(codeOf(() => envText({ NAME: "x\nINJECTED=1" }))).toBe("provisioning.env_value_invalid")
    expect(codeOf(() => envText({ "bad name": "x" }))).toBe("provisioning.env_value_invalid")
  })

  it("writes the store 0600 in a 0700 folder and refuses to read one others could", async () => {
    const file = join(dir, "shop", ".env")
    await writeEnvFile(file, { A: "1", B: "two" })
    expect((await lstat(file)).mode & 0o777).toBe(0o600)
    expect((await lstat(join(dir, "shop"))).mode & 0o777).toBe(0o700)
    expect(await readEnvFile(file)).toEqual({ A: "1", B: "two" })
    expect(await readFile(file, "utf8")).toContain("Never commit")

    await chmod(file, 0o644)
    await expect(readEnvFile(file)).rejects.toMatchObject({ code: "provisioning.secrets_exposed" })
    const link = join(dir, "link.env")
    await symlink(file, link)
    await expect(readEnvFile(link)).rejects.toMatchObject({ code: "provisioning.secrets_exposed" })
    expect(await readEnvFile(join(dir, "none"))).toBeNull()
  })

  it("names folders and databases from a valid slug only", () => {
    expect(layoutOf("atolye-bicak", "/repo").dir).toBe("/repo/infra/tenants/local/atolye-bicak")
    expect(databaseNameOf("atolye-bicak")).toBe("qt_tenant_atolye_bicak")
    expect(codeOf(() => layoutOf("../etc", "/repo"))).toBe("provisioning.slug_invalid")
    expect(codeOf(() => databaseNameOf("x;drop"))).toBe("provisioning.slug_invalid")
  })
})

describe("the closed command list (adr/0061 §3.4)", () => {
  it("maps each command to fixed arguments, never a shell", () => {
    expect(argvOf({ name: "migrate" })).toEqual(["db:migrate", "--execute-safe-links"])
    expect(argvOf({ name: "bootstrap", store_name: "Atölye Bıçak; rm -rf /" })).toEqual([
      "exec",
      "./src/scripts/bootstrap-tenant.js",
      "store-name=Atölye Bıçak; rm -rf /",
    ])
    expect(argvOf({ name: "invite-owner", email: "sahip@example.com" })).toEqual([
      "exec",
      "./src/scripts/invite-owner.js",
      "email=sahip@example.com",
    ])
    expect(argvOf({ name: "plan-import", document: "{}" })).toEqual([
      "exec",
      "./src/scripts/plan-import.js",
    ])
    expect(codeOf(() => argvOf({ name: "apply-pack", pack: "genel" }))).toBe(
      "provisioning.command_unavailable"
    )
    expect(codeOf(() => argvOf({ name: "bootstrap", store_name: "a\u202eb" }))).toBe(
      "provisioning.store_name_invalid"
    )
    expect(codeOf(() => argvOf({ name: "invite-owner", email: "--help" }))).toBe(
      "provisioning.owner_email_invalid"
    )
    expect(Object.keys(COMMAND_TIMEOUT_MS).sort()).toEqual(
      ["apply-pack", "bootstrap", "invite-owner", "migrate", "plan-import"].sort()
    )
  })

  it("reads only the result line, logs the rest unless told not to, and ends what overruns", async () => {
    const cli = join(dir, "cli.js")
    await writeFile(
      cli,
      [
        "let input = ''",
        "process.stdin.on('data', (c) => (input += c))",
        "process.stdin.on('end', () => {",
        "  if (process.argv[2] === 'hang') { setInterval(() => {}, 1000); return }",
        "  console.log('log line SECRET-' + process.env.ONLY_THIS)",
        "  console.log('QT_TENANT_RESULT ' + JSON.stringify({ status: 'ok', got: input, path: !!process.env.PATH }))",
        "  process.exit(process.argv[2] === 'fail' ? 3 : 0)",
        "})",
      ].join("\n")
    )
    const log = join(dir, "commands.log")
    const base = { cli, cwd: dir, env: { ONLY_THIS: "x" }, timeoutMs: 5_000 }

    const done = await runCommand({ ...base, args: ["go"], stdin: "doc", logFile: log })
    expect(done).toMatchObject({ ok: true, exit_code: 0, timed_out: false })
    // Only the variables given: not even PATH from the control plane
    expect(done.result).toEqual({ status: "ok", got: "doc", path: false })
    expect(await readFile(log, "utf8")).toContain("log line SECRET-x")
    expect((await lstat(log)).mode & 0o777).toBe(0o600)

    const quiet = join(dir, "quiet.log")
    const failed = await runCommand({ ...base, args: ["fail"], logFile: null })
    expect(failed).toMatchObject({ ok: false, exit_code: 3 })
    await expect(lstat(quiet)).rejects.toThrow()

    const hung = await runCommand({ ...base, args: ["hang"], timeoutMs: 300, logFile: null })
    expect(hung).toMatchObject({ ok: false, timed_out: true, result: null })
  })
})

describe("the owner's link (Ek C10)", () => {
  it("mails only the shop panel's invitation page with a token", () => {
    const token = "a".repeat(32)
    expect(ownerInviteLinkProblem(`http://localhost:5173/invite#token=${token}`, true)).toBeNull()
    expect(
      ownerInviteLinkProblem(`https://panel.magaza.com/invite#token=${token}`, false)
    ).toBeNull()
    for (const [link, local] of [
      [`http://evil.example/invite#token=${token}`, true],
      [`http://panel.magaza.com/invite#token=${token}`, false],
      [`http://localhost:5173/login#token=${token}`, true],
      [`http://localhost:5173/invite?x=1#token=${token}`, true],
      [`http://u:p@localhost:5173/invite#token=${token}`, true],
      ["http://localhost:5173/invite#token=short", true],
      ["javascript:alert(1)", true],
    ] as const) {
      expect(ownerInviteLinkProblem(link, local)).toBe("provisioning.invite_link_invalid")
    }
  })
})

describe("who may provision where", () => {
  const options = {
    adminUrl: "postgres://postgres:pw@localhost:55432/postgres",
    redisUrl: null,
    mailpitUrl: null,
    controlPlaneUrl: "http://localhost:9100",
    root: "/repo",
  }

  it("boots the local provisioner on a developer's machine against a Postgres here only", () => {
    expect(new LocalProvisioner({ ...options, nodeEnv: "development" }).kind).toBe("local")
    for (const nodeEnv of ["production", "staging", "test", undefined]) {
      expect(codeOf(() => new LocalProvisioner({ ...options, nodeEnv }))).toBe(
        "provisioning.local_development_only"
      )
    }
    expect(
      codeOf(
        () =>
          new LocalProvisioner({
            ...options,
            nodeEnv: "development",
            adminUrl: "postgres://postgres:pw@db.example.com/postgres",
          })
      )
    ).toBe("provisioning.local_database_elsewhere")
  })

  it("keeps the fake provisioner to the tests", () => {
    expect(new FakeProvisioner("test").kind).toBe("fake")
    expect(codeOf(() => new FakeProvisioner("development"))).toBe("provisioning.fake_tests_only")
  })
})

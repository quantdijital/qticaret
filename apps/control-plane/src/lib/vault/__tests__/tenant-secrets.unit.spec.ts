import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { parseAgeRecipients } from "@qticaret/server-kit/escrow"
import { makeTestIdentity, openWithTestIdentity } from "@qticaret/server-kit/testing/age"
import { parsePublicKeys, parseSigningKey } from "@qticaret/server-kit"
import {
  RUNTIME_SECRET_NAMES,
  escrowRecipients,
  generateRuntimeSecrets,
  sealRuntimeSecrets,
} from "../tenant-secrets"

const SRC = join(__dirname, "../../..")
const REPO = join(SRC, "../../..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : sourceFiles(path)
    }
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe("a shop's runtime secrets (adr/0061 §4.3, Ek C8)", () => {
  it("makes every secret of the set, fresh and independent, in the backend's formats", () => {
    const first = generateRuntimeSecrets()
    const second = generateRuntimeSecrets()

    expect(Object.keys(first.values).sort()).toEqual([...RUNTIME_SECRET_NAMES].sort())
    for (const name of RUNTIME_SECRET_NAMES.filter((each) => each !== "TENANT_SIGNING_KEY")) {
      expect(first.values[name]).toMatch(/^[0-9a-f]{64}$/)
      expect(first.values[name]).not.toBe(second.values[name])
    }
    expect(new Set(Object.values(first.values)).size).toBe(RUNTIME_SECRET_NAMES.length)
    // The signing key's kid and public half come from the private half
    const signer = parseSigningKey(first.values.TENANT_SIGNING_KEY, "TENANT_SIGNING_KEY")
    expect(signer.kid).toBe(first.signing.kid)
    expect([...parsePublicKeys(first.signing.public_key, "K").keys()]).toEqual([signer.kid])
  })

  it("seals the set to the escrow recipients: a test identity opens it, the text is not there", async () => {
    const { identity, recipient } = await makeTestIdentity()
    const secrets = generateRuntimeSecrets()

    const sealed = await sealRuntimeSecrets("ten_A", secrets, [recipient])
    const opened = JSON.parse(await openWithTestIdentity(sealed, identity)) as {
      format: string
      tenant_id: string
      kid: string
      secrets: Record<string, string>
    }

    expect(opened).toMatchObject({
      format: "qt-runtime-secrets-v1",
      tenant_id: "ten_A",
      kid: secrets.signing.kid,
      secrets: secrets.values,
    })
    for (const value of Object.values(secrets.values)) {
      expect(sealed).not.toContain(value)
    }
    const other = await makeTestIdentity()
    await expect(openWithTestIdentity(sealed, other.identity)).rejects.toThrow()
  })

  it("reads the recipients from CP_ESCROW_RECIPIENTS", () => {
    expect(escrowRecipients().length).toBeGreaterThan(0)
  })

  it("gives the control plane no way to open an escrow: no identity, no decrypter", () => {
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8")

      expect([file, /AGE-SECRET-KEY-/i.test(source)]).toEqual([file, false])
      expect([file, /testing\/age|Decrypter|addIdentity/.test(source)]).toEqual([file, false])
    }
  })

  it("makes a local recipient whose identity is thrown away (pnpm env:init)", () => {
    const out = execFileSync(process.execPath, [join(REPO, "scripts/age-recipient.mjs")], {
      encoding: "utf8",
    })

    expect(out).toMatch(/^age1[0-9a-z]{58}\n$/)
    expect(out).not.toMatch(/AGE-SECRET-KEY/i)
    expect(parseAgeRecipients(out, "R")).toEqual([out.trim()])
  })
})

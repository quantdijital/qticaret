import { createHash, createHmac } from "node:crypto"
import { ownerInviteLink, shopPanelOrigin } from "../invite-link"
import { localAdminUrlProblem } from "../local/admin-url"
import { shopRedisUrl } from "../local/env-file"
import { SCRAM_VERIFIER, scramVerifier } from "../local/scram"
import { ProvisioningError } from "../provisioner"

/** The C10 security review's fixes that stand on their own (adr/0061 Ek C10). */

const target = { tenant_id: "ten_01ABC", slug: "atolye-bicak", port: 9231, public_keys: "k1,k2" }

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return error instanceof ProvisioningError ? error.code : "other"
  }
  return "none"
}

describe("the owner's link (review M1, I1)", () => {
  const token = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Imludml0ZSJ9.c2lnbmF0dXJl"

  it("builds the link from the shop panel's known origin, never from the shop", () => {
    expect(shopPanelOrigin("local", target, [])).toBe("http://localhost:10231")
    expect(ownerInviteLink("http://localhost:10231", token)).toBe(
      `http://localhost:10231/invite#token=${token}`
    )
    const domains = [
      {
        hostname: "atolye.quantticaret.com",
        kind: "platform_subdomain",
        verification: "verified",
        is_primary: false,
      },
      { hostname: "atolyebicak.com", kind: "custom", verification: "verified", is_primary: true },
      { hostname: "baska.com", kind: "custom", verification: "pending", is_primary: false },
    ] as const
    expect(shopPanelOrigin("docker", target, domains)).toBe("https://atolyebicak.com")
    expect(shopPanelOrigin("docker", target, [domains[0]])).toBe("https://atolye.quantticaret.com")
    expect(codeOf(() => shopPanelOrigin("docker", target, [domains[2]]))).toBe(
      "provisioning.no_panel_host"
    )
  })

  it("refuses a token of any other shape", () => {
    for (const bad of [
      "short",
      `${token}#x`,
      `${token}/evil`,
      "a b".repeat(10),
      "x".repeat(3000),
    ]) {
      expect(codeOf(() => ownerInviteLink("http://localhost:10231", bad))).toBe(
        "provisioning.invite_token_invalid"
      )
    }
  })
})

describe("the role's password (review L2)", () => {
  it("is a SCRAM-SHA-256 verifier that answers RFC 7677's exchange", () => {
    // RFC 7677 §3: user "user", password "pencil"
    const salt = Buffer.from("W22ZaJ0SNY7soEsUEjb6gQ==", "base64")
    const verifier = scramVerifier("pencil", salt, 4096)
    expect(verifier).toMatch(SCRAM_VERIFIER)
    expect(verifier.startsWith("SCRAM-SHA-256$4096:W22ZaJ0SNY7soEsUEjb6gQ==$")).toBe(true)
    const [storedKey = "", serverKey = ""] = (verifier.split("$")[2] ?? "").split(":")
    const authMessage = [
      "n=user,r=rOprNGfwEbeRWgbNEkqO",
      "r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096",
      "c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0",
    ].join(",")
    const hmac = (key: Buffer) => createHmac("sha256", key).update(authMessage).digest()
    // The server's proof, from the stored ServerKey alone
    expect(hmac(Buffer.from(serverKey, "base64")).toString("base64")).toBe(
      "6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4="
    )
    // The client's proof, checked as the server does: from StoredKey, never the password
    const proof = Buffer.from("dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=", "base64")
    const signature = hmac(Buffer.from(storedKey, "base64"))
    const clientKey = Buffer.from(proof.map((byte, i) => byte ^ (signature[i] ?? 0)))
    expect(createHash("sha256").update(clientKey).digest().toString("base64")).toBe(storedKey)
    // A fresh salt each time
    expect(scramVerifier("a".repeat(64))).not.toBe(scramVerifier("a".repeat(64)))
  })
})

describe("the admin URL and the shops' Redis (review L3, L4)", () => {
  it("takes a postgres URL to this machine without a query", () => {
    expect(localAdminUrlProblem("postgres://postgres:pw@localhost:55432/postgres")).toBeNull()
    expect(
      localAdminUrlProblem("postgres://postgres:pw@localhost:55432/postgres?host=db.example.com")
    ).toBe("must have no query string or fragment")
    expect(localAdminUrlProblem("postgres://postgres:pw@db.example.com/postgres")).toBe(
      "must point at a database on this machine"
    )
    expect(localAdminUrlProblem("mysql://localhost/x")).toBe("must be a postgres:// URL")
  })

  it("puts the shops in another logical Redis database than the control plane's", () => {
    expect(shopRedisUrl("redis://localhost:56379")).toBe("redis://localhost:56379/1")
    expect(shopRedisUrl("redis://localhost:56379/0")).toBe("redis://localhost:56379/1")
    expect(shopRedisUrl("redis://localhost:56379/1")).toBe("redis://localhost:56379/2")
  })
})

import { generateKeyPairSync } from "node:crypto"
import { signDocument, signerFromPrivateKey, verifyDocument } from "@qticaret/server-kit"
import {
  SUPPORT_GRANT_PURPOSE,
  TENANT_STATUSES,
  signedSupportGrantSchema,
  supportGrantDocumentSchema,
} from "@qticaret/types/control-plane"
import type { SupportGrantDocument } from "@qticaret/types/control-plane"
import { FLEET_MODULE } from "../../../modules/fleet"
import { PROVISIONING_MODULE } from "../../../modules/provisioning"
import { TENANTS_MODULE } from "../../../modules/tenants"
import type { TenantRecord } from "../../../modules/tenants/types"
import {
  buildSupportGrant,
  encodeSupportGrant,
  issueSupportGrant,
  supportAllowed,
} from "../support-grant"

jest.mock("../../provisioning/provider", () => ({
  provisioner: () => ({ kind: "local" }),
}))

const NOW = Date.UTC(2026, 10, 28, 10, 0, 0)
const OPERATOR = { id: "user_01ABC", name: "Ayşe Yılmaz", role: "operator" as const }
const REASON = "Ürün girişi ve vitrin düzeni için kurulum desteği"

const { privateKey, publicKey } = generateKeyPairSync("ed25519")
const signer = signerFromPrivateKey(privateKey)

const tenant = (status: TenantRecord["status"]): TenantRecord =>
  ({ id: "ten_01SHOP", slug: "bicak", name: "Bıçak", status }) as TenantRecord

const container = (port: number | null, staff: number | null = 1) => ({
  resolve: (name: string) => {
    if (name === FLEET_MODULE) {
      return { latestUsage: () => Promise.resolve(staff === null ? null : { staff }) }
    }
    if (name === PROVISIONING_MODULE) {
      return { portOf: () => Promise.resolve(port) }
    }
    if (name === TENANTS_MODULE) {
      return { domainsOf: () => Promise.resolve([]) }
    }
    throw new Error(`unexpected ${name}`)
  },
})

const decode = (url: string) => {
  const grant = new URLSearchParams(new URL(url).hash.slice(1)).get("grant") ?? ""
  return signedSupportGrantSchema.parse(JSON.parse(Buffer.from(grant, "base64url").toString()))
}

describe("the support grant (adr/0061 Ek 2026-11-28, Karar 7)", () => {
  it("builds a document the contract takes: bound to the shop, the staff member and an hour at most", () => {
    const doc = buildSupportGrant({
      tenantId: "ten_01SHOP",
      operator: OPERATOR,
      reason: `  ${REASON}  `,
      minutes: 60,
      now: NOW,
    })
    expect(supportGrantDocumentSchema.safeParse(doc).success).toBe(true)
    expect(doc).toMatchObject({
      version: 1,
      audience: "shop_panel",
      tenant_id: "ten_01SHOP",
      operator: OPERATOR,
      reason: REASON,
      issued_at: NOW / 1000,
      expires_at: NOW / 1000 + 3600,
    })
    expect(doc.grant_id).toMatch(/^sgr_[A-Za-z0-9_-]{32}$/)
  })

  it("gives every grant its own id (its single-use nonce)", () => {
    const ids = new Set(
      Array.from(
        { length: 20 },
        () =>
          buildSupportGrant({
            tenantId: "ten_01X",
            operator: OPERATOR,
            reason: REASON,
            minutes: 15,
            now: NOW,
          }).grant_id
      )
    )
    expect(ids.size).toBe(20)
  })

  it("keeps a name to one plain line within the contract's bound", () => {
    const doc = buildSupportGrant({
      tenantId: "ten_01X",
      operator: { ...OPERATOR, name: `Ali\u202E\nVeli ${"x".repeat(200)}` },
      reason: REASON,
      minutes: 30,
      now: NOW,
    })
    expect(doc.operator.name.startsWith("Ali Veli")).toBe(true)
    expect(doc.operator.name.length).toBeLessThanOrEqual(100)
  })

  it("refuses what the contract refuses: a short reason, a reason on two lines", () => {
    const build = (reason: string) => () =>
      buildSupportGrant({ tenantId: "ten_01X", operator: OPERATOR, reason, minutes: 15, now: NOW })
    expect(build("kısa")).toThrow()
    expect(build("ilk satır yeterince uzun\nikinci")).toThrow()
  })

  it("lets staff into a running, restricted or suspended shop only", () => {
    expect(TENANT_STATUSES.filter(supportAllowed)).toEqual(["active", "restricted", "suspended"])
  })

  it("warns when the shop's last report counted no staff: its owner has not joined (review H-A)", async () => {
    const issue = (staff: number | null) =>
      issueSupportGrant(container(9200, staff), {
        tenant: tenant("active"),
        operator: OPERATOR,
        reason: REASON,
        minutes: 15,
        now: NOW,
        sign: (doc: SupportGrantDocument) =>
          Promise.resolve(signDocument(SUPPORT_GRANT_PURPOSE, doc, signer)),
      })
    expect((await issue(0)).owner_pending).toBe(true)
    expect((await issue(null)).owner_pending).toBe(false)
  })

  it("signs it so the shop verifies it with the published key, and only as a support grant", async () => {
    const issued = await issueSupportGrant(container(9200), {
      tenant: tenant("active"),
      operator: OPERATOR,
      reason: REASON,
      minutes: 30,
      now: NOW,
      sign: (doc: SupportGrantDocument) =>
        Promise.resolve(signDocument(SUPPORT_GRANT_PURPOSE, doc, signer)),
    })
    expect(issued.url.startsWith("http://localhost:10200/support#grant=")).toBe(true)
    expect(issued.owner_pending).toBe(false)
    expect(issued.expires_at).toBe(new Date(NOW + 30 * 60_000).toISOString())
    const grant = decode(issued.url)
    expect(grant.document.grant_id).toBe(issued.grant_id)
    const keys = (kid: string) => (kid === signer.kid ? publicKey : undefined)
    expect(verifyDocument(SUPPORT_GRANT_PURPOSE, grant.document, grant, keys)).toEqual({
      ok: true,
      kid: signer.kid,
    })
    expect(verifyDocument("plan", grant.document, grant, keys).ok).toBe(false)
    const longer = { ...grant.document, expires_at: grant.document.expires_at + 60 }
    expect(verifyDocument(SUPPORT_GRANT_PURPOSE, longer, grant, keys).ok).toBe(false)
  })

  it("refuses a shop being set up or closed, and one without a panel to open", async () => {
    const sign = () => Promise.resolve(signDocument(SUPPORT_GRANT_PURPOSE, {}, signer))
    for (const status of ["provisioning", "closing", "closed"] as const) {
      await expect(
        issueSupportGrant(container(9200), {
          tenant: tenant(status),
          operator: OPERATOR,
          reason: REASON,
          minutes: 15,
          sign,
        })
      ).rejects.toMatchObject({ message: "cp.support_unavailable" })
    }
    await expect(
      issueSupportGrant(container(null), {
        tenant: tenant("active"),
        operator: OPERATOR,
        reason: REASON,
        minutes: 15,
        sign,
      })
    ).rejects.toMatchObject({ message: "cp.support_no_panel" })
  })

  it("encodes the grant as base64url of its JSON, no padding", () => {
    const encoded = encodeSupportGrant({
      document: buildSupportGrant({
        tenantId: "ten_01X",
        operator: OPERATOR,
        reason: REASON,
        minutes: 15,
        now: NOW,
      }),
      kid: "0123456789abcdef",
      signature: "a".repeat(86),
    })
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

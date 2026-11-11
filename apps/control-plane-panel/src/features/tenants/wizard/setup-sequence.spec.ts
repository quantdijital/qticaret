import { describe, expect, it } from "vitest"
import { ApiError } from "@/lib/api"
import { filledDraft } from "@/test/wizard"
import type { ShopDraft } from "./draft"
import { failedParts, isComplete, plannedProgress, runSetup } from "./setup-sequence"
import type { SetupCalls } from "./setup-sequence"

/** Calls that answer as the control plane would, each recorded; `fail` names one that refuses. */
function fakeCalls(fail: Partial<Record<keyof SetupCalls | "contact:billing", Error>> = {}) {
  const made: string[] = []
  const bodies: Record<string, unknown> = {}
  const answer = (name: string, body: unknown) => {
    made.push(name)
    bodies[name] = body
    const refusal = fail[name as keyof typeof fail]
    return refusal ? Promise.reject(refusal) : Promise.resolve({})
  }
  const calls: SetupCalls = {
    createTenant: async (input) => {
      await answer("createTenant", input)
      return { id: "ten_new" }
    },
    saveCompany: (_id, input) => answer("saveCompany", input),
    saveContact: (_id, input) => answer(`contact:${input.role}`, input),
    addDomain: (_id, hostname) => answer("addDomain", hostname),
    startProvisioning: (id) => answer("startProvisioning", id),
  }
  return { calls, made, bodies }
}

const withExtras = (): ShopDraft => {
  const draft = filledDraft()
  return {
    ...draft,
    company: { ...draft.company, kind: "sole_proprietor", tax_number: "", tckn: "100 0000 0146" },
    billing: { name: "Mehmet Kaya", email: "fatura@bicak.com", phone: "", enabled: true },
    custom_domain: "Bicak.com",
  }
}

describe("Kur: the record, its details, then the setup (C11)", () => {
  it("makes everything in order and starts the setup last", async () => {
    const { calls, made, bodies } = fakeCalls()
    const seen: string[] = []

    const end = await runSetup(withExtras(), calls, plannedProgress(withExtras()), (progress) => {
      seen.push(
        Object.entries(progress.parts)
          .filter(([, part]) => part.state === "running")
          .map(([name]) => name)
          .join()
      )
    })

    expect(made).toEqual([
      "createTenant",
      "saveCompany",
      "contact:owner",
      "contact:billing",
      "addDomain",
      "startProvisioning",
    ])
    expect(isComplete(end)).toBe(true)
    expect(end.tenantId).toBe("ten_new")
    expect(seen.filter(Boolean)).toEqual([
      "record",
      "company",
      "owner",
      "billing",
      "domain",
      "provisioning",
    ])
    expect(bodies["createTenant"]).toEqual({
      name: "Bıçak Atölyesi",
      slug: "bicak-atolyesi",
      package_id: "pkg_pro",
      sector_pack: "general",
    })
    // The TCKN once, without spaces; a sole proprietor sends no VKN
    expect(bodies["saveCompany"]).toMatchObject({ kind: "sole_proprietor", tckn: "10000000146" })
    // A separate billing contact takes the reminders from the owner
    expect(bodies["contact:owner"]).toMatchObject({ role: "owner", is_primary_billing: false })
    expect(bodies["contact:billing"]).toMatchObject({ role: "billing", is_primary_billing: true })
    expect(bodies["addDomain"]).toBe("bicak.com")
  })

  it("skips what was not asked for: no company sent for a blank one, the owner billed", async () => {
    const draft = filledDraft()
    const blank: ShopDraft = { ...draft, company: { ...emptyCompany(draft) } }
    const { calls, made, bodies } = fakeCalls()

    const end = await runSetup(blank, calls, plannedProgress(blank), () => undefined)

    expect(made).toEqual(["createTenant", "contact:owner", "startProvisioning"])
    expect(bodies["contact:owner"]).toMatchObject({ is_primary_billing: true })
    expect(end.parts.company.state).toBe("skipped")
    expect(isComplete(end)).toBe(true)
  })

  it("stops at once when the record is refused: nothing else is sent", async () => {
    const { calls, made } = fakeCalls({ createTenant: new ApiError(422, "cp.slug_taken", null) })

    const end = await runSetup(
      filledDraft(),
      calls,
      plannedProgress(filledDraft()),
      () => undefined
    )

    expect(made).toEqual(["createTenant"])
    expect(end.tenantId).toBeNull()
    expect(failedParts(end)).toEqual(["record"])
  })

  it("keeps the record and the other saves when one fails, and does not start the setup", async () => {
    const { calls, made } = fakeCalls({ addDomain: new ApiError(422, "cp.domain_taken", null) })

    const end = await runSetup(withExtras(), calls, plannedProgress(withExtras()), () => undefined)

    expect(made).toEqual([
      "createTenant",
      "saveCompany",
      "contact:owner",
      "contact:billing",
      "addDomain",
    ])
    expect(end.tenantId).toBe("ten_new")
    expect(failedParts(end)).toEqual(["domain"])
    expect(end.parts.provisioning.state).toBe("waiting")
    expect(isComplete(end)).toBe(false)
  })

  it("tries again only what is not done, then starts the setup", async () => {
    const first = fakeCalls({ "contact:billing": new ApiError(400, "cp.email_invalid", null) })
    const partial = await runSetup(
      withExtras(),
      first.calls,
      plannedProgress(withExtras()),
      () => undefined
    )
    const again = fakeCalls()

    const end = await runSetup(withExtras(), again.calls, partial, () => undefined)

    expect(failedParts(partial)).toEqual(["billing"])
    expect(again.made).toEqual(["contact:billing", "startProvisioning"])
    expect(isComplete(end)).toBe(true)
  })
})

function emptyCompany(draft: ShopDraft): ShopDraft["company"] {
  return {
    ...draft.company,
    legal_name: "",
    tax_number: "",
    tax_office: "",
    tckn: "",
    address_line: "",
    district: "",
    city: "",
    postal_code: "",
  }
}

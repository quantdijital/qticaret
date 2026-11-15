import {
  allows,
  desiredGroups,
  hasPriceSource,
  inviteCutoff,
  inviteExpiresAt,
  isInviteLive,
  membershipPlan,
  namesToFill,
  normalizeEmail,
  splitContactName,
} from ".."

const at = (iso: string) => new Date(iso)

describe("a wholesaler's invitation (ADR-0068 §10, decision 13)", () => {
  const sent = at("2026-11-15T10:00:00.000Z")

  it("lasts 90 days from its send, a resend counting from the resend", () => {
    expect(inviteExpiresAt(sent).toISOString()).toBe("2027-02-13T10:00:00.000Z")
    expect(isInviteLive(sent, at("2027-02-13T09:59:59.000Z"))).toBe(true)
    expect(isInviteLive(sent, at("2027-02-13T10:00:00.000Z"))).toBe(false)
    expect(isInviteLive(null, sent)).toBe(false)
    expect(isInviteLive(sent.toISOString(), at("2026-12-01T00:00:00.000Z"))).toBe(true)
  })

  it("is past its days once sent before the cut-off", () => {
    const now = at("2027-02-13T10:00:00.001Z")
    expect(sent < inviteCutoff(now)).toBe(true)
    expect(sent < inviteCutoff(at("2027-02-13T09:00:00.000Z"))).toBe(false)
  })

  it("keeps and matches addresses trimmed and in lower case", () => {
    expect(normalizeEmail("  Toptan@Firma.COM ")).toBe("toptan@firma.com")
  })
})

describe("names handed to the customer record (ADR-0068 §1)", () => {
  it("splits a contact's name at the last word", () => {
    expect(splitContactName("Ayşe Nur Yılmaz")).toEqual({
      first_name: "Ayşe Nur",
      last_name: "Yılmaz",
    })
    expect(splitContactName(" Mehmet ")).toEqual({ first_name: "Mehmet", last_name: null })
    expect(splitContactName(null)).toEqual({ first_name: null, last_name: null })
  })

  it("fills only what the customer left blank, never their own words", () => {
    const account = { company_name: "Bıçakçı Ltd", contact_name: "Ali Kaya" }
    expect(namesToFill({ first_name: null, last_name: null, company_name: null }, account)).toEqual(
      { company_name: "Bıçakçı Ltd", first_name: "Ali", last_name: "Kaya" }
    )
    expect(
      namesToFill({ first_name: "Veli", last_name: null, company_name: " " }, account)
    ).toEqual({ company_name: "Bıçakçı Ltd" })
    expect(
      namesToFill(
        { first_name: "Veli", last_name: "Ak", company_name: "Ak AŞ" },
        { company_name: null, contact_name: null }
      )
    ).toEqual({})
  })
})

describe("the groups a wholesaler's customer is in (ADR-0068 §2, §3)", () => {
  const wholesale = new Set(["grp_level_a", "grp_level_b", "grp_own", "grp_other_own"])
  const segments = new Set(["grp_segment"])

  it("is its level's and its own while active, none otherwise", () => {
    const groups = { tierGroupId: "grp_level_a", privateGroupId: "grp_own" }
    expect(desiredGroups({ status: "active", ...groups })).toEqual(["grp_level_a", "grp_own"])
    expect(desiredGroups({ status: "inactive", ...groups })).toEqual([])
    expect(desiredGroups({ status: "pending", ...groups })).toEqual([])
    expect(
      desiredGroups({ status: "active", tierGroupId: null, privateGroupId: "grp_own" })
    ).toEqual(["grp_own"])
  })

  it("joins the new level and leaves the old one, keeping the customer's other groups", () => {
    expect(
      membershipPlan({
        current: ["grp_level_a", "grp_own", "grp_vip"],
        wholesale,
        segments,
        desired: ["grp_level_b", "grp_own"],
      })
    ).toEqual({ add: ["grp_level_b"], remove: ["grp_level_a"] })
  })

  it("leaves every wholesale group once closed, and stays in the segments then", () => {
    expect(
      membershipPlan({
        current: ["grp_level_a", "grp_own", "grp_segment", "grp_vip"],
        wholesale,
        segments,
        desired: [],
      })
    ).toEqual({ add: [], remove: ["grp_level_a", "grp_own"] })
  })

  it("takes an active wholesaler out of the segments' groups (Ek 2026-11-15 4)", () => {
    expect(
      membershipPlan({
        current: ["grp_segment", "grp_other_own"],
        wholesale,
        segments,
        desired: ["grp_level_a"],
      })
    ).toEqual({ add: ["grp_level_a"], remove: ["grp_other_own", "grp_segment"] })
  })

  it("changes nothing when the groups already fit, so a second run is harmless", () => {
    expect(
      membershipPlan({
        current: ["grp_level_a", "grp_own"],
        wholesale,
        segments,
        desired: ["grp_level_a", "grp_own"],
      })
    ).toEqual({ add: [], remove: [] })
  })
})

describe("what each state allows (ADR-0068 §3)", () => {
  it("closes an active one, reopens a closed one, resends and takes back a pending one", () => {
    expect(allows("deactivate", "active")).toBe(true)
    expect(allows("deactivate", "pending")).toBe(false)
    expect(allows("deactivate", "inactive")).toBe(false)
    expect(allows("reactivate", "inactive")).toBe(true)
    expect(allows("reactivate", "active")).toBe(false)
    expect(allows("resend", "pending")).toBe(true)
    expect(allows("resend", "active")).toBe(false)
    expect(allows("delete", "pending")).toBe(true)
    expect(allows("delete", "active")).toBe(false)
    expect(allows("delete", "inactive")).toBe(false)
  })

  it("keeps a level or an own list: never neither", () => {
    expect(hasPriceSource({ tier_id: "wtier_1", private_price_list_id: null })).toBe(true)
    expect(hasPriceSource({ tier_id: null, private_price_list_id: "plist_1" })).toBe(true)
    expect(hasPriceSource({ tier_id: null, private_price_list_id: null })).toBe(false)
  })
})

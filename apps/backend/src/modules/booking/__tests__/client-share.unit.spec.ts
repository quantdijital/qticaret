import {
  CLIENT_CARTS_PER_SLOT,
  CLIENT_LIVE_UNITS,
  clientLockKey,
  clientShareCap,
  clientSlotCap,
} from "../client-share"

const units = (entries: [string, number][] = []) => new Map(entries)

describe("one address's share of live holds (adr/0076 Ek takip M1)", () => {
  it("lets a change through while the address stays inside its share", () => {
    expect(clientShareCap(units(), units(), [{ slotId: "s1", units: 10 }], 10)).toBeNull()
    expect(clientShareCap(units(), units([["s1", 4]]), [{ slotId: "s1", units: 6 }], 10)).toBeNull()
  })

  it("refuses a second cart of the address going past the departure's share", () => {
    // Another cart of the address keeps 6 of a share of 10: this one may set 4 at most
    expect(clientShareCap(units(), units([["s1", 6]]), [{ slotId: "s1", units: 5 }], 10)).toBe(4)
    // All taken by the other cart: nothing more
    expect(clientShareCap(units(), units([["s1", 10]]), [{ slotId: "s1", units: 1 }], 10)).toBe(0)
  })

  it("never refuses lowering or keeping, even past the share", () => {
    const own = units([["s1", 8]])
    const others = units([["s1", 6]])
    expect(clientShareCap(own, others, [{ slotId: "s1", units: 8 }], 10)).toBeNull()
    expect(clientShareCap(own, others, [{ slotId: "s1", units: 3 }], 10)).toBeNull()
    expect(clientShareCap(own, others, [{ slotId: "s1", units: 0 }], 10)).toBeNull()
  })

  it("caps the address's live places over every departure", () => {
    const others = units(
      Array.from({ length: 5 }, (_, index): [string, number] => [`o${String(index)}`, 10])
    )
    // 50 held elsewhere: 10 more fit, 11 do not
    expect(clientShareCap(units(), others, [{ slotId: "s1", units: 10 }], 20)).toBeNull()
    expect(clientShareCap(units(), others, [{ slotId: "s1", units: 12 }], 20)).toBe(10)
    // The cart's own other departures count too
    expect(clientShareCap(units([["s2", 5]]), others, [{ slotId: "s1", units: 10 }], 20)).toBe(5)
    expect(CLIENT_LIVE_UNITS).toBe(60)
  })

  it("counts the slot it raises against what it held there before", () => {
    // The cart held 3, raises to 5 under a share of 10 with 6 held by another cart: 4 at most
    expect(
      clientShareCap(units([["s1", 3]]), units([["s1", 6]]), [{ slotId: "s1", units: 5 }], 10)
    ).toBe(4)
    // Never told less than it keeps already
    expect(
      clientShareCap(units([["s1", 5]]), units([["s1", 6]]), [{ slotId: "s1", units: 7 }], 10)
    ).toBe(5)
  })

  it("lets one address keep a few carts' shares of a departure, never past its places", () => {
    expect(CLIENT_CARTS_PER_SLOT).toBe(3)
    // A share of 10 on a departure of 50: three families behind one address
    expect(clientSlotCap(50, 10)).toBe(30)
    // A share of 10 on a departure of 20: the departure, never more
    expect(clientSlotCap(20, 10)).toBe(20)
    // A third cart of the address fits under 30; a fourth does not
    expect(
      clientShareCap(units(), units([["s1", 20]]), [{ slotId: "s1", units: 10 }], 30)
    ).toBeNull()
    expect(clientShareCap(units(), units([["s1", 30]]), [{ slotId: "s1", units: 1 }], 30)).toBe(0)
  })

  it("locks one key per address, the hash and never more", () => {
    expect(clientLockKey("ab12")).toBe("booking:client:ab12")
  })
})

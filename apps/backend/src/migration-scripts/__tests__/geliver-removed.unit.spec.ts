import { removeRetiredCarrier } from "../geliver-removed"
import type { RetiredCarrierPorts } from "../geliver-removed"

function ports(found: {
  options: string[]
  locations: string[]
  account: boolean
  openReturns?: number
}) {
  return {
    listOptionIds: jest.fn(async () => Promise.resolve(found.options)),
    deleteOptions: jest.fn(async () => Promise.resolve()),
    listLinkedLocations: jest.fn(async () => Promise.resolve(found.locations)),
    unlinkLocations: jest.fn(async () => Promise.resolve()),
    hasAccount: jest.fn(async () => Promise.resolve(found.account)),
    deleteAccount: jest.fn(async () => Promise.resolve()),
    countOpenCarrierReturns: jest.fn(async () => Promise.resolve(found.openReturns ?? 0)),
  } satisfies RetiredCarrierPorts
}

describe("the removed carrier's leftovers (adr/0031 Ek 2026-11-26 migration script)", () => {
  it("deletes its options, unlinks its warehouses, deletes the account and counts open returns", async () => {
    const fake = ports({
      options: ["so_1", "so_2"],
      locations: ["sloc_1"],
      account: true,
      openReturns: 2,
    })

    expect(await removeRetiredCarrier(fake)).toEqual({
      options: 2,
      locations: 1,
      accounts: 1,
      open_returns: 2,
    })
    expect(fake.deleteOptions).toHaveBeenCalledWith(["so_1", "so_2"])
    expect(fake.unlinkLocations).toHaveBeenCalledWith(["sloc_1"])
    expect(fake.deleteAccount).toHaveBeenCalledTimes(1)
  })

  it("changes nothing when nothing is left: a second run is harmless", async () => {
    const fake = ports({ options: [], locations: [], account: false })

    expect(await removeRetiredCarrier(fake)).toEqual({
      options: 0,
      locations: 0,
      accounts: 0,
      open_returns: 0,
    })
    expect(fake.deleteOptions).not.toHaveBeenCalled()
    expect(fake.unlinkLocations).not.toHaveBeenCalled()
    expect(fake.deleteAccount).not.toHaveBeenCalled()
  })
})

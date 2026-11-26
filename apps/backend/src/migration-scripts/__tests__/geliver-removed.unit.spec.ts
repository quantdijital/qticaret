import { removeRetiredCarrier } from "../geliver-removed"
import type { RetiredCarrierPorts } from "../geliver-removed"

function ports(found: { options: string[]; locations: string[]; accounts: string[] }) {
  return {
    listOptionIds: jest.fn(async () => Promise.resolve(found.options)),
    deleteOptions: jest.fn(async () => Promise.resolve()),
    listLinkedLocations: jest.fn(async () => Promise.resolve(found.locations)),
    unlinkLocations: jest.fn(async () => Promise.resolve()),
    listAccountIds: jest.fn(async () => Promise.resolve(found.accounts)),
    deleteAccounts: jest.fn(async () => Promise.resolve()),
  } satisfies RetiredCarrierPorts
}

describe("the removed carrier's leftovers (adr/0031 Ek 2026-11-26 migration script)", () => {
  it("deletes its options, unlinks its warehouses and deletes the stored account", async () => {
    const fake = ports({ options: ["so_1", "so_2"], locations: ["sloc_1"], accounts: ["icred_1"] })

    expect(await removeRetiredCarrier(fake)).toEqual({ options: 2, locations: 1, accounts: 1 })
    expect(fake.deleteOptions).toHaveBeenCalledWith(["so_1", "so_2"])
    expect(fake.unlinkLocations).toHaveBeenCalledWith(["sloc_1"])
    expect(fake.deleteAccounts).toHaveBeenCalledWith(["icred_1"])
  })

  it("changes nothing when nothing is left: a second run is harmless", async () => {
    const fake = ports({ options: [], locations: [], accounts: [] })

    expect(await removeRetiredCarrier(fake)).toEqual({ options: 0, locations: 0, accounts: 0 })
    expect(fake.deleteOptions).not.toHaveBeenCalled()
    expect(fake.unlinkLocations).not.toHaveBeenCalled()
    expect(fake.deleteAccounts).not.toHaveBeenCalled()
  })
})

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import { wholesaleListsState } from "../lists-status"

function containerWith(lists: { id: string; status: string; updated_at: Date | null }[]) {
  const wholesale = {
    ownedIds: () => Promise.resolve({ priceListIds: new Set(["plist_b", "plist_a"]) }),
  }
  const query = { graph: jest.fn().mockResolvedValue({ data: lists }) }
  const container = {
    resolve: (key: string) =>
      key === WHOLESALE_MODULE ? wholesale : key === ContainerRegistrationKeys.QUERY ? query : null,
  } as unknown as MedusaContainer
  return { container, query }
}

describe("wholesaleListsState (M1)", () => {
  it("changes when a list was written again, even with the same status (off and on in one pass)", async () => {
    const before = containerWith([
      { id: "plist_a", status: "active", updated_at: new Date("2026-11-16T10:00:00.100Z") },
    ])
    const after = containerWith([
      { id: "plist_a", status: "active", updated_at: new Date("2026-11-16T10:00:00.900Z") },
    ])

    expect(await wholesaleListsState(before.container)).not.toBe(
      await wholesaleListsState(after.container)
    )
    expect(before.query.graph).toHaveBeenCalledWith({
      entity: "price_list",
      fields: ["id", "status", "updated_at"],
      filters: { id: ["plist_b", "plist_a"] },
    })
  })

  it("reads the same for the same lists, whatever order they come in", async () => {
    const at = new Date("2026-11-16T10:00:00Z")
    const one = containerWith([
      { id: "plist_a", status: "active", updated_at: at },
      { id: "plist_b", status: "draft", updated_at: at },
    ])
    const two = containerWith([
      { id: "plist_b", status: "draft", updated_at: at },
      { id: "plist_a", status: "active", updated_at: at },
    ])

    expect(await wholesaleListsState(one.container)).toBe(await wholesaleListsState(two.container))
  })
})

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { provenCustomer } from "../../account/proven-customer"
import { guestOrdersToAttach } from "../attach-guest-orders"

jest.mock("../../account/proven-customer", () => ({ provenCustomer: jest.fn() }))

const proven = provenCustomer as jest.MockedFunction<typeof provenCustomer>

interface Graph {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

/** A container whose query answers the account read, then the guests' read. */
function container(
  account: { email: string | null; has_account: boolean } | null,
  guests: { id: string; orders?: ({ id: string } | null)[] | null }[] = []
) {
  const graph = jest.fn((input: Graph) =>
    Promise.resolve({
      data: input.filters["has_account"] === false ? guests : account ? [account] : [],
    })
  )
  return {
    graph,
    container: {
      resolve: (key: string) => {
        if (key !== ContainerRegistrationKeys.QUERY) {
          throw new Error(`unexpected ${key}`)
        }
        return { graph }
      },
    },
  }
}

const member = { email: "ali_veli@example.com", has_account: true }
const guests = [
  { id: "cus_guest", orders: [{ id: "order_1" }, null, { id: "order_2" }] },
  { id: "cus_other_guest", orders: null },
]

beforeEach(() => {
  jest.clearAllMocks()
})

/** Security review of PR #73: a guest's orders join an account only on proof of the address. */
describe("the guest orders an account takes", () => {
  it("takes the address's guest orders for a customer who proved it", async () => {
    proven.mockResolvedValue(true)
    const { container: scope, graph } = container(member, guests)

    expect(await guestOrdersToAttach(scope, "cus_1")).toEqual([
      { id: "order_1", customer_id: "cus_guest" },
      { id: "order_2", customer_id: "cus_guest" },
    ])
    expect(proven).toHaveBeenCalledWith(scope, "cus_1")
    // `_` is a wildcard to ILIKE: the address is read literally
    expect(graph.mock.calls[1]?.[0].filters).toEqual({
      email: { $ilike: "ali\\_veli@example.com" },
      has_account: false,
    })
  })

  it("takes nothing for an account that never proved its address", async () => {
    proven.mockResolvedValue(false)
    const { container: scope } = container(member, guests)

    expect(await guestOrdersToAttach(scope, "cus_1")).toEqual([])
  })

  it("asks for no proof when there is nothing to take", async () => {
    const { container: scope } = container(member, [{ id: "cus_guest", orders: [] }])

    expect(await guestOrdersToAttach(scope, "cus_1")).toEqual([])
    expect(proven).not.toHaveBeenCalled()
  })

  it("takes nothing for a guest record, one without an address, or no customer", async () => {
    for (const account of [
      { email: "ali@example.com", has_account: false },
      { email: null, has_account: true },
      null,
    ]) {
      const { container: scope, graph } = container(account, guests)
      expect(await guestOrdersToAttach(scope, "cus_1")).toEqual([])
      expect(graph).toHaveBeenCalledTimes(1)
    }
    expect(proven).not.toHaveBeenCalled()
  })
})

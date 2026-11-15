import type { MedusaContainer } from "@medusajs/framework/types"
import type { AsyncJobRecord } from "../../../modules/async-job/service"
import { activeWholesalers } from "../../wholesale/accounts/wholesalers"
import { wholesaleListsState } from "../../wholesale/lists-status"
import { repriceCustomerCarts } from "../../wholesale/steps/carts"
import { wholesaleCarts } from "../types/wholesale-carts"

jest.mock("../../wholesale/accounts/wholesalers", () => ({ activeWholesalers: jest.fn() }))
jest.mock("../../wholesale/lists-status", () => ({ wholesaleListsState: jest.fn() }))
jest.mock("../../wholesale/steps/carts", () => ({ repriceCustomerCarts: jest.fn() }))

const wholesalers = activeWholesalers as jest.MockedFunction<typeof activeWholesalers>
const state = wholesaleListsState as jest.MockedFunction<typeof wholesaleListsState>
const reprice = repriceCustomerCarts as jest.MockedFunction<typeof repriceCustomerCarts>

const run = () =>
  wholesaleCarts.execute(
    {
      container: {} as MedusaContainer,
      job: { id: "job_1", requested_by: null } as AsyncJobRecord,
      progress: jest.fn().mockResolvedValue(undefined),
      resultFile: jest.fn(),
    },
    {}
  )

beforeEach(() => {
  jest.resetAllMocks()
  wholesalers.mockResolvedValue(new Set(["cus_1", "cus_2"]))
  reprice.mockResolvedValue({ repriced: 1, failed: 0 })
})

describe("the wholesale carts job (security review M2)", () => {
  it("prices every wholesaler's carts once while the flag stands still", async () => {
    state.mockResolvedValue("plist_1:active")

    await expect(run()).resolves.toEqual({
      summary: { wholesalers: 2, repriced: 2, failed: 0 },
    })
    expect(reprice).toHaveBeenCalledTimes(2)
  })

  it("prices them again when the flag turned during its pass (a second change queues nothing)", async () => {
    state
      .mockResolvedValueOnce("plist_1:draft")
      .mockResolvedValueOnce("plist_1:active")
      .mockResolvedValue("plist_1:active")

    await expect(run()).resolves.toEqual({
      summary: { wholesalers: 2, repriced: 2, failed: 0 },
    })
    expect(reprice).toHaveBeenCalledTimes(4)
  })

  it("stops after a few rounds when the flag keeps turning", async () => {
    let turn = 0
    state.mockImplementation(() => Promise.resolve(`plist_1:${String(turn++)}`))

    await run()

    expect(reprice).toHaveBeenCalledTimes(6)
  })
})

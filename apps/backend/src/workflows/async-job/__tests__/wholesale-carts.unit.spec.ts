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

const run = (input: { attempt?: number } = {}) =>
  wholesaleCarts.execute(
    {
      container: {} as MedusaContainer,
      job: { id: "job_1", requested_by: null } as AsyncJobRecord,
      progress: jest.fn().mockResolvedValue(undefined),
      resultFile: jest.fn(),
    },
    input
  )

beforeEach(() => {
  jest.resetAllMocks()
  wholesalers.mockResolvedValue(new Set(["cus_1", "cus_2"]))
  reprice.mockResolvedValue({ repriced: 1, failed: 0 })
})

describe("the wholesale carts job (security review M2)", () => {
  it("prices every wholesaler's carts once while the flag stands still", async () => {
    state.mockResolvedValue("plist_1:active:1000")

    await expect(run()).resolves.toEqual({
      summary: { wholesalers: 2, repriced: 2, failed: 0, settled: true, attempt: 0 },
    })
    expect(reprice).toHaveBeenCalledTimes(2)
  })

  it("prices them again when the flag turned during its pass (a second change queues nothing)", async () => {
    state
      .mockResolvedValueOnce("plist_1:draft:1000")
      .mockResolvedValueOnce("plist_1:active:2000")
      .mockResolvedValue("plist_1:active:2000")

    await expect(run()).resolves.toEqual({
      summary: { wholesalers: 2, repriced: 2, failed: 0, settled: true, attempt: 0 },
    })
    expect(reprice).toHaveBeenCalledTimes(4)
  })

  it("prices them again when the flag went off and back on inside one pass (M1 b)", async () => {
    // The statuses end where they began; the lists' last writes do not
    state
      .mockResolvedValueOnce("plist_1:active:1000")
      .mockResolvedValueOnce("plist_1:active:3000")
      .mockResolvedValue("plist_1:active:3000")

    await expect(run()).resolves.toMatchObject({ summary: { settled: true } })
    expect(reprice).toHaveBeenCalledTimes(4)
  })

  it("stops after three rounds when the lists keep changing, and says it is unsettled (M1 a)", async () => {
    let write = 0
    state.mockImplementation(() => Promise.resolve(`plist_1:active:${String(write++)}`))

    await expect(run({ attempt: 2 })).resolves.toEqual({
      summary: { wholesalers: 2, repriced: 2, failed: 0, settled: false, attempt: 2 },
    })
    expect(reprice).toHaveBeenCalledTimes(6)
  })

  it("takes a re-run's attempt, within the bound", () => {
    expect(wholesaleCarts.input.safeParse({ attempt: 3 }).success).toBe(true)
    expect(wholesaleCarts.input.safeParse({ attempt: 4 }).success).toBe(false)
    expect(wholesaleCarts.input.safeParse({ other: 1 }).success).toBe(false)
  })
})

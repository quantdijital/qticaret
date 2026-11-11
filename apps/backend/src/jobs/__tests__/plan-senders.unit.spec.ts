import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { CONTROL_PLANE_MODULE } from "../../modules/control-plane"
import { DEFAULT_PLAN_STATE } from "../../modules/control-plane/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { dispatchCampaignsWorkflow } from "../../workflows/campaigns/jobs"
import { syncMerchantProductsWorkflow } from "../../workflows/google/merchant"
import { findAbandonedCartsWorkflow } from "../../workflows/marketing/cart-reminders"
import { brandOf } from "../../workflows/messaging/brand"
import campaignDispatch from "../campaign-dispatch"
import cartReminders from "../cart-reminders"
import googleMerchantSync from "../google-merchant-sync"

jest.mock("../../workflows/campaigns/jobs", () => ({ dispatchCampaignsWorkflow: jest.fn() }))
jest.mock("../../workflows/google/merchant", () => ({ syncMerchantProductsWorkflow: jest.fn() }))
jest.mock("../../workflows/marketing/cart-reminders", () => ({
  findAbandonedCartsWorkflow: jest.fn(),
  remindCartWorkflow: jest.fn(),
}))
jest.mock("../../workflows/messaging/brand", () => ({ brandOf: jest.fn() }))

const dispatch = jest.fn()
const sync = jest.fn()
const findCarts = jest.fn()

/** A container whose control plane says `status` (managed), the shop's reminders on. */
function shopIn(status: TenantStatus, managed = true): MedusaContainer {
  const services: Record<string, unknown> = {
    [CONTROL_PLANE_MODULE]: {
      planState: () => Promise.resolve({ ...DEFAULT_PLAN_STATE(managed), status }),
    },
    [PLATFORM_SETTINGS_MODULE]: {
      getSection: () =>
        Promise.resolve({ abandoned_cart_enabled: true, abandoned_cart_delay_minutes: 60 }),
    },
    // The dispatch turn runs under Medusa's lock: here it just runs
    [Modules.LOCKING]: { execute: (_key: string, run: () => Promise<unknown>) => run() },
  }
  return { resolve: (key: string) => services[key] } as unknown as MedusaContainer
}

beforeEach(() => {
  dispatch.mockResolvedValue({ result: { sent: 0, campaign_id: null } })
  sync.mockResolvedValue({ result: {} })
  findCarts.mockResolvedValue({ result: [] })
  jest.mocked(dispatchCampaignsWorkflow).mockReturnValue({ run: dispatch } as never)
  jest.mocked(syncMerchantProductsWorkflow).mockReturnValue({ run: sync } as never)
  jest.mocked(findAbandonedCartsWorkflow).mockReturnValue({ run: findCarts } as never)
  jest.mocked(brandOf).mockResolvedValue({ storefrontUrl: "https://magaza.example" } as never)
})
afterEach(() => {
  jest.clearAllMocks()
})

/** adr/0061 Ek C15, review M1: what goes out in the background while the shop is closed. */
describe("background senders and the shop's status", () => {
  it("sends no bulk message while restricted or suspended; resumes when open", async () => {
    await campaignDispatch(shopIn("restricted"))
    await campaignDispatch(shopIn("suspended"))
    expect(dispatch).not.toHaveBeenCalled()
    await campaignDispatch(shopIn("active"))
    await campaignDispatch(shopIn("suspended", false))
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it("reminds no cart and sends no product to Google while suspended; restricted sells", async () => {
    await cartReminders(shopIn("suspended"))
    await googleMerchantSync(shopIn("suspended"))
    expect(findCarts).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
    for (const status of ["restricted", "active"] as const) {
      await cartReminders(shopIn(status))
      await googleMerchantSync(shopIn(status))
    }
    expect(findCarts).toHaveBeenCalledTimes(2)
    expect(sync).toHaveBeenCalledTimes(2)
  })
})

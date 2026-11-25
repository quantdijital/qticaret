import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { COUNTED_LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { CountedLimitKey, PlanLimits, TenantStatus } from "@qticaret/types/control-plane"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import { doc, signed } from "./control-plane"

// Each document a greater serial than the last, across a file's tests
let serial = 1000

/**
 * The control plane's word on this shop's limits (adr/0061 Ek C14): a
 * signed plan document with these limits, the others unlimited, stored as
 * a push stores it. The shop must be managed (`managedForThisFile`).
 */
export async function setPlanLimits(
  container: MedusaContainer,
  limits: Partial<PlanLimits>
): Promise<void> {
  serial += 1
  // A grant (adr/0085 K5) is never null: left out, none
  const all = Object.fromEntries(COUNTED_LIMIT_KEYS.map((key) => [key, null])) as Record<
    CountedLimitKey,
    null
  >
  await container
    .resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    .storePlanDocument(signed(doc(serial, { limits: { ...all, ...limits } })), "push")
}

/**
 * The control plane's word on this shop's status (adr/0061 Ek C15): a
 * signed plan document saying `status`, no limits, stored as a push
 * stores it. The shop must be managed (`managedForThisFile`).
 */
export async function setPlanStatus(
  container: MedusaContainer,
  status: TenantStatus
): Promise<void> {
  serial += 1
  await container
    .resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    .storePlanDocument(signed(doc(serial, { status })), "push")
}

/** The next serial a pushed document must carry to be applied. */
export const nextSerial = (): number => (serial += 1)

export const productCount = async (container: MedusaContainer): Promise<number> =>
  (await container.resolve(Modules.PRODUCT).listAndCountProducts({}, { take: 1 }))[1]

/** A plan limit refusal's body. */
export interface Refusal {
  message?: string
  code?: string
  limit?: string
  used?: number
  max?: number
}

/** A small product as the panel's form sends it. */
export const productBody = (title: string, salesChannelId: string) => ({
  title,
  sales_channels: [{ id: salesChannelId }],
  options: [{ title: "Boyut", values: ["Standart"] }],
  variants: [
    {
      title: "Standart",
      options: { Boyut: "Standart" },
      manage_inventory: false,
      prices: [{ currency_code: "try", amount: 1000 }],
    },
  ],
})

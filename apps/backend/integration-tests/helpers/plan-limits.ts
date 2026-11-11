import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
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
  const all = Object.fromEntries(LIMIT_KEYS.map((key) => [key, null])) as PlanLimits
  await container
    .resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    .storePlanDocument(signed(doc(serial, { limits: { ...all, ...limits } })), "push")
}

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

/**
 * The setup checklist (docs/17): which steps a new shop needs before it
 * can sell, and how each is judged done. No React or SDK here, so the
 * rules are unit-tested on their own.
 */

/** The name Medusa's store model starts with; bootstrap refuses it (docs/17). */
export const DEFAULT_STORE_NAME = "Medusa Store"

export interface SetupFacts {
  storeName: string | null
  hasDefaultCurrency: boolean
  regionCount: number
  locationCount: number
  shippingOptionCount: number
  /** Card provider accounts connected in Settings > Payment (F5). */
  paymentAccountCount: number
  publishedProductCount: number
}

export type SetupStepKey =
  "storeName" | "currency" | "region" | "location" | "shipping" | "payment" | "product"

export interface SetupStep {
  key: SetupStepKey
  /** The Medusa Admin screen that completes it, until the panel has its own (docs/03 P2). */
  advancedPath: string
  /** The panel's own screen for it, once there is one; preferred over the advanced one. */
  panelPath?: string
  isDone: (facts: SetupFacts) => boolean
}

const isStoreNamed = ({ storeName }: SetupFacts): boolean => {
  const name = storeName?.trim() ?? ""
  return name !== "" && name !== DEFAULT_STORE_NAME
}

export const SETUP_STEPS: readonly SetupStep[] = [
  { key: "storeName", advancedPath: "/settings/store", isDone: isStoreNamed },
  { key: "currency", advancedPath: "/settings/store", isDone: (facts) => facts.hasDefaultCurrency },
  { key: "region", advancedPath: "/settings/regions", isDone: (facts) => facts.regionCount > 0 },
  {
    key: "location",
    advancedPath: "/settings/locations",
    isDone: (facts) => facts.locationCount > 0,
  },
  {
    key: "shipping",
    advancedPath: "/settings/locations",
    isDone: (facts) => facts.shippingOptionCount > 0,
  },
  {
    key: "payment",
    // Medusa's admin has no screen for it: the panel's own is the only one
    advancedPath: "/settings/regions",
    panelPath: "/settings/payments",
    isDone: (facts) => facts.paymentAccountCount > 0,
  },
  {
    key: "product",
    advancedPath: "/products/create",
    panelPath: "/products/new",
    isDone: (facts) => facts.publishedProductCount > 0,
  },
]

export interface SetupStatus {
  steps: { step: SetupStep; isDone: boolean }[]
  doneCount: number
  /** The first open step, offered as the next thing to do; null once all are done. */
  nextKey: SetupStepKey | null
}

export function setupStatus(facts: SetupFacts): SetupStatus {
  const steps = SETUP_STEPS.map((step) => ({ step, isDone: step.isDone(facts) }))
  return {
    steps,
    doneCount: steps.filter((entry) => entry.isDone).length,
    nextKey: steps.find((entry) => !entry.isDone)?.step.key ?? null,
  }
}

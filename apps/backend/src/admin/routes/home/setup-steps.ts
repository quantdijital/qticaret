/**
 * The setup checklist on the home page (docs/17): which steps a new shop
 * needs before it can sell, and how each is judged done. Kept free of React
 * and the SDK so the rules are unit-tested on their own.
 */

/** The name Medusa's store model starts with (store module, v2.21.2); bootstrap keeps it. */
export const DEFAULT_STORE_NAME = "Medusa Store"

/** What the home page reads from the admin API to judge the steps. */
export interface SetupFacts {
  storeName: string | null
  hasDefaultCurrency: boolean
  regionCount: number
  locationCount: number
  shippingOptionCount: number
  publishedProductCount: number
}

export type SetupStepKey = "storeName" | "currency" | "region" | "location" | "shipping" | "product"

export interface SetupStep {
  /** Its texts live under `qticaret.home.setup.steps.<key>`. */
  key: SetupStepKey
  /** The dashboard screen where the step is completed. */
  to: string
  isDone: (facts: SetupFacts) => boolean
}

const isStoreNamed = ({ storeName }: SetupFacts): boolean => {
  const name = storeName?.trim() ?? ""
  return name !== "" && name !== DEFAULT_STORE_NAME
}

/** In the order a newcomer should take them; a shipping option needs a location first. */
export const SETUP_STEPS: readonly SetupStep[] = [
  { key: "storeName", to: "/settings/store", isDone: isStoreNamed },
  { key: "currency", to: "/settings/store", isDone: (facts) => facts.hasDefaultCurrency },
  { key: "region", to: "/settings/regions", isDone: (facts) => facts.regionCount > 0 },
  { key: "location", to: "/settings/locations", isDone: (facts) => facts.locationCount > 0 },
  {
    key: "shipping",
    to: "/settings/locations",
    isDone: (facts) => facts.shippingOptionCount > 0,
  },
  {
    key: "product",
    to: "/products/create",
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

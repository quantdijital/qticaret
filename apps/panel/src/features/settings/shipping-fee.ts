import type {
  NewShippingOption,
  ShopShippingOption,
} from "@/features/settings/api/shipping-options"

/**
 * Settings > Shipping > "Kargo ücreti" (the owner, 2026-11-26: one
 * question, as shops are used to): how the shop's main option is priced,
 * read from and written onto what is stored, nothing of its own beside
 * the option's id. The price itself is still the server's (shippingQuote,
 * adr/0087 §2): this only says which amount and threshold it keeps.
 *
 * - free: the main option at 0 TL, no threshold;
 * - threshold: the main option's flat fee, free from a basket total
 *   (`promotions.free_shipping_threshold`, every option, adr/0087 §2.5);
 * - flat: the main option's flat fee, no threshold;
 * - carrier: the main option priced by the shop's desi table or Geliver's
 *   quote, a threshold optional;
 * - custom: stored data one answer cannot say (a free main option while a
 *   threshold still frees the other, paid ones): the list edits it.
 */
export type FeeMode = "free" | "threshold" | "flat" | "carrier"
export const FEE_MODES: readonly FeeMode[] = ["free", "threshold", "flat", "carrier"]

/** Where a carrier-priced main option's price comes from. */
export const CARRIER_PRICINGS = [
  "aras-table",
  "yurtici-table",
  "geliver-cheapest",
  "geliver-fastest",
  "geliver-table",
] as const
export type CarrierPricing = (typeof CARRIER_PRICINGS)[number]

/** One answer, in lira: the fee (below the threshold, or for every order) and the threshold. */
export interface FeeChoice {
  mode: FeeMode
  fee: number | null
  threshold: number | null
  carrier: CarrierPricing
}

export interface FeeState {
  /** "none": no option to send with yet; the answer makes one. */
  mode: FeeMode | "custom" | "none"
  primary: ShopShippingOption | null
  /** Every option but the main one (all of them while custom). */
  extras: ShopShippingOption[]
  /** The form's first values: what is stored, or a sensible start. */
  choice: FeeChoice
}

const delivers = (option: ShopShippingOption) => option.carrier !== "pickup"
const amountOf = (option: ShopShippingOption) => Number(option.amount ?? 0)

/**
 * The main option: the one saved as main, else the cheapest flat one that
 * delivers (a shop's "standard" is its cheapest), else the first that does.
 */
export function primaryOf(
  options: readonly ShopShippingOption[],
  savedId: string | null | undefined
): ShopShippingOption | null {
  const delivering = options.filter(delivers)
  const saved = delivering.find(({ id }) => id === savedId)
  if (saved) {
    return saved
  }
  const flats = delivering
    .filter(({ pricing }) => pricing === "flat")
    .sort((a, b) => amountOf(a) - amountOf(b) || a.name.localeCompare(b.name, "tr"))
  return flats[0] ?? delivering[0] ?? null
}

/** A carrier-priced option's source, or null for a flat one. */
export function carrierPricingOf(option: ShopShippingOption): CarrierPricing | null {
  if (option.pricing === "flat") {
    return null
  }
  if (option.carrier === "geliver") {
    return `geliver-${option.pricing}`
  }
  if ((option.carrier === "aras" || option.carrier === "yurtici") && option.pricing === "table") {
    return `${option.carrier}-table`
  }
  return null
}

/** What is stored, as the one question's answer. */
export function detectFee(
  options: readonly ShopShippingOption[],
  savedId: string | null | undefined,
  threshold: number | null,
  firstCarrier: CarrierPricing = "aras-table"
): FeeState {
  const primary = primaryOf(options, savedId)
  const extras = options.filter((option) => option !== primary)
  const start: FeeChoice = { mode: "threshold", fee: null, threshold, carrier: firstCarrier }
  if (!primary) {
    return { mode: "none", primary, extras, choice: start }
  }
  const carrier = carrierPricingOf(primary)
  if (carrier) {
    return { mode: "carrier", primary, extras, choice: { ...start, mode: "carrier", carrier } }
  }
  const fee = amountOf(primary)
  if (fee === 0) {
    // A threshold beside a free main option only frees the paid extras: not one answer
    const paidExtra = extras.some(
      (option) => delivers(option) && (option.pricing !== "flat" || amountOf(option) > 0)
    )
    if (threshold !== null && paidExtra) {
      return { mode: "custom", primary, extras: [...options], choice: { ...start, fee: null } }
    }
    return { mode: "free", primary, extras, choice: { ...start, mode: "free", fee: null } }
  }
  const mode = threshold === null ? "flat" : "threshold"
  return { mode, primary, extras, choice: { ...start, mode, fee } }
}

// As the server takes them: a fee up to 100.000 TL, a threshold up to 10.000.000 TL
const MAX_FEE = 100_000
const MAX_THRESHOLD = 10_000_000

/** The fields an answer still needs: "fee", "threshold"; none when it can be saved. */
export function feeErrors(choice: FeeChoice): ("fee" | "threshold")[] {
  const errors: ("fee" | "threshold")[] = []
  const feeOk = choice.fee !== null && choice.fee > 0 && choice.fee <= MAX_FEE
  const thresholdOk =
    choice.threshold !== null && choice.threshold > 0 && choice.threshold <= MAX_THRESHOLD
  if ((choice.mode === "threshold" || choice.mode === "flat") && !feeOk) {
    errors.push("fee")
  }
  if (
    (choice.mode === "threshold" && !thresholdOk) ||
    (choice.mode === "carrier" && choice.threshold !== null && !thresholdOk)
  ) {
    errors.push("threshold")
  }
  return errors
}

/** What saving an answer does to the main option. */
export type FeeOptionStep =
  | { kind: "keep"; id: string }
  | { kind: "update"; id: string; amount: number }
  | { kind: "create"; body: NewShippingOption; replaces: string | null }

export interface FeePlan {
  option: FeeOptionStep
  /** `promotions.free_shipping_threshold` to store. */
  threshold: number | null
}

type FlatCarrier = "manual" | "aras" | "yurtici"
const FLAT_CARRIERS: readonly string[] = ["manual", "aras", "yurtici"]

function carrierBody(name: string, source: CarrierPricing): NewShippingOption {
  const [carrier, kind] = source.split("-") as ["aras" | "yurtici" | "geliver", string]
  return {
    name,
    carrier,
    pricing:
      kind === "table"
        ? { type: "table" }
        : { type: "quote", choice: kind as "cheapest" | "fastest" },
  }
}

/**
 * The steps an answer takes. An option's carrier and pricing kind are fixed
 * once made (the server changes only a name and a flat amount), so a main
 * option of the other kind is replaced: a new one under the same name,
 * the old one removed after (kept as an extra while orders still need it).
 */
export function planFee(
  state: Pick<FeeState, "primary">,
  choice: FeeChoice,
  defaults: { name: string; flatCarrier: FlatCarrier }
): FeePlan {
  const { primary } = state
  const name = primary?.name ?? defaults.name
  const threshold =
    choice.mode === "threshold" || choice.mode === "carrier" ? choice.threshold : null
  if (choice.mode === "carrier") {
    if (primary && carrierPricingOf(primary) === choice.carrier) {
      return { option: { kind: "keep", id: primary.id }, threshold }
    }
    return {
      option: {
        kind: "create",
        body: carrierBody(name, choice.carrier),
        replaces: primary?.id ?? null,
      },
      threshold,
    }
  }
  const amount = choice.mode === "free" ? 0 : (choice.fee ?? 0)
  if (primary?.pricing === "flat") {
    return {
      option:
        amountOf(primary) === amount
          ? { kind: "keep", id: primary.id }
          : { kind: "update", id: primary.id, amount },
      threshold,
    }
  }
  const carrier =
    primary?.carrier && FLAT_CARRIERS.includes(primary.carrier)
      ? (primary.carrier as FlatCarrier)
      : defaults.flatCarrier
  return {
    option: {
      kind: "create",
      body: { name, carrier, pricing: { type: "flat", amount } },
      replaces: primary?.id ?? null,
    },
    threshold,
  }
}

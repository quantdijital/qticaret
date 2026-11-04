import { MedusaError } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../errors"
import { MAX_VAT_RATES, VAT_NAME_MAX, sameVatRate, vatCodeOf, vatNameKey, vatNameOf } from "./vat"

/**
 * What a change to the shop's KDV rates does, decided on what the tax
 * region holds (adr/0007, the owner's KDV screen, 2026-11-04). A removed
 * rate is the tax module's soft-deleted rate: it stays listed as inactive,
 * comes back as it was, and bootstrap never makes it again.
 */

export interface VatRate {
  id: string
  code: string | null
  name: string
  rate: number
  is_default: boolean
  active: boolean
  /** The product type its rule binds it to; null for a rate on none (the starting default). */
  product_type_id: string | null
}

export interface VatType {
  id: string
  value: string
  active: boolean
}

export interface VatState {
  rates: readonly VatRate[]
  types: readonly VatType[]
}

/** A product type to bind a rate to: one standing unbound, or a new one by this name. */
export type VatTypeChoice = { reuse: string } | { create: string }

export interface NewVatRatePlan {
  rate: number
  name: string
  code: string
  type: VatTypeChoice
}

export interface NewVatRateInput {
  rate: number
  name?: string | undefined
  code?: string | undefined
}

const activeRates = (state: VatState) => state.rates.filter((rate) => rate.active)

export function rateOf(state: VatState, id: string): VatRate {
  const rate = state.rates.find((candidate) => candidate.id === id)
  if (!rate) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "vat.rate_unknown")
  }
  return rate
}

const bound = (state: VatState, typeId: string) =>
  state.rates.some((rate) => rate.product_type_id === typeId)

/** An active type by this name; whether it is free to take. */
const typeNamed = (state: VatState, name: string): VatType | undefined =>
  state.types.find((type) => type.active && vatNameKey(type.value) === vatNameKey(name))

/**
 * Another active rate's name, or a product type's: one bound to a rate,
 * or with `anyType` (a rate's own type renamed onto it) any at all.
 */
function refuseTakenName(
  state: VatState,
  name: string,
  except: VatRate | null,
  anyType = false
): void {
  const key = vatNameKey(name)
  const rate = activeRates(state).some(
    (other) => other.id !== except?.id && vatNameKey(other.name) === key
  )
  const type = typeNamed(state, name)
  const typeTaken =
    type !== undefined && type.id !== except?.product_type_id && (anyType || bound(state, type.id))
  if (rate || typeTaken) {
    throw new ConflictError("vat.name_taken")
  }
}

/** The type a rate is bound to by this name: an unbound one of that name, or a new one. */
function typeChoiceFor(state: VatState, name: string): VatTypeChoice {
  const type = typeNamed(state, name)
  return type && !bound(state, type.id) ? { reuse: type.id } : { create: name }
}

function refuseFull(state: VatState): void {
  if (activeRates(state).length >= MAX_VAT_RATES) {
    throw new ValidationError("vat.too_many")
  }
}

function refuseSameRate(state: VatState, rate: number, except: string | null): void {
  if (activeRates(state).some((other) => other.id !== except && sameVatRate(other.rate, rate))) {
    throw new ConflictError("vat.rate_exists")
  }
}

/** The text trimmed; undefined when nothing is left. */
const filled = (text: string | undefined): string | undefined => {
  const trimmed = text?.trim()
  return trimmed === undefined || trimmed === "" ? undefined : trimmed
}

/** A new rate on a product type of its name (`KDV %8,5` and `KDV8_5` unless given). */
export function planNewVatRate(state: VatState, input: NewVatRateInput): NewVatRatePlan {
  refuseFull(state)
  refuseSameRate(state, input.rate, null)
  const name = filled(input.name) ?? vatNameOf(input.rate)
  refuseTakenName(state, name, null)
  const codes = state.rates.map((rate) => rate.code)
  const given = filled(input.code)?.toUpperCase()
  if (given && codes.some((code) => code?.toUpperCase() === given)) {
    throw new ConflictError("vat.code_taken")
  }
  return {
    rate: input.rate,
    name,
    code: given ?? vatCodeOf(input.rate, codes),
    type: typeChoiceFor(state, name),
  }
}

export interface VatRenamePlan {
  rate_id: string
  name: string
  /** Its product type, renamed with it; null for a rate on none. */
  type_id: string | null
}

/** A rate and its product type named anew; null when the name is the same. */
export function planVatRename(state: VatState, id: string, name: string): VatRenamePlan | null {
  const rate = rateOf(state, id)
  const next = name.trim()
  if (!rate.active) {
    throw new ValidationError("vat.rate_inactive")
  }
  if (next === "" || next.length > VAT_NAME_MAX) {
    throw new ValidationError("vat.name_invalid", { field: "name" })
  }
  if (next === rate.name) {
    return null
  }
  const type = state.types.find((candidate) => candidate.id === rate.product_type_id)
  const ownType = type?.active ? type.id : null
  refuseTakenName(state, next, rate, ownType !== null)
  return { rate_id: rate.id, name: next, type_id: ownType }
}

export interface VatRemovalPlan {
  rate_id: string
  /** Its product type, removed with it: no product uses it. */
  type_id: string | null
}

/**
 * A rate taken out of use: never the default, never while a product is on
 * its type (`products`); null when it is out already.
 */
export function planVatRemoval(
  state: VatState,
  id: string,
  products: number
): VatRemovalPlan | null {
  const rate = rateOf(state, id)
  if (!rate.active) {
    return null
  }
  if (rate.is_default) {
    throw new ConflictError("vat.rate_is_default")
  }
  if (products > 0) {
    throw new ConflictError("vat.rate_in_use", { count: products })
  }
  const type = state.types.find((candidate) => candidate.id === rate.product_type_id)
  return { rate_id: rate.id, type_id: type?.active ? type.id : null }
}

export interface VatRestorePlan {
  rate_id: string
  /** Its product type, back with it; null when it stood or there is none. */
  type_id: string | null
}

/** A removed rate back as it was; null when it is in use already. */
export function planVatRestore(state: VatState, id: string): VatRestorePlan | null {
  const rate = rateOf(state, id)
  if (rate.active) {
    return null
  }
  refuseFull(state)
  refuseSameRate(state, rate.rate, rate.id)
  const type = state.types.find((candidate) => candidate.id === rate.product_type_id)
  const typeTaken =
    type !== undefined &&
    !type.active &&
    state.types.some((other) => other.active && vatNameKey(other.value) === vatNameKey(type.value))
  if (typeTaken) {
    throw new ConflictError("vat.name_taken")
  }
  refuseTakenName(state, rate.name, rate)
  const code = rate.code?.toUpperCase()
  if (code && activeRates(state).some((other) => other.code?.toUpperCase() === code)) {
    throw new ConflictError("vat.code_taken")
  }
  return { rate_id: rate.id, type_id: type && !type.active ? type.id : null }
}

export interface VatDefaultPlan {
  /** The default until now; null in a region that had none. */
  from: { id: string; type: VatTypeChoice | null } | null
  to: string
}

/**
 * Another rate made the default: products without a VAT type are taxed at
 * it from now on. The old default stays a rate to choose, on a product
 * type of its name (made when it had none). Null when it is the default.
 */
export function planVatDefault(state: VatState, id: string): VatDefaultPlan | null {
  const target = rateOf(state, id)
  if (!target.active) {
    throw new ValidationError("vat.rate_inactive")
  }
  if (target.is_default) {
    return null
  }
  const current = activeRates(state).find((rate) => rate.is_default)
  if (!current) {
    return { from: null, to: target.id }
  }
  const ownType = state.types.find((type) => type.id === current.product_type_id)
  if (ownType?.active) {
    return { from: { id: current.id, type: null }, to: target.id }
  }
  refuseTakenName(state, current.name, current)
  return { from: { id: current.id, type: typeChoiceFor(state, current.name) }, to: target.id }
}

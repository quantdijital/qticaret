import type { ContractView, PlaceOrderResult } from "./checkout-views"
import type { FormAction } from "./theme"
import type { ImageView, LinkView, PaginationView } from "./views"

/**
 * The customer account's view models (D8). The sign-in forms answer like
 * the checkout's place-order form: an error, or a proof of work to solve
 * and send again (adr/0044).
 */
export type ChallengeResult = PlaceOrderResult

export type AuthMode = "login" | "register" | "forgot" | "reset" | "verify" | "lookup"

export interface AuthPageView {
  mode: AuthMode
  /** A message already in words (a link sent, a password changed…). */
  notice: string | null
  /** The address to fill in, when known (a reset link's, a pending verification's). */
  email: string | null
  /** reset: the link's key; verify: the code from the link. */
  token: string | null
  /** verify: the browser no longer holds the asking login, so the password is asked again. */
  needsPassword: boolean
  /** register: the membership text to accept, when the shop published one. */
  terms: ContractView | null
  /** Where to go after signing in (a path on the shop). */
  next: string | null
  /** register: a migration invite's key from the link (`?davet=`), sent along. */
  invite: string | null
  /** The other forms' addresses (login, register, forgot). */
  links: Record<"login" | "register" | "forgot", string>
}

export type AuthAction = (state: ChallengeResult, form: FormData) => Promise<ChallengeResult>

export interface AuthActions {
  /** Fields: `email`, `password`, `next`, `challenge`. */
  login: AuthAction
  /** Fields: `first_name`, `last_name`, `email`, `phone`, `password`, `accept`, `challenge`. */
  register: AuthAction
  /** Field: `email`. */
  forgot: AuthAction
  /** Fields: `token`, `password`. */
  reset: AuthAction
  /** Fields: `code`, and `email`, `password` when the browser no longer holds the login. */
  verify: AuthAction
  /** "Find my order": `display_id`, `email`, `challenge`; the link goes by e-mail. */
  lookup: AuthAction
}

export type AccountSection = "overview" | "orders" | "profile" | "favorites" | "addresses"

export interface AccountOrderView {
  displayId: string
  placedAt: string
  status: string
  paymentStatus: string
  total: string
  itemCount: number
  path: string
}

export interface AccountPageView {
  section: AccountSection
  name: string
  email: string
  nav: (LinkView & { current: boolean })[]
  notice: string | null
  orders: AccountOrderView[]
  /** The orders' pages (orders section). */
  pagination: PaginationView | null
  /** The customer's saved addresses, in lines (addresses section). */
  addresses: { id: string; name: string; lines: string[] }[]
  /** The customer's saved products (favorites section). */
  favorites: { id: string; title: string; path: string; image: ImageView | null }[]
  /** The customer's KVKK requests, in words (profile section). */
  privacyRequests: { kind: string; status: string; received: string; due: string }[]
  /** The invoice details (F8): who the invoice is for; the tax id shown masked. */
  billing: {
    type: "individual" | "corporate"
    legalName: string
    taxOffice: string
    taxIdMasked: string | null
  } | null
  profile: {
    first_name: string
    last_name: string
    phone: string
    marketingEmail: boolean
    marketingSms: boolean
    marketingVersion: string
  }
}

export interface AccountActions {
  /** A plain form: `id`, the address to drop. */
  removeAddress: (form: FormData) => Promise<void>
  /** A plain form: `kind` (export, erasure), the customer's KVKK request. */
  requestPrivacy: (form: FormData) => Promise<void>
  /** Fields: `type` (individual, corporate), `legal_name`, `tax_office`, `tax_id`. */
  saveBilling: FormAction
  /** A plain form: `id`, the favorite to drop. */
  removeFavorite: (form: FormData) => Promise<void>
  /** Fields: `first_name`, `last_name`, `phone`. */
  saveProfile: FormAction
  /** Fields: `marketing_email`, `marketing_sms`, `marketing_version`. */
  saveConsents: FormAction
  /** A plain form: signs out. */
  logout: (form: FormData) => Promise<void>
}

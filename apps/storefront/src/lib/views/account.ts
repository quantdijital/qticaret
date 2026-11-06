import "server-only"
import type {
  AccountPageView,
  AccountSection,
  AuthMode,
  AuthPageView,
  ContractView,
  Translate,
} from "@qticaret/ui"
import type { StoreCustomer } from "@/lib/account/auth"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { DATE, said } from "./account-shared"
import { displayPhone } from "./frame"
import { MARKETING_TEXT_VERSION } from "./checkout"

export { customerFavorites, startingCategories } from "./account-favorites"
export { customerOrders } from "./account-orders"

export const AUTH_LINKS = {
  login: "/hesap/giris",
  register: "/hesap/kayit",
  forgot: "/hesap/sifre-sifirla",
}

export function authView(
  mode: AuthMode,
  options: Partial<Omit<AuthPageView, "mode" | "links">> = {}
): AuthPageView {
  return {
    mode,
    notice: options.notice ?? null,
    email: options.email ?? null,
    token: options.token ?? null,
    needsPassword: options.needsPassword ?? false,
    terms: options.terms ?? null,
    next: options.next ?? null,
    invite: options.invite ?? null,
    ...(options.privacyPath === undefined ? {} : { privacyPath: options.privacyPath }),
    links: AUTH_LINKS,
  }
}

/** The shop's membership text, when it published one (F13). */
export async function membershipTerms(): Promise<ContractView | null> {
  try {
    const { document } = await storeGet<{ document: ContractView }>("/store/legal/membership")
    return document
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

const SECTIONS: { section: AccountSection; path: string; key: string }[] = [
  { section: "overview", path: "/hesap", key: "account.overview" },
  { section: "orders", path: "/hesap/siparisler", key: "account.orders" },
  { section: "favorites", path: "/hesap/favoriler", key: "account.favorites" },
  { section: "addresses", path: "/hesap/adresler", key: "account.addresses" },
  { section: "profile", path: "/hesap/bilgiler", key: "account.details" },
]

interface ConsentAnswer {
  consents: Record<"email" | "sms", { consent: { status: string } | null }>
}

/** Whether each marketing channel is granted now. */
export async function marketingOf(): Promise<{ email: boolean; sms: boolean }> {
  try {
    const { consents } = await storeGet<ConsentAnswer>("/store/customers/me/consents")
    return {
      email: consents.email.consent?.status === "granted",
      sms: consents.sms.consent?.status === "granted",
    }
  } catch (error) {
    if (isStoreApiError(error)) {
      return { email: false, sms: false }
    }
    throw error
  }
}

export function accountView(
  section: AccountSection,
  customer: StoreCustomer,
  t: Translate,
  rest: Partial<
    Pick<
      AccountPageView,
      | "orders"
      | "pagination"
      | "notice"
      | "favorites"
      | "billing"
      | "privacyRequests"
      | "addresses"
      | "newAddress"
      | "categories"
    >
  > & {
    marketing?: { email: boolean; sms: boolean }
  } = {}
): AccountPageView {
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ")
  return {
    section,
    name: customer.first_name ?? (name !== "" ? name : customer.email),
    email: customer.email,
    nav: SECTIONS.map((each) => ({
      label: t(each.key),
      path: each.path,
      current: each.section === section,
      section: each.section,
    })),
    notice: rest.notice ?? null,
    orders: rest.orders ?? [],
    favorites: rest.favorites ?? [],
    addresses: rest.addresses ?? [],
    newAddress: rest.newAddress ?? null,
    privacyRequests: rest.privacyRequests ?? [],
    billing: rest.billing ?? null,
    pagination: rest.pagination ?? null,
    ...(rest.categories ? { categories: rest.categories } : {}),
    profile: {
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      phone: customer.phone ? displayPhone(customer.phone) : "",
      marketingEmail: rest.marketing?.email ?? false,
      marketingSms: rest.marketing?.sms ?? false,
      marketingVersion: MARKETING_TEXT_VERSION,
    },
  }
}
interface BillingAnswer {
  billing_profile: {
    type: "individual" | "corporate"
    legal_name: string
    tax_office: string | null
    tax_id_masked: string | null
  } | null
}

/** The customer's invoice details, the tax id masked by the backend. */
export async function billingOf(): Promise<AccountPageView["billing"]> {
  try {
    const { billing_profile } = await storeGet<BillingAnswer>("/store/customers/me/billing-profile")
    return billing_profile
      ? {
          type: billing_profile.type,
          legalName: billing_profile.legal_name,
          taxOffice: billing_profile.tax_office ?? "",
          taxIdMasked: billing_profile.tax_id_masked,
        }
      : null
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

interface PrivacyAnswer {
  privacy_requests: { kind: string; status: string; received_at: string; due_at: string }[]
}

/** The customer's KVKK requests, in words. */
export async function privacyRequestsOf(t: Translate): Promise<AccountPageView["privacyRequests"]> {
  try {
    const { privacy_requests } = await storeGet<PrivacyAnswer>(
      "/store/customers/me/privacy-requests"
    )
    return privacy_requests.map((row) => ({
      kind: said(t, "account.privacy_kind_", row.kind),
      status: said(t, "account.privacy_status_", row.status),
      received: DATE.format(new Date(row.received_at)),
      due: DATE.format(new Date(row.due_at)),
    }))
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

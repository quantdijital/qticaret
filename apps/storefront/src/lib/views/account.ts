import "server-only"
import { formatLira } from "@qticaret/ui"
import type {
  AccountOrderView,
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
import { displayPhone } from "./frame"
import { MARKETING_TEXT_VERSION } from "./checkout"

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

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
  { section: "profile", path: "/hesap/bilgiler", key: "account.details" },
]

interface StoreOrderRow {
  id: string
  display_id: number
  created_at: string
  status: string
  payment_status: string
  total: number
  items?: { quantity: number }[]
}

function said(t: Translate, prefix: string, value: string): string {
  const key = `${prefix}${value}`
  const text = t(key)
  return text === key ? value : text
}

/** The customer's orders, newest first, a page at a time. */
export async function customerOrders(
  offset: number,
  limit: number,
  t: Translate
): Promise<{ orders: AccountOrderView[]; count: number }> {
  const { orders, count } = await storeGet<{ orders: StoreOrderRow[]; count: number }>(
    "/store/orders",
    {
      fields: "id,display_id,created_at,status,+payment_status,total,items.quantity",
      order: "-created_at",
      offset,
      limit,
    }
  )
  return {
    count,
    orders: orders.map((order) => ({
      displayId: String(order.display_id),
      placedAt: DATE.format(new Date(order.created_at)),
      status: said(t, "order.status_", order.status),
      paymentStatus: said(t, "order.payment_", order.payment_status),
      total: formatLira(order.total),
      itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
      path: `/siparis/${encodeURIComponent(order.id)}`,
    })),
  }
}

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
  rest: Partial<Pick<AccountPageView, "orders" | "pagination" | "notice">> & {
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
    })),
    notice: rest.notice ?? null,
    orders: rest.orders ?? [],
    pagination: rest.pagination ?? null,
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

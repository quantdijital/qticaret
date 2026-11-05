import "server-only"
import { formatLira } from "@qticaret/ui"
import type {
  AccountOrderView,
  AccountPageView,
  AccountSection,
  AuthMode,
  AuthPageView,
  CategoryCardView,
  ContractView,
  ImageView,
  Translate,
} from "@qticaret/ui"
import type { StoreCustomer } from "@/lib/account/auth"
import { isStoreApiError } from "@/lib/store-api/errors"
import { listProducts, pathsOf } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { categoryTiles } from "./category-tiles"
import { displayPhone } from "./frame"
import { MARKETING_TEXT_VERSION } from "./checkout"
import { orderProgress } from "./order-progress"
import { railCards } from "./section-data"

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

interface StoreOrderRow {
  id: string
  display_id: number
  created_at: string
  status: string
  payment_status: string
  fulfillment_status?: string
  total: number
  items?: { quantity: number; title?: string | null; thumbnail?: string | null }[]
  payment_collections?: { payment_sessions?: { provider_id: string }[] }[]
}

/** An order line's photo as a picture, its title the words. */
const thumbnailOf = (src: string, alt: string): ImageView => ({
  src,
  alt,
  width: null,
  height: null,
  sources: { avif: null, webp: null },
})

/** Up to three of the order's lines' photos, in order (the list's small stack). */
function orderImages(order: StoreOrderRow): ImageView[] {
  return (order.items ?? [])
    .flatMap((item) => (item.thumbnail ? [thumbnailOf(item.thumbnail, item.title ?? "")] : []))
    .slice(0, 3)
}

/** The order page's steps from the row's statuses: no parcel dates in a list. */
function rowProgress(order: StoreOrderRow, t: Translate): AccountOrderView["progress"] {
  if (order.fulfillment_status === undefined) {
    return undefined
  }
  const providers = (order.payment_collections ?? []).flatMap((collection) =>
    (collection.payment_sessions ?? []).map((session) => session.provider_id)
  )
  return orderProgress(
    {
      status: order.status,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      created_at: order.created_at,
    },
    [],
    { cashOnDelivery: providers.includes("pp_cod_cod") },
    t,
    (date) => DATE.format(date)
  )
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
      fields: [
        "id",
        "display_id",
        "created_at",
        "status",
        "+payment_status",
        "+fulfillment_status",
        "total",
        "items.quantity",
        "items.title",
        "items.thumbnail",
        // Only the provider is read (cash on delivery has no payment step)
        "*payment_collections.payment_sessions",
      ].join(","),
      order: "-created_at",
      offset,
      limit,
    }
  )
  return {
    count,
    orders: orders.map((order) => {
      const progress = rowProgress(order, t)
      return {
        displayId: String(order.display_id),
        placedAt: DATE.format(new Date(order.created_at)),
        status: said(t, "order.status_", order.status),
        paymentStatus: said(t, "order.payment_", order.payment_status),
        total: formatLira(order.total),
        itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
        path: `/siparis/${encodeURIComponent(order.id)}`,
        images: orderImages(order),
        ...(progress === undefined ? {} : { progress }),
      }
    }),
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

interface WishlistAnswer {
  items: { id: string; product: { id: string; title: string; thumbnail: string | null } }[]
}

/** Null for a Store API refusal; anything else is a fault and is thrown. */
const quiet = <T>(promise: Promise<T>): Promise<T | null> =>
  promise.catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })

/**
 * The live cards of the saved products on sale here (price, stock, as
 * every rail draws them), by product id; none when the catalogue does not
 * answer: the list then shows names and photos only.
 */
async function favoriteCards(ids: readonly string[]) {
  if (ids.length === 0) {
    return new Map<string, NonNullable<AccountPageView["favorites"][number]["card"]>>()
  }
  const listed = await quiet(listProducts({ limit: ids.length, ids }))
  const cards = await railCards(listed?.products ?? [])
  return new Map(cards.map((card) => [card.id, card]))
}

/** The customer's saved products with their pages and, when on sale, their cards. */
export async function customerFavorites(): Promise<AccountPageView["favorites"]> {
  const { items } = await storeGet<WishlistAnswer>("/store/customers/me/wishlist")
  const ids = items.map((item) => item.product.id)
  const [paths, cards] = await Promise.all([pathsOf("product", ids), favoriteCards(ids)])
  return items.flatMap((item) => {
    const path = paths[item.product.id]
    return path
      ? [
          {
            id: item.id,
            title: item.product.title,
            path,
            image: item.product.thumbnail
              ? thumbnailOf(item.product.thumbnail, item.product.title)
              : null,
            card: cards.get(item.product.id) ?? null,
          },
        ]
      : []
  })
}

/**
 * The shop's top categories as picture tiles, for an empty list to start
 * from; none when the catalogue does not answer.
 */
export async function startingCategories(): Promise<CategoryCardView[]> {
  return (await quiet(categoryTiles([]))) ?? []
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

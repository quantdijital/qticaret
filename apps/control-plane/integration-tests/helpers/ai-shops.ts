import type { MedusaContainer } from "@medusajs/framework/types"
import type { Ed25519Signer } from "@qticaret/server-kit"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { saveAiCreditSettings } from "../../src/lib/ai-credits/platform-settings"
import type { AiPackInput } from "../../src/lib/ai-credits/platform-settings"
import { deleteProviderKey, writeProviderKey } from "../../src/lib/ai-gateway/keys"
import { plansIn, tenantsIn } from "../../src/workflows/modules"
import { packageFor, shopKey, signedGet, signedPost } from "./fleet"
import { anyStatus } from "./staff"
import type { Answer, HttpClient, Member } from "./staff"
import { freshSlug, makeTenant } from "./tenants"

export const CREDITS = "/tenant-api/v1/ai/credits"
export const ORDERS = "/tenant-api/v1/ai/orders"

/** Plainly a test value: never a real provider's key. */
export const TEST_KEY = "test-key-tenant-0123456789abcdef"

export interface AiShop {
  id: string
  signer: Ed25519Signer
}

/**
 * An `active` shop with a signing key, on a package with
 * `ai.platform_credits` as `flag` says and `monthly` free credits.
 */
export async function aiShop(
  http: HttpClient,
  container: MedusaContainer,
  member: Member,
  options: { flag?: boolean; monthly?: number; status?: TenantStatus } = {}
): Promise<AiShop> {
  const tenant = await makeTenant(http, member)
  const tenants = tenantsIn(container)
  await tenants.changeStatus(tenant.id, "active", { reason_code: "provisioned", actor: "system" })
  if (options.status !== undefined && options.status !== "active") {
    await tenants.changeStatus(tenant.id, options.status, { reason_code: "test", actor: "system" })
  }
  const packageId = await packageFor(container, freshSlug("paket"), {
    limits: { products: 500, ai_free_credits_per_month: options.monthly ?? 100 },
    features: { "ai.platform_credits": options.flag ?? true },
  })
  await plansIn(container).assignPlan(tenant.id, packageId, null)
  return { id: tenant.id, signer: await shopKey(container, tenant.id) }
}

/** A pack as the owner's form gives it. */
export const pack = (
  name: string,
  credits: number,
  amount: number,
  active = true
): AiPackInput => ({
  name,
  credits,
  amount,
  active,
})

/** Every capability routed to the fake service and its key held (or not). */
export async function routeAll(
  container: MedusaContainer,
  options: { key?: boolean; packs?: AiPackInput[] } = {}
): Promise<void> {
  await saveAiCreditSettings(
    container,
    {
      routing: {
        text: { service: "fake", model: "fake-text" },
        vision: { service: "fake", model: "fake-vision" },
        image_edit: { service: "fake", model: "fake-image" },
      },
      ...(options.packs === undefined ? {} : { packs: options.packs }),
    },
    "test"
  )
  if (options.key ?? true) {
    await writeProviderKey(container, "fake", TEST_KEY)
  }
}

/** Nothing routed and no key: credits are unavailable to every shop. */
export async function unrouteAll(container: MedusaContainer): Promise<void> {
  await deleteProviderKey(container, "fake", "test")
  await saveAiCreditSettings(container, { routing: {} }, "test")
}

export type Reply = Answer<Record<string, unknown> & { message?: string }>

/** `GET path` signed by `shop` (extra headers added after signing). */
export const getAs = (
  http: HttpClient,
  shop: AiShop,
  path = CREDITS,
  extra: Record<string, string> = {}
): Promise<Reply> =>
  http.get(path, { ...anyStatus, headers: { ...signedGet(path, shop.id, shop.signer), ...extra } })

/** `POST /ai/orders` with this body, signed by `shop` over its exact bytes. */
export const orderAs = (http: HttpClient, shop: AiShop, body: unknown): Promise<Reply> => {
  const raw = JSON.stringify(body)
  return http.post(ORDERS, raw, {
    ...anyStatus,
    headers: signedPost(ORDERS, shop.id, shop.signer, raw),
  })
}

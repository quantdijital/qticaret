import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
import { AI_MODULE } from "../../src/modules/ai"
import type AiModuleService from "../../src/modules/ai/service"
import { CONTENT_DRAFTS_MODULE } from "../../src/modules/content-drafts"
import type ContentDraftsModuleService from "../../src/modules/content-drafts/service"
import { AI_OWN_KEYS } from "../../src/modules/platform-settings/features"
import { doc, signed } from "./control-plane"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { nextSerial } from "./plan-limits"
import { stockShop, stockedProduct } from "./stock"
import { loadTrAddressFixture } from "./tr-address"

/** The AI core's http tests (adr/0071, PR 0b-3): a shop, a product, an ask. */

export interface Suggestion {
  id: string
  task: string
  service: string
  status: string
  text: string | null
  alternatives: string[]
}

export interface AiAnswer {
  suggestion?: Suggestion
  message?: string
  problems?: string[]
  provider?: string
  /** A failed call's other usable services (Info 7). */
  alternatives?: string[]
}

/**
 * The package's word, through the push route (its workflow syncs the
 * flags): the shop's own key open or closed, and limits (others none).
 * The shop must be managed (`managedForThisFile`).
 */
export async function pushPlan(
  http: HttpClient,
  ownKeys: boolean,
  limits: Partial<PlanLimits> = {}
): Promise<void> {
  const all = Object.fromEntries(LIMIT_KEYS.map((name) => [name, null])) as PlanLimits
  const pushed = await settle(
    http.post(
      "/hooks/control-plane/plan",
      signed(
        doc(nextSerial(), {
          limits: { ...all, ...limits },
          platform_flags: { [AI_OWN_KEYS]: ownKeys },
        })
      )
    )
  )
  if (pushed.status !== 200) {
    throw new Error(`plan push answered ${String(pushed.status)}`)
  }
}

/** Connects the fake AI service with a plainly fake key, as the owner does in the panel. */
export async function connectFake(
  http: HttpClient,
  owner: Record<string, string>,
  key: string
): Promise<void> {
  const saved = await settle(
    http.post(
      "/admin/integrations/credentials/fake",
      { settings: {}, secrets: { api_key: key } },
      { headers: owner }
    )
  )
  if (saved.status !== 200) {
    throw new Error(`connecting the fake service answered ${String(saved.status)}`)
  }
}

/** A product with a name and a description; the title can be set to try the gate. */
export async function aiProduct(
  container: MedusaContainer,
  title = "Keten Gömlek Yazlık"
): Promise<string> {
  await loadTrAddressFixture(container)
  const shop = await stockShop(container)
  const { productId } = await stockedProduct(
    container,
    shop,
    `ai-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`,
    3,
    450
  )
  await container.resolve(Modules.PRODUCT).updateProducts(productId, {
    title,
    description: "Yazlık keten gömlek, nefes alan kumaş.",
  })
  return productId
}

export const askFor =
  (http: HttpClient) => (headers: Record<string, string>, body: Record<string, unknown>) =>
    settle(http.post<AiAnswer>("/admin/ai/suggestions", body, { headers }))

export const aiRecords = (container: MedusaContainer) => ({
  usages: () => container.resolve<AiModuleService>(AI_MODULE).listAiUsages({}),
  drafts: () =>
    container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE).listContentDrafts({}),
  monthly: () =>
    container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE).usedThisMonth(),
  today: () => container.resolve<AiModuleService>(AI_MODULE).usedToday("text"),
})

/** Workflow runs whose stored state holds this text (none should). */
export async function storedRunsWith(container: MedusaContainer, text: string): Promise<number> {
  const found: { rows: { count: number }[] } = await container
    .resolve(ContainerRegistrationKeys.PG_CONNECTION)
    .raw(
      "select count(*)::int as count from workflow_execution where execution::text like ? or context::text like ?",
      [`%${text}%`, `%${text}%`]
    )
  return found.rows[0]?.count ?? 0
}

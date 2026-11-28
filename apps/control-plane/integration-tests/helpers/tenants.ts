import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { anyStatus, stepUp } from "./staff"
import type { HttpClient, Member } from "./staff"

/** A slug no other test takes: letters only, under 30 characters. */
export const freshSlug = (stem = "magaza") =>
  `${stem}-${
    randomUUID()
      .replace(/[^a-f]/g, "")
      .slice(0, 8) || "abc"
  }`

/** A valid TCKN and VKN made for the tests (check digits only; no one's). */
export const TEST_TCKN = "10000000146"
export const TEST_VKN = "1234567890"

export function client(http: HttpClient) {
  return {
    get: (path: string, member: Member, headers: Record<string, string> = member.headers) =>
      http.get(path, { ...anyStatus, headers }),
    post: (
      path: string,
      body: unknown,
      member: Member,
      headers: Record<string, string> = member.headers
    ) => http.post(path, body, { ...anyStatus, headers }),
    delete: (path: string, member: Member, headers: Record<string, string> = member.headers) =>
      http.delete(path, { ...anyStatus, headers }),
  }
}

// A proof holds five minutes and is not spent: one per member, renewed before it runs out
const proofs = new WeakMap<Member, { headers: Record<string, string>; until: number }>()

/** The member's headers with a step-up proof (one recovery code per four minutes). */
export async function proved(http: HttpClient, member: Member): Promise<Record<string, string>> {
  const held = proofs.get(member)
  if (held && held.until > Date.now()) {
    return held.headers
  }
  const headers = await stepUp(http, member)
  proofs.set(member, { headers, until: Date.now() + 4 * 60 * 1000 })
  return headers
}

/** A shop record made by `member` (a step-up: a record may name its package): its id. */
export async function makeTenant(
  http: HttpClient,
  member: Member,
  body: Record<string, unknown> = {}
): Promise<{ id: string; slug: string }> {
  const slug = freshSlug()
  const made = await http.post<{ tenant: { id: string; slug: string } }>(
    "/admin/cp/tenants",
    { name: "Atölye Bıçak", slug, ...body },
    { ...anyStatus, headers: await proved(http, member) }
  )
  if (made.status !== 200) {
    throw new Error(`tenant not made: ${String(made.status)} ${JSON.stringify(made.data)}`)
  }
  return made.data.tenant
}

/** Audit rows matching `filters`, once the answer has gone (rows are written after it). */
export async function auditRows(
  container: MedusaContainer,
  filters: Record<string, unknown>,
  wait = 250
) {
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  const [rows] = await container
    .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
    .listAndCountCpAuditEntries(filters, { order: { created_at: "ASC" }, take: 100 })
  return rows
}

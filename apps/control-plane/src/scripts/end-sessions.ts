import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { parseEnv } from "../lib/env"
import { sessionIndex } from "../lib/staff/session-index"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { CP_STAFF_MODULE } from "../modules/cp-staff"
import type CpStaffModuleService from "../modules/cp-staff/service"

export class EndSessionsError extends Error {
  override readonly name = "EndSessionsError"
}

/**
 * Break-glass (Ek C4, M2): every session and token of a staff member ends,
 * from the server's shell, when they cannot do it from the panel (their
 * proofs locked by a stolen session, say). Their session ids leave the
 * index, which alone ends them, and every bearer token they hold stops.
 * Recorded as the system's. Their 2FA and role stay.
 */
export async function endSessionsOf(
  container: MedusaContainer,
  email: string
): Promise<{ userId: string; sessions: number }> {
  if (!parseEnv().REDIS_URL) {
    throw new EndSessionsError(
      "cp:end-sessions: REDIS_URL is not set; the server's sessions live in its own memory"
    )
  }
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ email: email.trim().toLowerCase() }, { select: ["id"], take: 1 })
  if (!user) {
    throw new EndSessionsError("cp:end-sessions: no such user")
  }
  const index = sessionIndex()
  const sessions = (await index.list(user.id)).length
  await index.clear(user.id)
  await container.resolve<CpStaffModuleService>(CP_STAFF_MODULE).endTokens(user.id)
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "cp_staff.sessions_ended",
    actor_type: "system",
    resource_type: "cp_staff_member",
    resource_id: user.id,
    changes: { sessions },
  })
  return { userId: user.id, sessions }
}

/** `pnpm --filter control-plane cp:end-sessions user=<e-mail>` */
export default async function endSessions({ container, args }: ExecArgs) {
  const email = args.find((arg) => arg.startsWith("user="))?.slice("user=".length) ?? ""
  const { sessions } = await endSessionsOf(container, email)
  process.stdout.write(
    `cp:end-sessions: ${String(sessions)} session(s) ended, every token stopped\n`
  )
}

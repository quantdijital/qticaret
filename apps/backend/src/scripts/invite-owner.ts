import type { ExecArgs } from "@medusajs/framework/types"
import { z } from "@medusajs/framework/zod"
import { tenantResultLine } from "@qticaret/types/control-plane"
import { logger } from "../lib/logging"
import { createOwnerInvite } from "../lib/staff/owner-invite"

const ARG = "email="
const email = z.email().max(254)

/** `email=<address>` from `medusa exec`'s plain arguments, lower-cased; throws without one. */
export function emailArg(args: readonly string[]): string {
  const raw = args
    .find((value) => value.startsWith(ARG))
    ?.slice(ARG.length)
    .trim()
  const parsed = email.safeParse(raw?.toLowerCase())
  if (!parsed.success) {
    throw new Error("invite-owner: email=<address> is required")
  }
  return parsed.data
}

/**
 * Usage: pnpm --filter @qticaret/backend tenant:invite-owner email=<address>
 *
 * The setup's owner invitation (adr/0061 §5.7, Ek C10), one of the
 * provisioner's closed list of commands. Prints one machine-readable line
 * on stdout (`QT_TENANT_RESULT {...}`) and nothing else about it: the
 * provisioner mails the link with the control plane's own sender and
 * keeps nothing. Never run it where its output is kept: the line holds
 * the link. Running it again sends a new link and voids the old one.
 */
export default async function inviteOwner({ container, args }: ExecArgs): Promise<void> {
  const result = await createOwnerInvite(container, emailArg(args))
  // The status alone in the log; the link only on the result line
  logger.info({ event: "staff.owner_invite", status: result.status })
  process.stdout.write(`${tenantResultLine(result)}\n`)
}

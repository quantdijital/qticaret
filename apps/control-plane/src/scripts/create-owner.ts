import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { deleteInvitesWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "@medusajs/framework/zod"
import { addressTaken, sendInvite } from "../lib/staff/invites"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import { CP_STAFF_MODULE } from "../modules/cp-staff"
import type CpStaffModuleService from "../modules/cp-staff/service"
import { inviteCpStaffWorkflow } from "../workflows/cp-staff/invites"

const address = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase())

/** The address with its local part hidden, for the operator's terminal. */
const masked = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2")

export class CreateOwnerError extends Error {
  override readonly name = "CreateOwnerError"
}

interface OpenInvite {
  id: string
  email: string
  metadata?: Record<string, unknown> | null
}

/**
 * The control plane's first owner (adr/0061 §3.5, C4): a bootstrap
 * invitation that may give the owner role, accepted like any other (a
 * login for the address, then 2FA before the role is granted). Only while
 * no owner is granted: afterwards owners are made from the team. Every
 * bootstrap invitation still out, for any address, is withdrawn first
 * (L3); the new one holds for an hour (L2). Recorded as the system's.
 */
export async function inviteFirstOwner(
  container: MedusaContainer,
  rawEmail: string
): Promise<{ email: string; link: string; mailed: boolean }> {
  const parsed = address.safeParse(rawEmail)
  if (!parsed.success) {
    throw new CreateOwnerError("cp:create-owner: email= must be an e-mail address")
  }
  const email = parsed.data
  if (await container.resolve<CpStaffModuleService>(CP_STAFF_MODULE).hasActiveOwner()) {
    throw new CreateOwnerError("cp:create-owner: an owner exists; owners invite from the panel")
  }
  if ((await addressTaken(container, email)) === "member") {
    throw new CreateOwnerError("cp:create-owner: the address already has an account")
  }
  const open = (await container
    .resolve(Modules.USER)
    .listInvites({}, { select: ["id", "email", "metadata"], take: 500 })) as OpenInvite[]
  const stale = open.filter((each) => each.metadata?.["bootstrap"] === true || each.email === email)
  if (stale.length > 0) {
    await deleteInvitesWorkflow(container).run({ input: { ids: stale.map((each) => each.id) } })
  }
  const { result } = await inviteCpStaffWorkflow(container).run({
    input: { email, role: "owner", invited_by: null, bootstrap: true },
  })
  const invite = result[0] as
    { id: string; email: string; token: string; expires_at: Date; created_at: Date } | undefined
  if (!invite) {
    throw new CreateOwnerError("cp:create-owner: the invitation was not made")
  }
  const sent = await sendInvite(container, invite, "owner")
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "cp_staff.owner_invited",
    actor_type: "system",
    resource_type: "cp_invite",
    resource_id: invite.id,
    changes: { mailed: sent.mailed, withdrawn: stale.length },
  })
  return { email, ...sent }
}

/**
 * `pnpm --filter control-plane cp:create-owner email=<address> [print-link=yes]`:
 * the first owner's invitation by e-mail (Mailpit on a developer's
 * machine), valid an hour. Prints no secret: the link only with
 * `print-link=yes`, when no e-mail could go out, once. Run it by hand in a
 * terminal, never as a job whose output is kept: the link is an owner's
 * credential.
 */
export default async function createOwner({ container, args }: ExecArgs) {
  const email = args.find((arg) => arg.startsWith("email="))?.slice("email=".length) ?? ""
  const printLink = args.includes("print-link=yes")
  const { link, mailed } = await inviteFirstOwner(container, email)
  const out = process.stdout
  if (mailed) {
    out.write(`cp:create-owner: invitation sent to ${masked(email)} (valid 1 hour)\n`)
    return
  }
  if (!printLink) {
    out.write(
      "cp:create-owner: no e-mail went out. Run again with print-link=yes to see the link once,\n" +
        "by hand in a terminal, never in a job whose output is logged.\n"
    )
    return
  }
  out.write(
    `cp:create-owner: hand this link to ${masked(email)} yourself. It is an owner's credential:\n` +
      `shown once, not stored, valid 1 hour. Never paste it into a ticket or a chat:\n${link}\n`
  )
}

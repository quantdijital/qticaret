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

/**
 * The control plane's first owner (adr/0061 §3.5, C4): a bootstrap
 * invitation that may give the owner role, accepted like any other (a
 * login for the address, then 2FA before anything). Only while there is no
 * active owner: afterwards owners are made from the team. A bootstrap
 * invitation already out for the address is replaced (its link stops).
 * Recorded as the system's.
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
  const open = await container
    .resolve(Modules.USER)
    .listInvites({ email }, { select: ["id"], take: 10 })
  if (open.length > 0) {
    await deleteInvitesWorkflow(container).run({ input: { ids: open.map((each) => each.id) } })
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
    changes: { mailed: sent.mailed },
  })
  return { email, ...sent }
}

/**
 * `pnpm --filter control-plane cp:create-owner email=<address>`: the first
 * owner's invitation by e-mail (Mailpit on a developer's machine). Prints
 * no secret, but when no e-mail could go out: then the link, once, for the
 * operator to hand over; it is not stored and lasts 24 hours.
 */
export default async function createOwner({ container, args }: ExecArgs) {
  const email = args.find((arg) => arg.startsWith("email="))?.slice("email=".length) ?? ""
  const { link, mailed } = await inviteFirstOwner(container, email)
  const out = process.stdout
  if (mailed) {
    out.write(`cp:create-owner: invitation sent to ${masked(email)} (valid 24 hours)\n`)
    return
  }
  out.write(
    `cp:create-owner: no e-mail went out; hand this link to ${masked(email)} yourself.\n` +
      `It is shown once, not stored, and valid 24 hours:\n${link}\n`
  )
}
